import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chainById, chainOfName } from "../research/chains.js";
import { chainFromCollections, loadHotelRef } from "../research/research.js";
import { composeClosing } from "./closing.js";
import { parseChainOffer, parseHotelOffer, type ChainOffer, type HotelOffer } from "./extract.js";
import { offersDir, offersFile, type Benefit, type OfferSet } from "./store.js";

const WAH = "https://www.whatahotel.com";
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";

const memo = new Map<string, Promise<string>>();

/** whatahotel.com page text, retried on network errors; chain pages are fetched once per run. */
export async function fetchHtml(url: string): Promise<string> {
  const shared = /\/collection\//.test(url);
  if (shared && memo.has(url)) return memo.get(url)!;
  const run = (async () => {
    let last: unknown;
    for (let attempt = 1; attempt <= 4; attempt++) {
      try {
        const res = await fetch(url, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(30_000) });
        if (res.status >= 500 || res.status === 429) throw new Error(`${url} answered ${res.status}`);
        if (!res.ok) throw new Error(`${url} answered ${res.status}`);
        return await res.text();
      } catch (err) {
        last = err;
        if (/answered 4(?!29)/.test((err as Error).message)) break;
        await new Promise((r) => setTimeout(r, 1000 * attempt));
      }
    }
    throw last;
  })();
  if (shared) {
    memo.set(url, run);
    run.catch(() => memo.delete(url));
  }
  return run;
}

