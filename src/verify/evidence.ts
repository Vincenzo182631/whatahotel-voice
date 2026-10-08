import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { HotelProfile } from "../core/schema.js";
import { FirecrawlClient, FirecrawlError } from "../sources/firecrawl.js";
import { htmlToLines } from "../sources/whatahotel.js";

/**
 * Where a page comes from, which decides how much it can prove:
 * - official: the hotel's own pages and press room on fourseasons.com
 * - editorial: Condé Nast Traveler's own hotel review
 * - press: anything else a profile already cites (Wikipedia, magazines)
 */
export type EvidenceTier = "official" | "editorial" | "press";

export interface Evidence {
  id: string;
  url: string;
  tier: EvidenceTier;
  text: string;
}

export interface Gathered {
  evidence: Evidence[];
  /** Pages we tried and could not use, with the reason. */
  skipped: Array<{ url: string; reason: string }>;
}

export const CACHE_DIR = path.resolve(process.env.WH_VERIFY_CACHE ?? "data/verification/.cache");
const MAX_CHARS = 30_000;
const MAX_SUBPAGES = 8;

export function tierOf(url: string): EvidenceTier {
  const host = new URL(url).hostname;
  if (host === "fourseasons.com" || host.endsWith(".fourseasons.com")) return "official";
  if (host === "mandarinoriental.com" || host.endsWith(".mandarinoriental.com")) return "official";
  if (host === "cntraveler.com" || host.endsWith(".cntraveler.com")) return "editorial";
  return "press";
}

/** Markdown to plain text: drops images, keeps link text, collapses blank runs, caps length. */
export function cleanText(markdown: string): string {
  return markdown
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_CHARS);
}

/** Property codes seen in URLs on fourseasons.com, e.g. "alexandria" or "dubaijb". */
export function propertyCodes(urls: string[]): string[] {
  const codes = new Set<string>();
  for (const u of urls) {
    const m = /^https?:\/\/(?:www\.|press\.)?fourseasons\.com\/([a-z0-9-]+)(?:\/|$)/i.exec(u);
    if (m && !["en", "content", "alt", "press"].includes(m[1]!.toLowerCase())) codes.add(m[1]!.toLowerCase());
  }
  return [...codes];
}

const PAGE_KEYWORDS = ["dining", "spa", "accommodations", "rooms", "suites", "services-and-amenities", "amenities", "family", "location", "getting-here", "fitness", "beach", "pool", "about", "faq"];
const PAGE_SKIP = /offers|gallery|careers|residences|meetings|weddings|events|press|sitemap|privacy|terms|login|cart|\.[a-z0-9]{2,4}$/i;

/** Picks the most useful same-property pages linked from a property homepage. */
export function subpageLinks(homepageMarkdown: string, code: string, max = MAX_SUBPAGES): string[] {
  const found = new Set<string>();
  const re = new RegExp(`\\((?:https://www\\.fourseasons\\.com)?(/${code}/[^)\\s#?]+)`, "gi");
  for (const m of homepageMarkdown.matchAll(re)) {
    const p = m[1]!.replace(/\/+$/, "");
    if (p.split("/").filter(Boolean).length > 3 || PAGE_SKIP.test(p)) continue;
    found.add(`https://www.fourseasons.com${p}/`);
  }
  const score = (u: string) => {
    const i = PAGE_KEYWORDS.findIndex((k) => u.includes(k));
    return i === -1 ? PAGE_KEYWORDS.length : i;
  };
  return [...found].sort((a, b) => score(a) - score(b)).slice(0, max);
}

const STOP = new Set(["the", "a", "at", "of", "hotel", "and", "by", "in"]);
const words = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(/[^a-z0-9]+/).filter((w) => w && !STOP.has(w));

