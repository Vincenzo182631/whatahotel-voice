import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { loadProfile } from "../core/profile.js";
import type { HotelProfile } from "../core/schema.js";
import type { FirecrawlClient } from "../sources/firecrawl.js";
import { cleanText, fetchMarkdown, findCondeNast, tierOf, withRetry, type EvidenceTier } from "../verify/evidence.js";
import { quoteInText } from "../verify/judge.js";
import { Budget, BudgetExceeded, type Limits, type Usage } from "./budget.js";
import { pickPages } from "./discover.js";
import { resolveOfficialSite, type HotelRef, type Identity } from "./identity.js";

export const researchDir = (slug: string) => path.resolve(process.env.WH_RESEARCH_DIR ?? "data/research", slug);

export interface PageDoc {
  id: string;
  url: string;
  tier: EvidenceTier;
  fetched_at: string;
  source: "cache" | "direct" | "firecrawl";
}

export interface ResearchRecord {
  slug: string;
  status: "awaiting_extraction" | "needs_review";
  /** True when a per-hotel limit stopped the run before every wanted page was read. */
  partial: boolean;
  reasons: string[];
  identity: Identity;
  pages: PageDoc[];
  inaccessible: Array<{ url: string; reason: string }>;
  usage: Usage;
  limits: Limits;
  researched_at: string;
}

export async function resolveUrl(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      redirect: "follow",
      headers: { "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36" },
      signal: AbortSignal.timeout(15_000),
    });
    return res.url || url;
  } catch {
    return url;
  }
}

