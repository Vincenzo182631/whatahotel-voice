import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Claim, HotelProfile } from "../core/schema.js";
import { VERIFY_DIR, type VerificationReport } from "./report.js";

export async function loadReport(slug: string): Promise<VerificationReport | undefined> {
  try {
    return JSON.parse(await readFile(path.join(VERIFY_DIR, `${slug}.json`), "utf8")) as VerificationReport;
  } catch {
    return undefined;
  }
}

/**
 * The profile as the script writer should see it when only proven claims may be used: claims a
 * source supports, plus WhataHotel's own statements. Unproven and contradicted claims are dropped.
 * The unsourced best_for and positioning lines go too, so the writer builds the audience and the
 * pitch from the proven claims alone. Perks stay (they are WhataHotel's offer).
 */
export function restrictToVerified(profile: HotelProfile, report: VerificationReport): HotelProfile {
  const ok = new Set(report.claims.filter((c) => c.status === "supported" || c.status === "exempt").map((c) => c.claim_id));
  const keep = (claims: Claim[]) => claims.filter((c) => ok.has(c.id));
  const restricted = {
    ...profile,
    positioning: "",
    best_for: [],
    facts: keep(profile.facts),
    highlights: keep(profile.highlights),
    considerations: keep(profile.considerations),
  };
  if (!restricted.considerations.length) {
    throw new Error(`${profile.slug}: no verified consideration to build the "things to know" turn from`);
  }
  if (restricted.facts.length + restricted.highlights.length < 3) {
    throw new Error(`${profile.slug}: fewer than 3 verified facts or highlights; re-run hotel:verify or fix the profile`);
  }
  return restricted;
}
