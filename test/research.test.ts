import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

const tmp = vi.hoisted(() => {
  const fs = require("node:fs") as typeof import("node:fs");
  const os = require("node:os") as typeof import("node:os");
  const p = require("node:path") as typeof import("node:path");
  const root = fs.mkdtempSync(p.join(os.tmpdir(), "wah-research-"));
  process.env.WH_VERIFY_CACHE = p.join(root, "cache");
  process.env.WH_RESEARCH_DIR = p.join(root, "research");
  process.env.WH_FIRECRAWL_GAP_MS = "0";
  process.env.WH_HOTELS_DIR = p.join(root, "hotels");
  return root;
});

import { Budget, BudgetExceeded, limitsFromEnv } from "../src/research/budget.js";
import { chainOfHost, chainOfName, chainsOfHost, hostBelongsTo, isThirdParty } from "../src/research/chains.js";
import { tierOf } from "../src/verify/evidence.js";
import { pickPages } from "../src/research/discover.js";
import { assessPage, baseUrlFor, englishUrl, rankCandidates, resolveOfficialSite, type IdentityDeps } from "../src/research/identity.js";
import { assertResearchReady, importResearch, loadHotelRef, researchDir, runResearch } from "../src/research/research.js";
import { FirecrawlClient } from "../src/sources/firecrawl.js";

const FS = { name: "Four Seasons Hotel Sydney", city: "Sydney", country: "Australia" };
const filler = "A long welcoming paragraph about the harbour setting and the neighbourhood around it. ".repeat(6);

describe("chains", () => {
  it("matches chains by name and host, and flags third-party sites", () => {
    expect(chainOfName("Four Seasons Hotel Sydney")?.id).toBe("four-seasons");
    expect(chainOfName("Il San Pietro di Positano")).toBeUndefined();
    expect(chainOfHost("www.mandarinoriental.com")?.id).toBe("mandarin-oriental");
    expect(isThirdParty("www.booking.com")).toBe(true);
    expect(isThirdParty("www.whatahotel.com")).toBe(true);
    expect(isThirdParty("www.ilsanpietro.it")).toBe(false);
  });
  it("keeps each chain's pages to its own properties, with parent-company sites as secondary", () => {
    expect(chainOfName("The Ritz-Carlton, Kapalua")?.id).toBe("ritz-carlton");
    expect(chainOfName("Mandapa, a Ritz-Carlton Reserve")?.id).toBe("ritz-carlton");
    expect(hostBelongsTo("ritz-carlton", "www.ritzcarlton.com")).toBe(true);
    expect(hostBelongsTo("ritz-carlton", "www.marriott.com")).toBe(true);
    expect(hostBelongsTo("ritz-carlton", "www.fourseasons.com")).toBe(false);
    expect(hostBelongsTo("four-seasons", "www.ritzcarlton.com")).toBe(false);
    expect(chainOfHost("www.marriott.com")?.id).toBe("marriott");
    expect(chainsOfHost("www.marriott.com").map((c) => c.id)).toEqual(expect.arrayContaining(["ritz-carlton", "marriott"]));
    expect(tierOf("https://www.ritzcarlton.com/en/hotels/jhmrz-the-ritz-carlton-maui-kapalua/overview/")).toBe("official");
    expect(tierOf("https://www.tripadvisor.com/Hotel_Review-x")).toBe("press");
  });
  it("finds the Ritz-Carlton property section and rejects its editorial pages", () => {
    const aff = { kind: "chain" as const, chain: "ritz-carlton" };
    expect(baseUrlFor("https://www.ritzcarlton.com/en/hotels/jhmrz-the-ritz-carlton-maui-kapalua/overview/", aff)).toBe("https://www.ritzcarlton.com/en/hotels/jhmrz-the-ritz-carlton-maui-kapalua/");
    const r = assessPage({ name: "The Ritz-Carlton, Kapalua", city: "Kapalua", country: "United States" }, aff, { url: "https://www.ritzcarlton.com/en/journey/destination-guides/us-and-canada/a-tale-of-two-islands/", text: `The Ritz-Carlton Kapalua ${filler} Kapalua` });
    expect(r.ok).toBe(false);
    expect(r.reasons.join(" ")).toMatch(/landing page/);
  });
  it("treats language versions of one property page as the same hotel", async () => {
    expect(englishUrl("https://www.ritzcarlton.com/zh-cn/hotels/jzhrz-rissai-valley/")).toBe("https://www.ritzcarlton.com/en/hotels/jzhrz-rissai-valley/");
    expect(englishUrl("https://www.ritzcarlton.com/en/hotels/x/")).toBe("https://www.ritzcarlton.com/en/hotels/x/");
    const hotel = { name: "Rissai Valley, a Ritz-Carlton Reserve", city: "Jiuzhaigou", country: "China" };
    const id = await resolveOfficialSite(hotel, {
      search: async () => [
        { url: "https://www.ritzcarlton.com/en/hotels/jzhrz-rissai-valley-a-ritz-carlton-reserve/", title: "Rissai Valley" },
        { url: "https://www.ritzcarlton.com/zh-cn/hotels/jzhrz-rissai-valley-a-ritz-carlton-reserve/", title: "Rissai Valley" },
      ],
      load: async () => `Rissai Valley, a Ritz-Carlton Reserve in Jiuzhaigou, China. ${filler}`,
      resolveUrl: async (u) => u,
    });
    expect(id.status).toBe("confirmed");
    expect(id.official_url).toMatch(/\/en\/hotels\/jzhrz/);
  });
  it("finds a property's own section per chain", () => {
    expect(baseUrlFor("https://www.fourseasons.com/sydney/dining/", { kind: "chain", chain: "four-seasons" })).toBe("https://www.fourseasons.com/sydney/");
    expect(baseUrlFor("https://www.mandarinoriental.com/en/hong-kong/victoria-harbour/stay", { kind: "chain", chain: "mandarin-oriental" })).toBe("https://www.mandarinoriental.com/en/hong-kong/victoria-harbour/");
    expect(baseUrlFor("https://www.ilsanpietro.it/en/rooms", { kind: "independent" })).toBe("https://www.ilsanpietro.it/");
  });
});