/** Links on a page as markdown, read from its HTML with a free direct request (plain-text fetches drop links). */
export async function directHtmlLinks(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36", "accept-language": "en-US,en;q=0.9" },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return "";
    const html = await res.text();
    return [...html.matchAll(/<a\b[^>]*?href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
      .map((m) => `[${m[2]!.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()}](${m[1]})`)
      .join("\n");
  } catch {
    return "";
  }
}

export interface RunOptions {
  fc: FirecrawlClient;
  budget: Budget;
  refresh?: boolean;
  chain?: string;
  officialUrl?: string;
  /** Also look for a Condé Nast Traveler page (one extra search). Labelled "editorial", never official. */
  withEditorial?: boolean;
  resolveUrl?: (url: string) => Promise<string>;
}

/** The hotel to research: its profile if one exists, otherwise what the scraped WhataHotel page says (so research can come first for a new hotel). */
/** The chain a collection file declares for a hotel ("chain": "ritz-carlton"), for hotels whose name does not say it. */
export async function chainFromCollections(slug: string): Promise<string | undefined> {
  const dir = path.resolve(process.env.WH_COLLECTIONS_DIR ?? "data");
  let names: string[] = [];
  try {
    names = (await readdir(dir)).filter((n) => /^[a-z0-9-]+\.json$/.test(n));
  } catch {
    return undefined;
  }
  for (const n of names) {
    try {
      const c = JSON.parse(await readFile(path.join(dir, n), "utf8")) as { chain?: string; hotels?: Array<{ slug?: string }> };
      if (c.chain && c.hotels?.some((h) => h.slug === slug)) return c.chain;
    } catch {
      /* not a collection file */
    }
  }
  return undefined;
}

export async function loadHotelRef(slug: string): Promise<{ name: string; whatahotel_url?: string; location: { city: string; country: string } }> {
  try {
    return await loadProfile(slug);
  } catch {
    /* no profile yet */
  }
  const file = path.resolve(process.env.WH_SOURCES_DIR ?? "data/sources", `${slug}.whatahotel.json`);
  let src: { name?: string; url?: string; address?: { city?: string; country?: string } };
  try {
    src = JSON.parse(await readFile(file, "utf8"));
  } catch {
    throw new Error(`${slug}: no profile and no scraped WhataHotel page (${path.relative(process.cwd(), file)}). Run hotel:scrape --hotel ${slug} first.`);
  }
  if (!src.name || !src.address?.city || !src.address?.country) throw new Error(`${slug}: the scraped WhataHotel page has no name, city or country`);
  return { name: src.name, whatahotel_url: src.url, location: { city: src.address.city, country: src.address.country } };
}

/** Step 1 of hotel research: confirm the official site, fetch the property's pages inside the limits, write the extraction task. */
export async function runResearch(slug: string, opts: RunOptions): Promise<ResearchRecord> {
  const profile = await loadHotelRef(slug);
  const dir = researchDir(slug);
  await mkdir(path.join(dir, "pages"), { recursive: true });
  const { budget } = opts;
  const hotel: HotelRef = { name: profile.name, city: profile.location.city, country: profile.location.country, ...((opts.chain ?? (await chainFromCollections(slug))) ? { chain: opts.chain ?? (await chainFromCollections(slug)) } : {}) };
  const now = () => new Date();
  const lastSource = { v: "firecrawl" as PageDoc["source"] };
  const hooks = {
    onCache: () => { budget.cacheHit(); lastSource.v = "cache"; },
    onDirect: () => { budget.direct(); lastSource.v = "direct"; },
    beforeFirecrawl: () => { budget.firecrawl("scrape"); lastSource.v = "firecrawl"; },
    maxAttempts: budget.limits.maxRetries,
  };
  const load = (url: string) => fetchMarkdown(opts.fc, url, !!opts.refresh, hooks);

  const reasons: string[] = [];
  const inaccessible: ResearchRecord["inaccessible"] = [];
  const pages: PageDoc[] = [];
  const kept: string[] = [];

  // reuse an identity already confirmed for this hotel unless a refresh was asked for
  let identity: Identity | undefined;
  if (!opts.refresh && !opts.officialUrl) {
    try {
      const old = JSON.parse(await readFile(path.join(dir, "identity.json"), "utf8")) as Identity;
      if (old.status === "confirmed" && old.hotel.name === hotel.name) identity = old;
    } catch { /* none yet */ }
  }
  if (!identity) {
    identity = await resolveOfficialSite(
      hotel,
      {
        search: (q) => withRetry(async () => { budget.firecrawl("search"); return opts.fc.search(q, 6); }, budget.limits.maxRetries),
        load: async (url) => cleanText(await load(url)),
        resolveUrl: opts.resolveUrl ?? resolveUrl,
        now,
      },
      { officialUrl: opts.officialUrl },
    ).catch((err) => {
      if (!(err instanceof BudgetExceeded)) throw err;
      return { status: "needs_review", hotel, affiliation: { kind: "unknown" }, evidence: [], reasons: [err.message], candidates: [], checked_at: now().toISOString() } as Identity;
    });
  }
  await writeFile(path.join(dir, "identity.json"), JSON.stringify(identity, null, 2) + "\n");

  const addPage = async (url: string, tier?: EvidenceTier) => {
    if (kept.includes(url)) return;
    try {
      const md = cleanText(await load(url));
      budget.addPage(md.length);
      const id = `p${pages.length + 1}`;
      await writeFile(path.join(dir, "pages", `${id}.txt`), md);
      kept.push(url);
      pages.push({ id, url, tier: tier ?? tierOf(url), fetched_at: now().toISOString(), source: lastSource.v });
    } catch (err) {
      if (err instanceof BudgetExceeded) throw err;
      inaccessible.push({ url, reason: (err as Error).message.slice(0, 160) });
    }
  };

  if (identity.status === "confirmed" && identity.official_url && identity.base_url) {
    try {
      await addPage(identity.official_url, "official");
      const homeText = pages[0] ? await readFile(path.join(dir, "pages", "p1.txt"), "utf8") : "";
      // links are stripped by cleanText, so discover from the raw (cached) page
      const raw = homeText ? await load(identity.official_url).catch(() => "") : "";
      let links = pickPages(raw, identity.base_url, budget.limits.maxPages * 2);
      if (!links.length) links = pickPages(await directHtmlLinks(identity.official_url), identity.base_url, budget.limits.maxPages * 2);
      for (const u of links) await addPage(u, "official");
      if (!links.length) inaccessible.push({ url: identity.base_url, reason: "no same-property sub-page links found on the home page" });
      if (opts.withEditorial) {
        const cnt = await withRetry(async () => { budget.firecrawl("search"); return findCondeNast(opts.fc, profile as HotelProfile); }, budget.limits.maxRetries).catch(() => undefined);
        if (cnt) await addPage(cnt, "editorial");
        else inaccessible.push({ url: "cntraveler.com", reason: "no Condé Nast Traveler hotel page found" });
      }
    } catch (err) {
      if (!(err instanceof BudgetExceeded)) throw err;
      reasons.push(`${err.message}; progress saved (${pages.length} pages), rerun with higher limits to continue`);
    }
  } else {
    reasons.push(...identity.reasons);
  }
  if (identity.status === "confirmed" && !pages.length) reasons.push("no pages could be read from the confirmed official site");
  if (identity.status === "confirmed" && inaccessible.length) reasons.push("some pages were inaccessible; missing information is not proof an amenity does not exist");

  const blocked = identity.status !== "confirmed" || !pages.length;
  const record: ResearchRecord = {
    slug,
    status: blocked ? "needs_review" : "awaiting_extraction",
    partial: reasons.some((r) => /limit reached/.test(r)),
    reasons,
    identity,
    pages,
    inaccessible,
    usage: budget.usage,
    limits: budget.limits,
    researched_at: now().toISOString(),
  };
  await writeFile(path.join(dir, "index.json"), JSON.stringify({ docs: pages, inaccessible }, null, 2) + "\n");
  await writeFile(path.join(dir, "usage.json"), JSON.stringify({ usage: budget.usage, limits: budget.limits }, null, 2) + "\n");
  await writeFile(path.join(dir, "research.json"), JSON.stringify(record, null, 2) + "\n");
  if (!blocked) await writeFile(path.join(dir, "extract-instructions.md"), extractionInstructions(profile.name, dir, record));
  return record;
}

const CATEGORIES = ["location", "design_history", "rooms", "dining", "amenities", "family", "experiences", "practical"] as const;

function extractionInstructions(name: string, dir: string, r: ResearchRecord): string {
  return [
    `# Extract verified facts for ${name}`,
    "",
    `Official site confirmed: ${r.identity.official_url} (${r.identity.affiliation.kind}${r.identity.affiliation.chain ? `: ${r.identity.affiliation.chain}` : ""}).`,
    `Read ${path.join(dir, "index.json")} and the page text in ${path.join(dir, "pages")}/<id>.txt. Use ONLY those pages, never memory. Do not run other commands or fetch anything.`,
    `Write ${path.join(dir, "facts.json")} (JSON only) with this shape:`,
    '{"facts":[{"id":"r-1","category":"dining","kind":"fact|subjective|unresolved","text":"one atomic statement","doc_id":"p3","excerpt":"copied verbatim from that page, max 240 chars","topic":"short key, e.g. pool-count","as_of":"YYYY-MM-DD or null"}],',
    ' "highlights":["r-4","r-1"],',
    ' "contradictions":[{"topic":"pool-count","note":"p2 says 2 pools, p5 says 3","sources":[{"doc_id":"p2","excerpt":"..."},{"doc_id":"p5","excerpt":"..."}]}]}',
    "",
    "## Rules",
    `- Look for: ${CATEGORIES.join(", ")}. Prefer distinctive, property-specific details over generic marketing.`,
    "- One fact per entry. The excerpt must be copied exactly from the page; the code rejects any excerpt that is not word for word in the page.",
    '- kind "fact" = stated plainly by the page. kind "subjective" = the hotel\'s own praise or opinion ("best", "unmatched luxury"): keep it out of facts, label it. kind "unresolved" = unclear or incomplete.',
    "- Never apply a chain-wide amenity or another hotel's feature to this property. Only this property's pages count.",
    "- Never invent distances, travel times, amenities, awards or experiences. A page that does not mention something is not proof it does not exist.",
    "- Awards, renovations, restaurant distinctions, openings: set as_of to the date or year the page gives; if the page gives none, use kind \"unresolved\".",
    "- If two pages disagree about the same thing, list it under contradictions, still list the facts with the same topic, and the code will hold the disputed ones out.",
    `- highlights: your strongest 5-8 fact ids, most distinctive first. If fewer than 5 verified facts exist, list fewer; do not pad.`,
    r.inaccessible.length ? `- These pages could not be read (do not assume anything about them): ${r.inaccessible.map((i) => i.url).join(", ")}` : "",
    "",
  ].filter((l) => l !== "").join("\n");
}

export const FactsFileSchema = z.object({
  facts: z.array(
    z.object({
      id: z.string(),
      category: z.string().default("other"),
      kind: z.enum(["fact", "subjective", "unresolved"]),
      text: z.string().min(3),
      doc_id: z.string(),
      excerpt: z.string(),
      topic: z.string().optional(),
      as_of: z.string().nullable().optional(),
    }),
  ),
  highlights: z.array(z.string()).default([]),
  contradictions: z
    .array(z.object({ topic: z.string(), note: z.string().default(""), sources: z.array(z.object({ doc_id: z.string(), excerpt: z.string() })).default([]) }))
    .default([]),
});

const PROMO = /\b(best|finest|unmatched|unparalleled|unrivall?ed|world[- ]class|legendary|iconic|ultimate|most (?:beautiful|luxurious|exclusive)|second to none|number one|#1|perfect|flawless|breathtaking|unforgettable|once-in-a-lifetime|only)\b/i;
const TIME_BOUND = /\b(renovat\w*|reopen\w*|newly|recently|opened in|award\w*|michelin|ranked|rated|voted|star[s]?\b|top \d+|best of)\b/i;

export interface VerifiedFact {
  id: string;
  category: string;
  text: string;
  source_url: string;
  source_tier: EvidenceTier;
  excerpt: string;
  as_of?: string;
  needs_date_check?: boolean;
}

export interface ResearchResult extends Omit<ResearchRecord, "status"> {
  status: "ready" | "needs_review";
  hotel: HotelRef & { confirmed_affiliation: Identity["affiliation"] };
  official_url?: string;
  verified_facts: VerifiedFact[];
  highlights: string[];
  subjective: Array<{ id: string; text: string; reason: string }>;
  unresolved: Array<{ id: string; text: string; reason: string }>;
  rejected: Array<{ id: string; text: string; reason: string }>;
  contradictions: Array<{ topic: string; note: string; sources: Array<{ url: string; excerpt: string; quote_verified: boolean }> }>;
}

const MIN_FACTS = 5;

/** Step 2: re-check every excerpt against the stored pages, hold out disputed and promotional claims, and write research.json. */
export async function importResearch(slug: string, file: string): Promise<ResearchResult> {
  const dir = researchDir(slug);
  const record = JSON.parse(await readFile(path.join(dir, "research.json"), "utf8")) as ResearchRecord;
  if (record.identity.status !== "confirmed") throw new Error(`${slug}: official site not confirmed; nothing to import. Reasons: ${record.reasons.join(" | ")}`);
  const facts = FactsFileSchema.parse(JSON.parse(await readFile(file, "utf8")));
  const docs = new Map(record.pages.map((p) => [p.id, p]));
  const text = new Map<string, string>();
  for (const p of record.pages) text.set(p.id, await readFile(path.join(dir, "pages", `${p.id}.txt`), "utf8"));
  const quoteOk = (docId: string, excerpt: string) => docs.has(docId) && quoteInText(excerpt, text.get(docId)!);

  const contradictions = facts.contradictions.map((c) => ({
    topic: c.topic,
    note: c.note,
    sources: c.sources.filter((s) => docs.has(s.doc_id)).map((s) => ({ url: docs.get(s.doc_id)!.url, excerpt: s.excerpt, quote_verified: quoteOk(s.doc_id, s.excerpt) })),
  }));
  const disputed = new Set(contradictions.map((c) => c.topic.toLowerCase()));

  const verified: VerifiedFact[] = [];
  const subjective: ResearchResult["subjective"] = [];
  const unresolved: ResearchResult["unresolved"] = [];
  const rejected: ResearchResult["rejected"] = [];
  for (const f of facts.facts) {
    const base = { id: f.id, text: f.text };
    if (!docs.has(f.doc_id)) { rejected.push({ ...base, reason: `unknown page ${f.doc_id}` }); continue; }
    if (!quoteOk(f.doc_id, f.excerpt)) { rejected.push({ ...base, reason: "excerpt is not word for word in the page" }); continue; }
    if (f.kind === "subjective") { subjective.push({ ...base, reason: "the hotel's own opinion or praise; keep out of facts" }); continue; }
    if (f.kind === "unresolved") { unresolved.push({ ...base, reason: "marked unresolved" }); continue; }
    if (PROMO.test(f.text)) { subjective.push({ ...base, reason: "promotional wording; rewrite as a plain fact or leave out" }); continue; }
    if (f.topic && disputed.has(f.topic.toLowerCase())) { unresolved.push({ ...base, reason: `sources conflict on "${f.topic}"; held out of scripts until resolved` }); continue; }
    const doc = docs.get(f.doc_id)!;
    const timeBound = TIME_BOUND.test(f.text);
    if (timeBound && !f.as_of) { unresolved.push({ ...base, reason: "time-bound (award, renovation or opening) with no date; confirm before use" }); continue; }
    verified.push({
      id: f.id,
      category: f.category,
      text: f.text,
      source_url: doc.url,
      source_tier: doc.tier,
      excerpt: f.excerpt,
      ...(f.as_of ? { as_of: f.as_of } : {}),
      ...(timeBound ? { needs_date_check: true } : {}),
    });
  }
  const ids = new Set(verified.map((v) => v.id));
  const highlights = [...new Set(facts.highlights)].filter((id) => ids.has(id)).slice(0, 8);

  const reasons = [...record.reasons];
  if (record.partial) reasons.push("coverage is partial: a limit stopped the page fetch early; raise the limits and rerun to read the rest");
  if (verified.length < MIN_FACTS) reasons.push(`only ${verified.length} verified facts (need ${MIN_FACTS}); Needs review`);
  else if (highlights.length < Math.min(5, verified.length)) reasons.push(`only ${highlights.length} usable highlights`);
  const status = verified.length >= MIN_FACTS && highlights.length >= 2 ? "ready" : "needs_review";

  const result: ResearchResult = {
    ...record,
    status,
    reasons,
    hotel: { ...record.identity.hotel, confirmed_affiliation: record.identity.affiliation },
    official_url: record.identity.official_url,
    verified_facts: verified,
    highlights,
    subjective,
    unresolved,
    rejected,
    contradictions,
  };
  await writeFile(path.join(dir, "research.json"), JSON.stringify(result, null, 2) + "\n");
  return result;
}

/** Throws when a hotel's research says it needs review, so no script is forced from weak evidence. */
export async function assertResearchReady(slug: string): Promise<void> {
  let rec: { status?: string; reasons?: string[] };
  try {
    rec = JSON.parse(await readFile(path.join(researchDir(slug), "research.json"), "utf8"));
  } catch {
    return; // no research run for this hotel: the existing verify step remains the gate
  }
  if (rec.status === "needs_review") throw new Error(`${slug}: research says Needs review (${(rec.reasons ?? []).join("; ") || "see research.json"}). Resolve it before writing a script.`);
}
