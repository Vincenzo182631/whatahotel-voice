import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { HOTELS_DIR, validateProfile } from "../core/profile.js";
import type { HotelProfile } from "../core/schema.js";
import { mergeImport, type ImportInput, type MergeResult } from "./merge.js";
import { loadPiHotel, type Query } from "./pi-db.js";
import { fetchHotel, fetchVerifiedInfo, type WahClient } from "./wah-api.js";

export const SOURCES_DIR = path.resolve(process.env.WH_SOURCES_DIR ?? "data/sources");

export interface ImportOptions {
  /** WhataHotel data API client; omit to skip the API. */
  api?: WahClient;
  /** Read-only Price Intelligence query; omit to skip the database. */
  db?: Query;
  dryRun?: boolean;
}

export interface ImportReport extends MergeResult {
  warnings: string[];
}

const json = (v: unknown) => JSON.stringify(v, null, 2) + "\n";

/** Pulls API + DB data for one hotel, snapshots the raw data, and merges claims into its profile. */
export async function importHotel(slug: string, opts: ImportOptions): Promise<ImportReport> {
  const file = path.join(HOTELS_DIR, `${slug}.json`);
  const current = validateProfile(JSON.parse(await readFile(file, "utf8")));
  if (!current.ok || !current.profile) throw new Error(`Invalid profile ${slug}: ${current.errors.join("; ")}`);
  const profile: HotelProfile = current.profile;
  const warnings: string[] = [];
  const input: ImportInput = {};

  if (opts.api) {
    const hotel = await fetchHotel(opts.api, profile.whatahotel_id);
    input.api = { hotel };
    try {
      input.api.info = await fetchVerifiedInfo(opts.api, hotel);
    } catch (err) {
      warnings.push(`info skipped: ${(err as Error).message}`);
    }
    if (!opts.dryRun) {
      await writeFile(
        path.join(SOURCES_DIR, `${slug}.wah-api.json`),
        json({ fetched_at: new Date().toISOString(), hotel, info: input.api.info ?? null }),
      );
    }
  }

  if (opts.db) {
    const record = await loadPiHotel(opts.db, profile.whatahotel_id);
    if (!record) warnings.push(`hotel ${profile.whatahotel_id} is not in the Price Intelligence database`);
    else {
      input.db = record;
      if (!record.claims.length) warnings.push("no research claims stored for this hotel yet");
      if (!opts.dryRun) {
        await writeFile(path.join(SOURCES_DIR, `${slug}.pi-db.json`), json({ fetched_at: new Date().toISOString(), ...record }));
      }
    }
  }

  const result = mergeImport(profile, input);
  const check = validateProfile(result.profile);
  if (!check.ok) throw new Error(`Merged profile is invalid: ${check.errors.join("; ")}`);
  if (!opts.dryRun && (result.added.length || result.updated.length)) await writeFile(file, json(result.profile));
  return { ...result, warnings };
}
