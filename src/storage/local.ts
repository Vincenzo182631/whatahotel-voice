import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  MetadataSchema,
  SPEAKERS,
  type HotelProfile,
  type Metadata,
  type ReviewStatus,
  type Script,
} from "../core/schema.js";

export const OUTPUT_DIR = path.resolve(process.env.WH_OUTPUT_DIR ?? "output");

/**
 * Layout, one folder per generation so nothing is ever overwritten:
 *   output/<slug>/v<N>/audio.mp3
 *                      transcript.json   (what the player and SEO use)
 *                      script.json       (with claim ids, for review)
 *                      source-profile.json (profile snapshot used)
 *                      metadata.json     (status, provider, timings, fact check)
 */
export function versionDir(slug: string, version: number): string {
  return path.join(OUTPUT_DIR, slug, `v${version}`);
}

export async function listVersions(slug: string): Promise<number[]> {
  try {
    const entries = await readdir(path.join(OUTPUT_DIR, slug));
    return entries
      .map((e) => /^v(\d+)$/.exec(e)?.[1])
      .filter((v): v is string => v !== undefined)
      .map(Number)
      .sort((a, b) => a - b);
  } catch {
    return [];
  }
}

export async function nextVersion(slug: string): Promise<number> {
  const versions = await listVersions(slug);
  return (versions[versions.length - 1] ?? 0) + 1;
}

export function buildTranscript(profile: HotelProfile, script: Script) {
  const usedClaims = new Set(script.turns.flatMap((t) => t.claim_ids));
  const sourceIds = new Set(
    [...profile.facts, ...profile.highlights, ...profile.considerations]
      .filter((c) => usedClaims.has(c.id))
      .flatMap((c) => c.source_ids),
  );
  return {
    hotel: { slug: profile.slug, name: profile.name, whatahotel_url: profile.whatahotel_url },
    title: script.title,
    speakers: Object.fromEntries(Object.entries(SPEAKERS).map(([k, v]) => [k, v.name])),
    turns: script.turns.map((t) => ({ speaker: t.speaker, name: SPEAKERS[t.speaker].name, text: t.text })),
    short_version: script.short_version,
    sources: profile.sources.filter((s) => sourceIds.has(s.id)).map(({ title, url }) => ({ title, url })),
  };
}

export interface SaveInput {
  profile: HotelProfile;
  script: Script;
  audio?: Buffer;
  metadata: Metadata;
}

export async function saveVersion({ profile, script, audio, metadata }: SaveInput): Promise<string> {
  const dir = versionDir(profile.slug, metadata.version);
  await mkdir(dir, { recursive: true });
  const json = (v: unknown) => JSON.stringify(v, null, 2) + "\n";
  await writeFile(path.join(dir, "script.json"), json(script));
  await writeFile(path.join(dir, "transcript.json"), json(buildTranscript(profile, script)));
  await writeFile(path.join(dir, "source-profile.json"), json(profile));
  await writeFile(path.join(dir, "metadata.json"), json(MetadataSchema.parse(metadata)));
  if (audio) await writeFile(path.join(dir, "audio.mp3"), audio);
  return dir;
}

export async function readMetadata(slug: string, version: number): Promise<Metadata> {
  const raw = await readFile(path.join(versionDir(slug, version), "metadata.json"), "utf8");
  return MetadataSchema.parse(JSON.parse(raw));
}

export async function readScript(slug: string, version: number): Promise<Script> {
  return JSON.parse(await readFile(path.join(versionDir(slug, version), "script.json"), "utf8"));
}

const TRANSITIONS: Record<ReviewStatus, ReviewStatus[]> = {
  generated: ["needs_review", "rejected"],
  needs_review: ["approved", "rejected"],
  approved: ["published", "rejected"],
  published: ["rejected"],
  rejected: [],
};

export async function setStatus(slug: string, version: number, status: ReviewStatus, note?: string): Promise<Metadata> {
  const meta = await readMetadata(slug, version);
  if (!TRANSITIONS[meta.status].includes(status)) {
    throw new Error(`Cannot move v${version} from ${meta.status} to ${status}`);
  }
  const updated = { ...meta, status, ...(note && { review_note: note }) };
  await writeFile(path.join(versionDir(slug, version), "metadata.json"), JSON.stringify(updated, null, 2) + "\n");
  return updated;
}
