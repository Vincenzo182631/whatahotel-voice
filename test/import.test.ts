import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { HotelProfileSchema } from "../src/core/schema.js";
import { importHotel } from "../src/sources/import.js";
import { mergeImport } from "../src/sources/merge.js";
import { loadPiHotel, type PiHotelRecord, type Query } from "../src/sources/pi-db.js";
import { WahClient, type WahHotel } from "../src/sources/wah-api.js";

const profile = () => HotelProfileSchema.parse(JSON.parse(readFileSync("test/fixtures/hotels/test-hotel.json", "utf8")));

const db = (over: Partial<PiHotelRecord> = {}): PiHotelRecord => ({
  wahHotelId: "1",
  name: "Hotel Fixture",
  websiteUrl: "https://hotelfixture.com",
  amadeusProperty: "FIXAAA01",
  researchedAt: "2026-09-20T00:00:00.000Z",
  claims: [
    { motivator: "wellness", claim: "The spa has a hammam and four treatment rooms.", sourceUrl: "https://hotelfixture.com/spa", fetchedAt: "2026-09-20T10:00:00.000Z" },
    { motivator: "dining", claim: "Every room looks straight out to sea.", sourceUrl: "https://press.example.com/a", fetchedAt: "2026-09-20T10:00:00.000Z" },
  ],
  amenities: [{ code: "10", label: "Bathrobe" }],
  ...over,
});

const apiHotel: WahHotel = { hotelID: "1", name: "Hotel Fixture", city: "Testville", url: "https://www.whatahotel.com/hotels/1/test-hotel.html", amadeusProperty: "FIXAAA01" };
const info = { amadeusCode: "FIXAAA01", restaurants: ["Zafferano", "Beach Bar"], amenities: [], degraded: false, raw: {} };

describe("mergeImport", () => {
  it("adds sourced claims, skips duplicates, tags origin, and is idempotent", () => {
    const verified = { ...profile(), status: "verified" as const };
    const first = mergeImport(verified, { db: db(), api: { hotel: apiHotel, info }, today: "2026-10-01" });
    expect(first.added).toHaveLength(2);
    expect(first.skipped[0]).toMatch(/same text as h-views/);
    expect(first.profile.status).toBe("draft");

    const spa = first.profile.facts.find((f) => f.text.includes("hammam"))!;
    expect(spa).toMatchObject({ origin: "pi-db" });
    const spaSource = first.profile.sources.find((s) => s.id === spa.source_ids[0])!;
    expect(spaSource).toMatchObject({ type: "official", url: "https://hotelfixture.com/spa", accessed: "2026-09-20" });
    expect(first.profile.facts.find((f) => f.id === "api-restaurants")?.text).toBe(
      "Restaurants and bars listed for the hotel: Zafferano and Beach Bar.",
    );

    const second = mergeImport({ ...first.profile, status: "verified" }, { db: db(), api: { hotel: apiHotel, info } });
    expect(second.added).toEqual([]);
    expect(second.updated).toEqual([]);
    expect(second.profile.status).toBe("verified");
  });

  it("skips Price Intelligence keyword signals", () => {
    const signal = { motivator: "AMENITIES", claim: 'The property\'s own site mentions "spa"', sourceUrl: "https://hotelfixture.com", fetchedAt: "2026-09-20T10:00:00.000Z" };
    const r = mergeImport(profile(), { db: db({ claims: [signal] }) });
    expect(r.added).toEqual([]);
    expect(r.skipped).toEqual(["1 keyword signal(s) from Price Intelligence (not usable as facts)"]);
  });

  it("never touches curated claims", () => {
    const before = profile();
    const after = mergeImport(before, { db: db() }).profile;
    for (const c of before.facts) expect(after.facts).toContainEqual(c);
  });

  it("refuses data for a different hotel or a conflicting Amadeus code", () => {
    expect(() => mergeImport(profile(), { db: db({ wahHotelId: "2" }) })).toThrow(/DB returned hotel 2/);
    expect(() =>
      mergeImport(profile(), { db: db({ amadeusProperty: "OTHER" }), api: { hotel: apiHotel } }),
    ).toThrow(/Amadeus code differs/);
  });
});

describe("loadPiHotel", () => {
  it("maps rows and returns null for an unknown hotel", async () => {
    const calls: string[] = [];
    const query: Query = async (sql) => {
      calls.push(sql);
      if (sql.includes("FROM hotel WHERE")) {
        return [{ id: "7", name: "Hotel Fixture", website_url: null, amadeus_property: "X", researched_at: new Date("2026-09-20T00:00:00Z") }] as never;
      }
      if (sql.includes("hotel_research_claim")) {
        return [{ motivator: "spa", claim: "c", source_url: "https://a.com", fetched_at: new Date("2026-09-21T00:00:00Z") }] as never;
      }
      return [] as never;
    };
    expect(await loadPiHotel(query, 1)).toMatchObject({
      researchedAt: "2026-09-20T00:00:00.000Z",
      claims: [{ motivator: "spa", sourceUrl: "https://a.com", fetchedAt: "2026-09-21T00:00:00.000Z" }],
    });
    expect(calls.every((s) => /^\s*SELECT/.test(s))).toBe(true);
    expect(await loadPiHotel(async () => [], 1)).toBeNull();
  });
});

describe("importHotel (dry run)", () => {
  it("combines API and DB without writing", async () => {
    const responses = [
      { status: { connection: 1, code: "100", message: "Success" }, hotels: [{ hotelID: "1", name: "Hotel Fixture", city: "Testville", "ama-property": "FIXAAA01" }] },
      { status: { connection: 1, code: "200", message: "Success" }, amadeus: { codes: "WRONG" }, hotel: { DESCSTATUS: "1" } },
    ];
    let i = 0;
    const api = new WahClient({
      apiKey: "k",
      fetchImpl: (async () => new Response(JSON.stringify({ wahData: responses[i++] }))) as typeof fetch,
    });
    const query: Query = async (sql) =>
      (sql.includes("FROM hotel WHERE") ? [{ id: "7", name: "Hotel Fixture", website_url: null, amadeus_property: "FIXAAA01", researched_at: null }] : []) as never;
    const report = await importHotel("test-hotel", { api, db: query, dryRun: true });
    expect(report.warnings).toEqual([
      "info skipped: info identity mismatch for Hotel Fixture: got WRONG, expected FIXAAA01",
      "no research claims stored for this hotel yet",
    ]);
    expect(report.added).toEqual([]);
  });
});
