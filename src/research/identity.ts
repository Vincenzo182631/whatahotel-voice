import { words } from "../verify/evidence.js";
import { CHAINS, chainById, chainOfHost, chainOfName, hostBelongsTo, isThirdParty, type Chain } from "./chains.js";

export interface HotelRef {
  name: string;
  city: string;
  country: string;
  /** A chain id from chains.ts, or "independent". Left out: guessed from the name. */
  chain?: string;
}

export interface Checks {
  name_coverage: number;
  location_match: boolean;
  rebrand?: string;
}

export interface Identity {
  status: "confirmed" | "needs_review";
  hotel: HotelRef;
  affiliation: { kind: "chain" | "independent" | "unknown"; chain?: string };
  official_url?: string;
  base_url?: string;
  host?: string;
  checks?: Checks;
  evidence: string[];
  reasons: string[];
  candidates: string[];
  checked_at: string;
}

export interface Candidate {
  url: string;
  title?: string;
  score: number;
  /** Share of the hotel name's words found in the result's title and URL. */
  nameScore: number;
  /** Share of the page address's own words that belong to the hotel name; "...-sharq-village-and-spa" is less exact for "Doha" than "...-the-ritz-carlton-doha". */
  precision: number;
}

const PATH_NOISE = new Set(["en", "hotels", "hotel", "overview", "the", "a", "and", "at", "of", "in", "by"]);
function addressWords(u: URL): string[] {
  const segs = u.pathname.split("/").filter(Boolean);
  const i = segs.indexOf("hotels");
  const seg = i >= 0 ? segs[i + 1] : segs[segs.length - 1];
  if (!seg) return [];
  const toks = words(seg.replace(/-/g, " ")).filter((w) => w.length > 1 && !PATH_NOISE.has(w));
  // chain pages start with a property code ("dohrz-the-ritz-carlton-doha"): drop it
  return i >= 0 && seg.includes("-") ? toks.slice(1) : toks;
}