describe("rankCandidates", () => {
  it("drops third-party and other-chain sites and prefers the matching property", () => {
    const chain = chainOfName(FS.name)!;
    const r = rankCandidates(
      FS,
      [
        { url: "https://www.booking.com/hotel/au/four-seasons-sydney.html", title: "Four Seasons Sydney" },
        { url: "https://www.mandarinoriental.com/en/sydney/x", title: "Sydney" },
        { url: "https://www.fourseasons.com/sydney/", title: "Four Seasons Hotel Sydney" },
        { url: "https://www.fourseasons.com/melbourne/", title: "Four Seasons Melbourne" },
      ],
      chain,
    );
    expect(r.map((c) => c.url)).toEqual(["https://www.fourseasons.com/sydney/", "https://www.fourseasons.com/melbourne/"]);
  });
});

describe("assessPage", () => {
  const aff = { kind: "chain" as const, chain: "four-seasons" };
  it("confirms a page that names the hotel and its city on the chain's own domain", () => {
    const r = assessPage(FS, aff, { url: "https://www.fourseasons.com/sydney/", text: `# Four Seasons Hotel Sydney\n${filler} Sydney` });
    expect(r.ok).toBe(true);
    expect(r.checks.name_coverage).toBeGreaterThanOrEqual(0.75);
  });
  it("refuses another chain's domain for a Four Seasons hotel", () => {
    const r = assessPage(FS, aff, { url: "https://www.mandarinoriental.com/en/sydney/x", text: `Four Seasons Hotel Sydney ${filler} Sydney` });
    expect(r.ok).toBe(false);
    expect(r.reasons.join(" ")).toMatch(/does not belong to Four Seasons/);
  });
  it("refuses a different property in the same destination", () => {
    const r = assessPage(FS, aff, { url: "https://www.fourseasons.com/melbourne/", text: `# Four Seasons Hotel Melbourne\n${filler} Melbourne` });
    expect(r.ok).toBe(false);
  });
  it("accepts a rebranded property only when the page ties the old name to the new one", () => {
    const hotel = { name: "The Sireya Desaru Coast", city: "Desaru Coast", country: "Malaysia" };
    const aff2 = { kind: "unknown" as const };
    const ok = assessPage(hotel, aff2, { url: "https://www.mandarinoriental.com/en/desaru-coast/desaru", text: `Mandarin Oriental, Desaru Coast, formerly The Sireya Desaru Coast, is a resort. ${filler}` });
    expect(ok.ok).toBe(true);
    expect(ok.checks.rebrand).toMatch(/formerly/i);
    expect(ok.evidence.join(" ")).toMatch(/rebrand noted/);
    const bad = assessPage(hotel, aff2, { url: "https://www.mandarinoriental.com/en/desaru-coast/desaru", text: `Mandarin Oriental, Desaru Coast is a resort in Desaru Coast, Malaysia. ${filler}` });
    expect(bad.ok).toBe(false);
  });
  it("never accepts a third-party site as official", () => {
    expect(assessPage(FS, { kind: "independent" }, { url: "https://www.tripadvisor.com/Hotel_Review", text: `Four Seasons Hotel Sydney ${filler} Sydney` }).ok).toBe(false);
  });
});