/** The chain's own page on whatahotel.com (e.g. /collection/5/mandarin-oriental.html), found from the collection index. */
export async function findChainPage(chainId: string, get: (u: string) => Promise<string> = fetchHtml): Promise<string | undefined> {
  const index = await get(`${WAH}/collection/`);
  const links = [...new Set([...index.matchAll(/href="(\/collection\/\d+\/[^"]+\.html)"/g)].map((m) => m[1]!))];
  const hit = links.find((l) => l.split("/").pop()!.replace(/\.html$/, "").startsWith(chainId));
  return hit ? `${WAH}${hit}` : undefined;
}

/** Compares a hotel's WhataHotel page with its chain page. Anything that conflicts or is unclear is left out and flagged. */
export function compareOffers(hotel: HotelOffer, chain?: ChainOffer, opts: { independent?: boolean } = {}): { benefits: Benefit[]; issues: string[] } {
  const issues: string[] = [];
  const has = (o: { found: Array<{ kind: string; excerpt: string }> } | undefined, kind: string) => o?.found.find((f) => f.kind === kind);
  const benefits: Benefit[] = [];

  const breakfast = has(hotel, "breakfast");
  if (!breakfast) benefits.push({ kind: "breakfast", status: "absent", qualifiers: [] });
  else if (chain?.breakfastGuests.some((n) => n !== 2)) {
    issues.push(`breakfast: the hotel page says breakfast for two but the chain page names a different number of guests; omitted`);
    benefits.push({ kind: "breakfast", status: "conflict", qualifiers: [], hotel_excerpt: breakfast.excerpt });
  } else benefits.push({ kind: "breakfast", status: "confirmed", qualifiers: [], hotel_excerpt: breakfast.excerpt, chain_excerpt: has(chain, "breakfast")?.excerpt });

  const wifi = has(hotel, "wifi");
  benefits.push(wifi ? { kind: "wifi", status: "confirmed", qualifiers: [], hotel_excerpt: wifi.excerpt, note: chain && !has(chain, "wifi") ? "chain page does not list Wi-Fi; confirmed on the hotel page only" : undefined } : { kind: "wifi", status: "absent", qualifiers: [] });

  const upgrade = has(hotel, "upgrade");
  if (!upgrade) benefits.push({ kind: "upgrade", status: "absent", qualifiers: [] });
  else {
    // the closing always says "when available", so a page calling the upgrade guaranteed does not change what is said
    if (hotel.upgradeGuaranteed || chain?.upgradeGuaranteed) issues.push("upgrade: a WhataHotel page describes the upgrade as guaranteed while the perks table says it depends on availability; the closing says it depends on availability");
    benefits.push({ kind: "upgrade", status: "confirmed", qualifiers: ["availability"], hotel_excerpt: upgrade.excerpt, chain_excerpt: chain?.upgradeNotes[0] });
  }

  const credit = has(hotel, "credit");
  const base = hotel.tableCredit;
  const facts = [...hotel.creditFacts, ...(chain?.creditFacts ?? [])];
  const stray = [...new Set(facts.filter((f) => f.kind === "standalone" && base !== undefined && f.amount !== base).map((f) => f.amount))];
  const hotelSuite = facts.find((f) => f.kind === "suite");
  const hotelSuitesHigher = hotel.suitesHigher || !!chain?.suitesHigher;
  // The closing never states a suite amount (or that suites get more): only the perks table's amount is spoken.
  if (hotelSuite || hotelSuitesHigher) issues.push("credit: WhataHotel mentions a higher credit for suites; the closing states only the perks table's amount");
  if (!credit) benefits.push({ kind: "credit", status: "absent", qualifiers: [] });
  else if (base === undefined) {
    issues.push("credit: the perks table lists a credit but no amount; omitted");
    benefits.push({ kind: "credit", status: "unclear", qualifiers: [], hotel_excerpt: credit.excerpt });
  } else {
    // other amounts on the pages (a suite figure, a resort-credit promo) never change the table's amount, which is what the closing states
    if (stray.length) issues.push(`credit: WhataHotel also prints ${stray.map((a) => `$${a}`).join(", ")}; the closing states the perks table's $${base}. Excerpts: ${facts.filter((f) => stray.includes(f.amount)).map((f) => f.excerpt.slice(0, 90)).join(" | ")}`);
    const qualifiers = [...new Set([...(chain?.creditQualifiers ?? []), ...hotel.creditQualifiers])];
    benefits.push({
      kind: "credit",
      status: "confirmed",
      amount: base,
      qualifiers,
      hotel_excerpt: credit.excerpt,
      chain_excerpt: has(chain, "credit")?.excerpt,
    });
  }

  const comb = has(hotel, "combinable");
  if (!comb) benefits.push({ kind: "combinable", status: "absent", qualifiers: [] });
  else if (!chain && opts.independent) benefits.push({ kind: "combinable", status: "confirmed", qualifiers: ["terms"], hotel_excerpt: comb.excerpt, note: "independent hotel: the hotel page is the only WhataHotel source" });
  else if (!chain) {
    issues.push("combinable: the chain page could not be checked, so combinability is not stated");
    benefits.push({ kind: "combinable", status: "unclear", qualifiers: [], hotel_excerpt: comb.excerpt });
  } else if (chain.combinable === "hedged") {
    issues.push(`combinable: the hotel page says combinable with the exclusive perks, but the chain page says it is decided per offer ("${chain.combinableExcerpt?.slice(0, 120)}"); not stated`);
    benefits.push({ kind: "combinable", status: "unclear", qualifiers: [], hotel_excerpt: comb.excerpt, chain_excerpt: chain.combinableExcerpt });
  } else benefits.push({ kind: "combinable", status: "confirmed", qualifiers: ["terms"], hotel_excerpt: comb.excerpt, chain_excerpt: chain.combinableExcerpt });

  return { benefits, issues };
}

const LOG = () => path.resolve(process.env.WH_CLOSING_LOG ?? "data/closing-log.json");
interface LogEntry { slug: string; template: string; text: string; at: string }
function readLog(): LogEntry[] {
  try {
    return existsSync(LOG()) ? (JSON.parse(readFileSync(LOG(), "utf8")) as LogEntry[]) : [];
  } catch {
    return [];
  }
}

export interface BuildOptions {
  chainUrl?: string;
  get?: (url: string) => Promise<string>;
  now?: () => Date;
}

/** Reads the hotel's and chain's WhataHotel pages, verifies every benefit and writes offers.json with the chosen closing. */
export async function buildOffers(slug: string, opts: BuildOptions = {}): Promise<OfferSet> {
  const get = opts.get ?? fetchHtml;
  const profile = await loadHotelRef(slug);
  if (!profile.whatahotel_url) throw new Error(`${slug}: no WhataHotel page URL (write the profile or scrape the page first)`);
  const now = (opts.now?.() ?? new Date()).toISOString();
  const issues: string[] = [];

  const hotelHtml = await get(profile.whatahotel_url);
  const hotel = parseHotelOffer(hotelHtml);
  if (!hotel.found.length) issues.push("the hotel's WhataHotel page lists no perks table; no benefit can be confirmed");

  // a hotel whose name does not say its chain (Ritz Penha Longa) still belongs to the chain its collection file declares
  const declared = await chainFromCollections(slug);
  const chain = chainOfName(profile.name) ?? (declared ? chainById(declared) : undefined);
  let chainUrl = opts.chainUrl;
  let chainOffer: ChainOffer | undefined;
  try {
    if (!chainUrl && chain) chainUrl = await findChainPage(chain.id, get);
    if (chainUrl) chainOffer = parseChainOffer(await get(chainUrl));
    else if (chain) issues.push("no WhataHotel chain page found for this hotel; the chain cross-check was skipped (pass --chain-url to add it)");
  } catch (err) {
    issues.push(`chain page could not be read: ${(err as Error).message.slice(0, 120)}`);
  }

  const cmp = compareOffers(hotel, chainOffer, { independent: !chain && !opts.chainUrl });
  issues.push(...cmp.issues);

  const log = readLog().filter((e) => e.slug !== slug).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 4);
  const closing = composeClosing(slug, cmp.benefits, { recentTemplates: log.map((e) => e.template.replace(/\+combine$/, "")), recentTexts: log.map((e) => e.text) });
  const set: OfferSet = {
    slug,
    hotel: { name: profile.name, url: profile.whatahotel_url },
    chain: { name: chain?.name, url: chainUrl },
    checked_at: now,
    status: issues.length ? "needs_review" : "ready",
    benefits: cmp.benefits,
    issues,
    special_offers: hotel.specialOffers,
    restrictions: hotel.restrictions,
    closing,
  };
  await mkdir(offersDir(slug), { recursive: true });
  await writeFile(offersFile(slug), JSON.stringify(set, null, 2) + "\n");
  const next = [...readLog().filter((e) => e.slug !== slug), { slug, template: closing.template, text: closing.text, at: now }];
  await mkdir(path.dirname(LOG()), { recursive: true });
  await writeFile(LOG(), JSON.stringify(next, null, 2) + "\n");
  return set;
}