const significant = (s: string) => words(s).filter((w) => w.length > 1);
const cityWords = (city: string) => significant(city.split(/[(,]/)[0] ?? city).filter((w) => w.length > 2);

export function affiliationOf(hotel: HotelRef): Identity["affiliation"] {
  if (hotel.chain === "independent") return { kind: "independent" };
  const chain = hotel.chain ? chainById(hotel.chain) : chainOfName(hotel.name);
  return chain ? { kind: "chain", chain: chain.id } : { kind: "unknown" };
}

/** Search results ranked as likely official property pages. Third-party sites and unrelated pages are dropped. */
export function rankCandidates(hotel: HotelRef, results: Array<{ url: string; title?: string }>, chain?: Chain): Candidate[] {
  const city = cityWords(hotel.city);
  const name = significant(hotel.name);
  const out: Candidate[] = [];
  for (const r of results) {
    let u: URL;
    try {
      u = new URL(r.url);
    } catch {
      continue;
    }
    const host = u.hostname.replace(/^www\./, "");
    if (!/^https?:$/.test(u.protocol) || isThirdParty(host)) continue;
    if (chain && !hostBelongsTo(chain.id, host)) continue;
    // branded residences share a name with their hotel; they are separate properties unless the hotel is one
    if (/residences?/i.test(u.pathname) && !/residences?/i.test(hotel.name)) continue;
    const hay = new Set(words(`${r.title ?? ""} ${u.hostname} ${u.pathname}`));
    const nameScore = name.length ? name.filter((w) => hay.has(w)).length / name.length : 0;
    const cityScore = city.length ? city.filter((w) => hay.has(w)).length / city.length : 0;
    const depth = u.pathname.split("/").filter(Boolean).length;
    const addr = addressWords(u);
    const nameSet = new Set(name);
    const precision = addr.length ? addr.filter((w) => nameSet.has(w)).length / addr.length : 1;
    out.push({ url: r.url, title: r.title, nameScore, precision, score: 1.5 * nameScore + 0.5 * cityScore + 0.3 * precision - 0.05 * depth });
  }
  const seen = new Set<string>();
  return out
    .sort((a, b) => b.score - a.score)
    .map((c) => (chain ? { ...c, url: englishUrl(c.url) } : c))
    .filter((c) => !seen.has(c.url) && seen.add(c.url));
}

/** The English version of a chain page URL (/zh-cn/hotels/x/ and /de/hotels/x/ are the same property as /en/hotels/x/). */
export function englishUrl(url: string): string {
  const u = new URL(url);
  u.pathname = u.pathname.replace(/^\/(?!en\/)[a-z]{2}(?:-[a-z]{2})?\//i, "/en/");
  return u.toString();
}

export interface PageForCheck {
  url: string;
  text: string;
  title?: string;
}

/** Decides whether a fetched page is the requested hotel's own official page. */
export function assessPage(hotel: HotelRef, aff: Identity["affiliation"], page: PageForCheck): { ok: boolean; checks: Checks; evidence: string[]; reasons: string[] } {
  const reasons: string[] = [];
  const evidence: string[] = [];
  const host = new URL(page.url).hostname.replace(/^www\./, "");
  const hostChain = chainOfHost(host);
  if (isThirdParty(host)) reasons.push(`${host} is a third-party site, not the hotel's own`);
  if (aff.kind === "chain" && !hostBelongsTo(aff.chain!, host)) reasons.push(`${host} does not belong to ${chainById(aff.chain!)?.name ?? aff.chain}; chain sources are only used for that chain's own properties`);
  if (aff.kind === "independent" && hostChain) reasons.push(`${host} is a ${hostChain.name} site but the hotel was marked independent`);
  if (hostChain && !hostChain.base(new URL(page.url))) reasons.push(`${page.url} is a ${hostChain.name} landing page, not a property page`);
  if (hostChain && aff.kind !== "independent" && aff.kind !== "chain") evidence.push(`page is on ${hostChain.name}'s own site (${host})`);

  const head = `${page.title ?? ""}\n${page.text.slice(0, 4000)}\n${page.url}`;
  const hay = new Set(words(head));
  const name = significant(hotel.name);
  let coverage = name.length ? name.filter((w) => hay.has(w)).length / name.length : 0;
  const city = cityWords(hotel.city);
  const cityShare = city.length ? city.filter((w) => hay.has(w)).length / city.length : 0;
  const location = cityShare >= 0.6 || words(hotel.country).every((w) => hay.has(w));

  let rebrand: string | undefined;
  {
    for (const m of page.text.slice(0, 20_000).matchAll(/[^.\n]*\b(formerly|previously|renamed|rebrand\w*|now known as|reopened as)\b[^.\n]*/gi)) {
      const sentence = m[0].trim();
      const s = new Set(words(sentence));
      if (name.some((w) => w.length > 3 && s.has(w)) && name.filter((w) => s.has(w)).length >= Math.ceil(name.length / 2)) {
        rebrand = sentence.slice(0, 200);
        break;
      }
    }
  }
  if (coverage >= 0.75) evidence.push(`${Math.round(coverage * 100)}% of the hotel name appears on the page${rebrand ? `; rebrand noted: "${rebrand}"` : ""}`);
  else if (rebrand) evidence.push(`page mentions the requested name in a rebrand sentence: "${rebrand}"`);
  else reasons.push(`only ${Math.round(coverage * 100)}% of the hotel name appears on the page`);
  if (location) evidence.push(`location matches (${hotel.city}, ${hotel.country})`);
  else reasons.push(`page does not mention ${hotel.city}`);
  if (/permanently closed|has closed|no longer operating/i.test(page.text.slice(0, 3000))) reasons.push("page suggests the hotel is closed");
  coverage = Math.round(coverage * 100) / 100;
  return { ok: reasons.length === 0 && (coverage >= 0.75 || !!rebrand), checks: { name_coverage: coverage, location_match: location, ...(rebrand ? { rebrand } : {}) }, evidence, reasons };
}

export interface IdentityDeps {
  search: (query: string) => Promise<Array<{ url: string; title?: string }>>;
  /** Page text for a URL (cached, direct or Firecrawl). Throws when the page can't be read. */
  load: (url: string) => Promise<string>;
  /** Follows redirects and returns the final URL. */
  resolveUrl: (url: string) => Promise<string>;
  now?: () => Date;
}

const MAX_CANDIDATES = 3;

/** The property's section of a site: the chain's own layout, or the site root for single-hotel sites. */
export function baseUrlFor(url: string, aff: Identity["affiliation"]): string {
  const u = new URL(url);
  const chain = aff.chain ? chainById(aff.chain) : chainOfHost(u.hostname.replace(/^www\./, ""));
  return chain?.base(u) ?? `${u.origin}/`;
}

/** Finds and confirms the hotel's official website. Never guesses: anything unconfirmed comes back as needs_review. */
export async function resolveOfficialSite(hotel: HotelRef, deps: IdentityDeps, opts: { officialUrl?: string } = {}): Promise<Identity> {
  const aff = affiliationOf(hotel);
  const checkedAt = (deps.now?.() ?? new Date()).toISOString();
  const base = { hotel, affiliation: aff, evidence: [] as string[], reasons: [] as string[], candidates: [] as string[], checked_at: checkedAt };
  const chain = aff.chain ? chainById(aff.chain) : undefined;

  let urls: string[] = [];
  if (opts.officialUrl) urls = [opts.officialUrl];
  else {
    const results: Array<{ url: string; title?: string }> = [];
    const queries = chain
      ? chain.domains.flatMap((d) => [`"${hotel.name}" ${hotel.city} site:${d}`, `${hotel.name} hotel ${hotel.city} ${hotel.country} site:${d}`])
      : [`"${hotel.name}" ${hotel.city} ${hotel.country} official website`];
    for (const q of queries) {
      try {
        results.push(...(await deps.search(q)));
      } catch (err) {
        base.reasons.push(`search failed: ${(err as Error).message.slice(0, 120)}`);
        if (/limit reached/.test((err as Error).message)) break;
      }
    }
    const ranked = rankCandidates(hotel, results, chain);
    // two different properties of one chain ranking alike (e.g. two Mandarin Oriental hotels in Hong Kong) cannot be told apart by name
    if (chain) {
      const bases = new Map<string, number>();
      // only results whose name matches as well as the best one count: the same city is not the same hotel
      const bestName = Math.max(...ranked.map((c) => c.nameScore), 0);
      const named = ranked.filter((x) => x.nameScore >= bestName - 0.1);
      // among equally named results, an address made only of the hotel's own words beats one carrying extra words
      const bestPrecision = Math.max(...named.map((c) => c.precision), 0);
      for (const c of named.filter((x) => x.precision >= bestPrecision - 0.15)) {
        const b = chain.base(new URL(c.url));
        if (b && !bases.has(b)) bases.set(b, c.score);
      }
      const top = Math.max(...bases.values(), 0);
      const close = [...bases.entries()].filter(([, sc]) => sc >= top - 0.1).map(([b]) => b);
      if (close.length > 1) {
        return { ...base, status: "needs_review", candidates: close, reasons: [...base.reasons, `several ${chain.name} properties match "${hotel.name}" in ${hotel.city} (${close.join(", ")}); confirm with --official-url`] };
      }
    }
    urls = ranked.slice(0, MAX_CANDIDATES).map((c) => c.url);
    if (!urls.length) return { ...base, status: "needs_review", reasons: [...base.reasons, "no candidate official site found; flag for review"] };
  }

  const tried: string[] = [];
  for (const candidate of urls) {
    tried.push(candidate);
    let finalUrl = candidate;
    try {
      finalUrl = await deps.resolveUrl(candidate);
      const text = await deps.load(finalUrl);
      const r = assessPage(hotel, aff, { url: finalUrl, text });
      if (r.ok) {
        const baseUrl = baseUrlFor(finalUrl, aff);
        const resolved: Identity["affiliation"] =
          aff.kind === "unknown" && chainOfHost(new URL(finalUrl).hostname.replace(/^www\./, ""))
            ? { kind: "chain", chain: chainOfHost(new URL(finalUrl).hostname.replace(/^www\./, ""))!.id }
            : aff.kind === "unknown"
              ? { kind: "independent" }
              : aff;
        return {
          ...base,
          affiliation: resolved,
          status: "confirmed",
          official_url: finalUrl,
          base_url: baseUrl,
          host: new URL(finalUrl).hostname.replace(/^www\./, ""),
          checks: r.checks,
          evidence: [...(finalUrl !== candidate ? [`redirected from ${candidate}`] : []), ...r.evidence],
          reasons: [],
          candidates: tried,
        };
      }
      base.reasons.push(`${finalUrl}: ${r.reasons.join("; ")}`);
    } catch (err) {
      base.reasons.push(`${finalUrl}: ${(err as Error).message.slice(0, 140)}`);
      if (/limit reached/.test((err as Error).message)) break;
    }
  }
  return { ...base, status: "needs_review", candidates: tried, reasons: [...base.reasons, "official website could not be confirmed; flag for review"] };
}

export { CHAINS };