describe("resolveOfficialSite", () => {
  const deps = (over: Partial<IdentityDeps> = {}): IdentityDeps => ({
    search: async () => [{ url: "https://www.hotelrossi.example/", title: "Hotel Rossi Positano" }],
    load: async () => `# Hotel Rossi\nWelcome to Hotel Rossi in Positano, Italy. ${filler}`,
    resolveUrl: async (u) => u,
    now: () => new Date("2026-10-09T00:00:00Z"),
    ...over,
  });
  const rossi = { name: "Hotel Rossi", city: "Positano", country: "Italy" };

  it("confirms an independent hotel's own site and follows redirects", async () => {
    const id = await resolveOfficialSite(rossi, deps({ resolveUrl: async () => "https://www.hotelrossi.example/en/" }));
    expect(id.status).toBe("confirmed");
    expect(id.affiliation.kind).toBe("independent");
    expect(id.official_url).toBe("https://www.hotelrossi.example/en/");
    expect(id.evidence.join(" ")).toMatch(/redirected/);
  });
  it("flags the hotel for review instead of guessing when nothing confirms", async () => {
    const id = await resolveOfficialSite(rossi, deps({ load: async () => `A page about a different hotel in Milan. ${filler}` }));
    expect(id.status).toBe("needs_review");
    expect(id.official_url).toBeUndefined();
  });
  it("flags review when two properties of the chain match alike in one destination", async () => {
    const hk = { name: "Mandarin Oriental, Hong Kong", city: "Hong Kong", country: "China" };
    const id = await resolveOfficialSite(hk, deps({
      search: async () => [
        { url: "https://www.mandarinoriental.com/en/hong-kong/victoria-harbour", title: "Mandarin Oriental, Hong Kong" },
        { url: "https://www.mandarinoriental.com/en/hong-kong/landmark", title: "Mandarin Oriental, Hong Kong Landmark" },
      ],
    }));
    expect(id.status).toBe("needs_review");
    expect(id.reasons.join(" ")).toMatch(/several Mandarin Oriental properties/);
    expect(id.candidates).toHaveLength(2);
  });
  it("rejects a chain's city landing page as the property page", () => {
    const r = assessPage({ name: "Mandarin Oriental, Hong Kong", city: "Hong Kong", country: "China" }, { kind: "chain", chain: "mandarin-oriental" }, { url: "https://www.mandarinoriental.com/en/hong-kong", text: `Mandarin Oriental Hong Kong ${filler}` });
    expect(r.ok).toBe(false);
    expect(r.reasons.join(" ")).toMatch(/landing page/);
  });
  it("flags review when search finds only aggregators", async () => {
    const id = await resolveOfficialSite(rossi, deps({ search: async () => [{ url: "https://www.booking.com/hotel/it/rossi.html", title: "Hotel Rossi" }] }));
    expect(id.status).toBe("needs_review");
    expect(id.reasons.join(" ")).toMatch(/no candidate/);
  });
});

describe("pickPages", () => {
  const home = `[Rooms & Suites](/en/rome/rossi/rooms) [Dining](/en/rome/rossi/dining) [Spa](https://www.x.example/en/rome/rossi/spa) [Offers](/en/rome/rossi/offers) [Other hotel](/en/paris/other/rooms) [Book](/en/rome/rossi/book) [Deep](/en/rome/rossi/a/b/c/d) [FAQ](/en/rome/rossi/faq)`;
  it("keeps same-property pages in priority order and drops offers, booking and other properties", () => {
    expect(pickPages(home, "https://www.x.example/en/rome/rossi/", 10)).toEqual([
      "https://www.x.example/en/rome/rossi/rooms/",
      "https://www.x.example/en/rome/rossi/dining/",
      "https://www.x.example/en/rome/rossi/spa/",
      "https://www.x.example/en/rome/rossi/faq/",
    ]);
  });
});