/** Share of the hotel name's words found in a search result's title and URL. */
export function nameOverlap(hotelName: string, title: string, url: string): number {
  const name = words(hotelName);
  if (!name.length) return 0;
  const hay = new Set(words(`${title} ${url}`));
  return name.filter((w) => hay.has(w)).length / name.length;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Firecrawl limits requests per minute, so live calls are spaced out (cached pages cost nothing). */
const GAP_MS = Number(process.env.WH_FIRECRAWL_GAP_MS ?? 7000);
let lastCall = 0;

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    const wait = lastCall + GAP_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastCall = Date.now();
    try {
      return await fn();
    } catch (err) {
      const rateLimited = err instanceof FirecrawlError && / 429 /.test(err.message);
      if (!rateLimited || attempt >= 5) throw err;
      await sleep(20_000 * attempt);
    }
  }
}

const cacheFile = (url: string) => path.join(CACHE_DIR, `${createHash("sha1").update(url).digest("hex")}.json`);

/** The Four Seasons press room and Condé Nast Traveler answer plain requests; fourseasons.com itself blocks them. */
const DIRECT_HOSTS = /^https?:\/\/(press\.fourseasons\.com|(www\.)?cntraveler\.com|(www\.)?mandarinoriental\.com)\//;
const BROWSER_UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";
const NOT_A_PAGE = /we'?re sorry if we led you astray|page not found|404/i;

