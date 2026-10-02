import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { HotelProfileSchema, type Claim, type HotelProfile } from "./schema.js";

export const HOTELS_DIR = path.resolve(process.env.WH_HOTELS_DIR ?? "data/hotels");

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  profile?: HotelProfile;
}

/** Schema check plus referential integrity: unique claim ids, every source id resolves. */
export function validateProfile(raw: unknown): ValidationResult {
  const parsed = HotelProfileSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`),
    };
  }
  const profile = parsed.data;
  const errors: string[] = [];
  const sourceIds = new Set(profile.sources.map((s) => s.id));
  const seen = new Set<string>();
  for (const claim of allClaims(profile)) {
    if (seen.has(claim.id)) errors.push(`duplicate claim id "${claim.id}"`);
    seen.add(claim.id);
    for (const sid of claim.source_ids) {
      if (!sourceIds.has(sid)) errors.push(`claim "${claim.id}" cites unknown source "${sid}"`);
    }
  }
  return { ok: errors.length === 0, errors, profile };
}

export function allClaims(profile: HotelProfile): Claim[] {
  return [...profile.facts, ...profile.highlights, ...profile.considerations, ...profile.perks];
}

export async function loadProfile(slug: string): Promise<HotelProfile> {
  const file = path.join(HOTELS_DIR, `${slug}.json`);
  const raw = JSON.parse(await readFile(file, "utf8"));
  const result = validateProfile(raw);
  if (!result.ok || !result.profile) {
    throw new Error(`Invalid profile ${slug}:\n  ${result.errors.join("\n  ")}`);
  }
  return result.profile;
}

export async function listProfileSlugs(): Promise<string[]> {
  const files = await readdir(HOTELS_DIR);
  return files.filter((f) => f.endsWith(".json")).map((f) => f.replace(/\.json$/, "")).sort();
}