describe("Budget", () => {
  it("refuses calls and pages past the limits and tracks usage", () => {
    const b = new Budget({ maxPages: 2, maxFirecrawlCalls: 1, maxRetries: 3, maxChars: 100 });
    b.firecrawl("search");
    expect(() => b.firecrawl()).toThrow(BudgetExceeded);
    b.addPage(40);
    expect(() => b.addPage(70)).toThrow(/characters/);
    b.addPage(40);
    expect(() => b.addPage(1)).toThrow(/pages/);
    expect(b.usage).toMatchObject({ firecrawl_calls: 1, firecrawl_searches: 1, pages: 2, chars: 80, est_claude_tokens: 20 });
  });
  it("reads limits from env with overrides", () => {
    expect(limitsFromEnv({ WH_RESEARCH_MAX_PAGES: "5" }, { maxChars: 9 })).toMatchObject({ maxPages: 5, maxFirecrawlCalls: 20, maxRetries: 3, maxChars: 9 });
  });
});

// ---- end to end with a mocked Firecrawl: independent hotel ----
function profileFile(slug: string) {
  const dir = path.join(tmp, "hotels");
  mkdirSync(dir, { recursive: true });
  const claim = (id: string) => ({ id, text: `claim ${id}`, source_ids: ["s1"] });
  const profile = {
    slug, whatahotel_id: 1, whatahotel_url: "https://www.whatahotel.com/hotels/1/x.html", name: "Hotel Rossi",
    location: { city: "Positano", country: "Italy" }, category: "boutique", positioning: "x", best_for: ["x"],
    facts: [claim("f-1"), claim("f-2"), claim("f-3")], highlights: [claim("h-1"), claim("h-2")], considerations: [claim("c-1")],
    sources: [{ id: "s1", type: "whatahotel", title: "WAH", accessed: "2026-10-09" }], status: "draft", last_verified: "2026-10-09",
  };
  writeFileSync(path.join(dir, `${slug}.json`), JSON.stringify(profile));
  return dir;
}

