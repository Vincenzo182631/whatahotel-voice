import { createHash } from "node:crypto";
import { allClaims } from "../core/profile.js";
import type { Claim, HotelProfile, Source } from "../core/schema.js";
import type { PiHotelRecord } from "./pi-db.js";
import type { WahHotel, WahInfo } from "./wah-api.js";

export interface ImportInput {
  api?: { hotel: WahHotel; info?: WahInfo };
  db?: PiHotelRecord;
  today?: string;
}

export interface MergeResult {
  profile: HotelProfile;
  added: string[];
  updated: string[];
  skipped: string[];
}

const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const shortHash = (t: string) => createHash("sha256").update(norm(t)).digest("hex").slice(0, 8);
const host = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

function listJoin(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/**
 * Adds imported claims to a profile. Rules:
 *  - curated claims (no `origin`) are never changed or removed;
 *  - imported claims get stable ids, so re-importing is idempotent;
 *  - a claim whose text already exists anywhere in the profile is skipped;
 *  - any change sends the profile back to `draft` for a person to review.
 */
export function mergeImport(profile: HotelProfile, input: ImportInput): MergeResult {
  const today = input.today ?? new Date().toISOString().slice(0, 10);
  const next: HotelProfile = structuredClone(profile);
  const added: string[] = [];
  const updated: string[] = [];
  const skipped: string[] = [];

  if (input.api && input.api.hotel.hotelID !== String(profile.whatahotel_id)) {
    throw new Error(`API returned hotel ${input.api.hotel.hotelID}, profile is ${profile.whatahotel_id}`);
  }
  if (input.db && input.db.wahHotelId !== String(profile.whatahotel_id)) {
    throw new Error(`DB returned hotel ${input.db.wahHotelId}, profile is ${profile.whatahotel_id}`);
  }
  const apiCode = input.api?.hotel.amadeusProperty;
  const dbCode = input.db?.amadeusProperty;
  if (apiCode && dbCode && apiCode !== dbCode) {
    throw new Error(`Amadeus code differs between API (${apiCode}) and DB (${dbCode}); refusing to merge`);
  }

  const sourceFor = (url: string, make: () => Omit<Source, "id">): string => {
    const existing = next.sources.find((s) => s.url === url);
    if (existing) return existing.id;
    let n = next.sources.length + 1;
    while (next.sources.some((s) => s.id === `s${n}`)) n++;
    next.sources.push({ id: `s${n}`, ...make() });
    return `s${n}`;
  };

  const known = () => new Map(allClaims(next).map((c) => [norm(c.text), c.id]));

  // Hotel-owned claims from the Price Intelligence research table → facts.
  if (input.db) {
    const siteHost = input.db.websiteUrl ? host(input.db.websiteUrl) : "";
    for (const c of input.db.claims) {
      const id = `db-${shortHash(c.claim)}`;
      const dup = known().get(norm(c.claim));
      if (dup) {
        skipped.push(`${id} (same text as ${dup})`);
        continue;
      }
      const urlHost = host(c.sourceUrl);
      const sid = sourceFor(c.sourceUrl, () => ({
        type: siteHost && urlHost.endsWith(siteHost) ? "official" : "press",
        title: `${urlHost} (${c.motivator})`,
        url: c.sourceUrl,
        accessed: c.fetchedAt.slice(0, 10),
      }));
      const claim: Claim = { id, text: c.claim, source_ids: [sid], origin: "pi-db" };
      next.facts.push(claim);
      added.push(id);
    }
  }

  // Restaurant names from method=info → one machine-owned fact, refreshed in place.
  if (input.api?.info?.restaurants.length) {
    const text = `Restaurants and bars listed for the hotel: ${listJoin(input.api.info.restaurants)}.`;
    const sid = sourceFor(input.api.hotel.url ?? profile.whatahotel_url, () => ({
      type: "whatahotel",
      title: "WhataHotel data API",
      url: input.api!.hotel.url ?? profile.whatahotel_url,
      accessed: today,
    }));
    const id = "api-restaurants";
    const existing = next.facts.find((f) => f.id === id);
    if (existing) {
      if (existing.text !== text) {
        existing.text = text;
        existing.source_ids = [sid];
        updated.push(id);
      }
    } else {
      next.facts.push({ id, text, source_ids: [sid], origin: "wah-api" });
      added.push(id);
    }
  }

  if (added.length || updated.length) next.status = "draft";
  return { profile: next, added, updated, skipped };
}