/** Page text fetched without Firecrawl, or undefined when the site refuses or the page is empty. */
export async function fetchDirect(url: string): Promise<string | undefined> {
  if (!DIRECT_HOSTS.test(url)) return undefined;
  try {
    const res = await fetch(url, {
      headers: { "user-agent": BROWSER_UA, "accept-language": "en-US,en;q=0.9" },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return undefined;
    const text = htmlToLines(await res.text()).join("\n");
    return text.length >= 400 && !NOT_A_PAGE.test(text.slice(0, 600)) ? text : undefined;
  } catch {
    return undefined;
  }
}

/** Raw markdown for a URL, from the cache unless refresh is set. */
async function fetchMarkdown(fc: FirecrawlClient, url: string, refresh: boolean): Promise<string> {
  if (!refresh) {
    try {
      return (JSON.parse(await readFile(cacheFile(url), "utf8")) as { markdown: string }).markdown;
    } catch {
      /* not cached */
    }
  }
  const direct = await fetchDirect(url);
  const page = direct ? { markdown: direct } : await withRetry(() => fc.scrape(url));
  const markdown = page.markdown ?? "";
  if (markdown.length < 200) throw new FirecrawlError(`${url}: page had almost no text`);
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(cacheFile(url), JSON.stringify({ url, fetched_at: new Date().toISOString(), markdown }));
  return markdown;
}

const slug = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** Likely Condé Nast Traveler addresses for a hotel; the real one is found by asking the site. */
export function condeNastCandidates(profile: HotelProfile): string[] {
  const name = slug(profile.name);
  const city = slug(profile.location.city ?? "");
  const country = slug(profile.location.country ?? "");
  const names = [...new Set([name, name.replace(/-at-.*$/, ""), name.replace(/^four-seasons-(hotel-|resort-)?/, "four-seasons-")])];
  const out: string[] = [];
  for (const n of names) {
    if (city) out.push(`https://www.cntraveler.com/hotels/${city}/${n}`);
    if (city && country) out.push(`https://www.cntraveler.com/hotels/${country}/${city}/${n}`);
    out.push(`https://www.cntraveler.com/hotels/${n}`);
  }
  return [...new Set(out)];
}

/** Finds a Condé Nast Traveler hotel page for the profile, or undefined. */
export async function findCondeNast(fc: FirecrawlClient, profile: HotelProfile): Promise<string | undefined> {
  for (const url of condeNastCandidates(profile)) {
    if (await fetchDirect(url)) return url;
  }
  const results = await withRetry(() => fc.search(`"${profile.name}" site:cntraveler.com`, 6));
  const hits = results
    .filter((r) => /cntraveler\.com\/hotels\//.test(r.url))
    .map((r) => ({ url: r.url, score: nameOverlap(profile.name, r.title ?? "", r.url) }))
    .sort((a, b) => b.score - a.score);
  return hits[0] && hits[0].score >= 0.6 ? hits[0].url : undefined;
}

/**
 * Collects the pages a hotel's claims are checked against: the hotel's own pages on the
 * Four Seasons site (home, press-room fact sheet and the main sub-pages), its Condé Nast
 * Traveler review, and any non-WhataHotel page the profile already cites.
 */
export async function gatherEvidence(profile: HotelProfile, fc: FirecrawlClient, { refresh = false } = {}): Promise<Gathered> {
  const skipped: Gathered["skipped"] = [];
  const urls = new Set<string>();
  const cited = profile.sources.filter((s) => s.url && s.type !== "whatahotel").map((s) => s.url!);
  cited.forEach((u) => urls.add(u));

  let codes = propertyCodes(cited);
  const moBases = new Set<string>();
  for (const u of cited) {
    const m = /^https?:\/\/(?:www\.)?mandarinoriental\.com\/(?:[a-z]{2}\/)?([a-z0-9-]+)\/([a-z0-9-]+)/i.exec(u);
    if (m) moBases.add(`https://www.mandarinoriental.com/en/${m[1]}/${m[2]}`.toLowerCase());
  }
  if (!codes.length && !moBases.size && /four seasons/i.test(profile.name)) {
    try {
      const hits = await withRetry(() => fc.search(`"${profile.name}" site:fourseasons.com`, 5));
      codes = propertyCodes(hits.map((h) => h.url)).slice(0, 1);
    } catch (err) {
      skipped.push({ url: "(property search)", reason: (err as Error).message });
    }
  }

  const markdowns = new Map<string, string>();
  const load = async (url: string) => {
    if (markdowns.has(url)) return markdowns.get(url)!;
    try {
      const md = await fetchMarkdown(fc, url, refresh);
      markdowns.set(url, md);
      return md;
    } catch (err) {
      skipped.push({ url, reason: (err as Error).message.slice(0, 160) });
      return undefined;
    }
  };

  for (const code of codes.slice(0, 2)) {
    const home = `https://www.fourseasons.com/${code}/`;
    urls.add(home);
    urls.add(`https://press.fourseasons.com/${code}/hotel-facts/`);
    const md = await load(home);
    if (md) subpageLinks(md, code).forEach((u) => urls.add(u));
  }

  for (const base of [...moBases].slice(0, 2)) {
    urls.add(`${base}/`);
    const md = await load(`${base}/`);
    if (md) {
      const path = new URL(base).pathname;
      const found = new Set<string>();
      for (const m of md.matchAll(new RegExp(`\\((?:https://www\\.mandarinoriental\\.com)?(${path}/[^)\\s#?]+)`, "gi"))) {
        const p = m[1]!.replace(/\/+$/, "");
        if (!PAGE_SKIP.test(p)) found.add(`https://www.mandarinoriental.com${p}/`);
      }
      const score = (u: string) => { const i = PAGE_KEYWORDS.findIndex((k) => u.includes(k)); return i === -1 ? PAGE_KEYWORDS.length : i; };
      [...found].sort((a, b) => score(a) - score(b)).slice(0, MAX_SUBPAGES).forEach((u) => urls.add(u));
    }
  }

  try {
    const cnt = await findCondeNast(fc, profile);
    if (cnt) urls.add(cnt);
    else skipped.push({ url: "cntraveler.com", reason: "no Condé Nast Traveler hotel page found for this name" });
  } catch (err) {
    skipped.push({ url: "cntraveler.com", reason: (err as Error).message.slice(0, 160) });
  }

  const evidence: Evidence[] = [];
  for (const url of urls) {
    const md = await load(url);
    if (!md) continue;
    evidence.push({ id: `d${evidence.length + 1}`, url, tier: tierOf(url), text: cleanText(md) });
  }
  return { evidence, skipped: dedupeSkipped(skipped, evidence) };
}

/** A page can fail once and load later through another path; keep only real failures. */
function dedupeSkipped(skipped: Gathered["skipped"], evidence: Evidence[]): Gathered["skipped"] {
  const loaded = new Set(evidence.map((e) => e.url));
  const seen = new Set<string>();
  return skipped.filter((s) => !loaded.has(s.url) && !seen.has(s.url) && seen.add(s.url));
}