describe("runResearch + importResearch (independent hotel, mocked Firecrawl)", () => {
  const page = (title: string, body: string) => `# ${title}\n${body}\n${filler}`;
  const pages: Record<string, string> = {
    "https://www.hotelrossi.example/": `${page("Hotel Rossi Positano", "Welcome to Hotel Rossi in Positano, Italy.")}\n[Rooms](/rooms) [Dining](/dining) [Offers](/offers)`,
    "https://www.hotelrossi.example/rooms/": page("Rooms", "Hotel Rossi has a rooftop terrace overlooking the Amalfi Coast. The terrace has a plunge pool."),
    "https://www.hotelrossi.example/dining/": page("Dining", "Hotel Rossi serves breakfast on the terrace. The best restaurant in Italy awaits."),
  };
  const mkFc = () => {
    const scrape = vi.fn(async (url: string) => {
      if (!pages[url]) throw new Error(`Firecrawl 404 for ${url}`);
      return { url, markdown: pages[url] };
    });
    const search = vi.fn(async () => [{ url: "https://www.booking.com/x", title: "Hotel Rossi" }, { url: "https://www.hotelrossi.example/", title: "Hotel Rossi Positano" }]);
    return { fc: { scrape, search } as unknown as FirecrawlClient, scrape, search };
  };

  it("confirms the site, reads the property pages within limits, and imports only verified facts", async () => {
    const slug = "hotel-rossi";
    process.env.WH_HOTELS_DIR = profileFile(slug);
    const { fc, scrape } = mkFc();
    const budget = new Budget(limitsFromEnv({}, { maxPages: 5, maxFirecrawlCalls: 10 }));
    const rec = await runResearch(slug, { fc, budget, resolveUrl: async (u) => u });
    if (rec.identity.status !== "confirmed") throw new Error(JSON.stringify(rec.identity.reasons));
    expect(rec.status).toBe("awaiting_extraction");
    expect(rec.pages.map((p) => p.url)).toEqual(["https://www.hotelrossi.example/", "https://www.hotelrossi.example/rooms/", "https://www.hotelrossi.example/dining/"]);
    expect(rec.usage.firecrawl_calls).toBeLessThanOrEqual(10);
    // cached second run costs no more Firecrawl scrapes
    const before = scrape.mock.calls.length;
    await runResearch(slug, { fc, budget: new Budget(limitsFromEnv({})), resolveUrl: async (u) => u });
    expect(scrape.mock.calls.length).toBe(before);

    const dir = researchDir(slug);
    const facts = {
      facts: [
        { id: "r-1", category: "rooms", kind: "fact", text: "The hotel has a rooftop terrace overlooking the Amalfi Coast.", doc_id: "p2", excerpt: "rooftop terrace overlooking the Amalfi Coast" },
        { id: "r-2", category: "amenities", kind: "fact", text: "The terrace has a plunge pool.", doc_id: "p2", excerpt: "The terrace has a plunge pool" , topic: "pool" },
        { id: "r-3", category: "dining", kind: "fact", text: "Breakfast is served on the terrace.", doc_id: "p3", excerpt: "serves breakfast on the terrace" },
        { id: "r-4", category: "dining", kind: "fact", text: "It has the best restaurant in Italy.", doc_id: "p3", excerpt: "The best restaurant in Italy awaits" },
        { id: "r-5", category: "rooms", kind: "fact", text: "The hotel has 40 suites.", doc_id: "p2", excerpt: "forty suites with sea views" },
        { id: "r-6", category: "practical", kind: "fact", text: "It was renovated recently.", doc_id: "p1", excerpt: "Welcome to Hotel Rossi in Positano" },
      ],
      highlights: ["r-1", "r-3", "r-4", "r-5"],
      contradictions: [{ topic: "pool", note: "two pool counts", sources: [{ doc_id: "p2", excerpt: "The terrace has a plunge pool" }] }],
    };
    writeFileSync(path.join(dir, "facts.json"), JSON.stringify(facts));
    const res = await importResearch(slug, path.join(dir, "facts.json"));
    expect(res.verified_facts.map((f) => f.id)).toEqual(["r-1", "r-3"]);
    expect(res.rejected.map((f) => f.id)).toEqual(["r-5"]); // excerpt not in the page
    expect(res.subjective.map((f) => f.id)).toEqual(["r-4"]); // promotional
    expect(res.unresolved.map((f) => f.id).sort()).toEqual(["r-2", "r-6"]); // disputed + undated time-bound
    expect(res.highlights).toEqual(["r-1", "r-3"]);
    expect(res.status).toBe("needs_review"); // fewer than 5 verified facts
    await expect(assertResearchReady(slug)).rejects.toThrow(/Needs review/);
  });

  it("saves progress and flags review when a limit is reached", async () => {
    const slug = "hotel-rossi";
    const { fc } = mkFc();
    const rec = await runResearch(slug, { fc, budget: new Budget(limitsFromEnv({}, { maxPages: 1 })), refresh: true, resolveUrl: async (u) => u });
    expect(rec.pages).toHaveLength(1);
    expect(rec.reasons.join(" ")).toMatch(/limit reached.*progress saved/);
  });

  it("gives Needs review, not a guess, when the official site cannot be confirmed", async () => {
    const slug = "hotel-rossi";
    const fc = { scrape: vi.fn(async (url: string) => ({ url, markdown: `Some unrelated page about a hotel in Milan. ${filler}` })), search: vi.fn(async () => [{ url: "https://www.other.example/", title: "Hotel Rossi" }]) } as unknown as FirecrawlClient;
    const rec = await runResearch(slug, { fc, budget: new Budget(limitsFromEnv({})), refresh: true, resolveUrl: async (u) => u });
    expect(rec.status).toBe("needs_review");
    expect(rec.identity.official_url).toBeUndefined();
    expect(JSON.parse(readFileSync(path.join(researchDir(slug), "research.json"), "utf8")).status).toBe("needs_review");
  });
});

describe("loadHotelRef", () => {
  it("falls back to the scraped WhataHotel page when there is no profile yet", async () => {
    const dir = path.join(tmp, "sources");
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, "new-hotel.whatahotel.json"), JSON.stringify({ name: "The Ritz-Carlton, Kapalua", address: { city: "Kapalua", country: "United States" } }));
    process.env.WH_SOURCES_DIR = dir;
    expect(await loadHotelRef("new-hotel")).toEqual({ name: "The Ritz-Carlton, Kapalua", location: { city: "Kapalua", country: "United States" } });
    await expect(loadHotelRef("missing-hotel")).rejects.toThrow(/hotel:scrape/);
  });
});
