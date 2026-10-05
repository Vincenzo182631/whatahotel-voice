/**
 * Phase 4: upload an approved version to Vercel Blob and record where it lives.
 *
 * Every version is immutable (`takes/<slug>/v<N>/...`, no overwrite) and kept for audit.
 * Hotel pages should embed the stable `takes/<slug>/current/...` copy instead: publishing
 * a newer version overwrites `current`, so a refreshed clip reaches the page with no page
 * edit. The widget needs only the transcript URL: audio.mp3 sits beside it.
 */
import { put as vercelPut } from "@vercel/blob";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { readMetadata, setStatus, versionDir } from "../storage/local.js";

export type PutFn = (
  pathname: string,
  body: Buffer,
  opts: { access: "public"; addRandomSuffix: false; allowOverwrite: boolean; contentType: string; cacheControlMaxAge: number },
) => Promise<{ url: string }>;

export interface PublishedManifest {
  hotel_slug: string;
  version: number;
  published_at: string;
  /** Immutable URLs of this exact version. */
  audio_url: string;
  transcript_url: string;
  /** Stable URLs that always serve the latest published version. */
  current_audio_url?: string;
  current_transcript_url?: string;
  /** Embed snippet for the hotel page: uses `current` when it exists. */
  embed: string;
}

const FILES = [
  { name: "audio.mp3", contentType: "audio/mpeg" },
  { name: "transcript.json", contentType: "application/json" },
] as const;

export function blobPath(slug: string, version: number, file: string): string {
  return `takes/${slug}/v${version}/${file}`;
}

export function currentPath(slug: string, file: string): string {
  return `takes/${slug}/current/${file}`;
}

/** How long browsers and the CDN may keep `current` before a refreshed clip shows up. */
const CURRENT_CACHE_SECONDS = 300;

export function embedSnippet(scriptUrl: string, transcriptUrl: string): string {
  return `<script src="${scriptUrl}" data-transcript="${transcriptUrl}"></script>`;
}

export interface PublishOptions {
  /** Where wah-take.js is hosted; goes into the embed snippet. */
  scriptUrl: string;
  put?: PutFn;
  now?: Date;
  /** Also point `current` at this version (default true). */
  setCurrent?: boolean;
}

async function upload(put: PutFn, slug: string, version: number, dir: string, current: boolean): Promise<Record<string, string>> {
  const urls: Record<string, string> = {};
  for (const f of FILES) {
    const body = await readFile(path.join(dir, f.name));
    const res = await put(current ? currentPath(slug, f.name) : blobPath(slug, version, f.name), body, {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: current,
      contentType: f.contentType,
      cacheControlMaxAge: current ? CURRENT_CACHE_SECONDS : 31536000,
    });
    urls[f.name] = res.url;
  }
  return urls;
}

async function readManifest(dir: string): Promise<Partial<PublishedManifest>> {
  try {
    return JSON.parse(await readFile(path.join(dir, "published.json"), "utf8"));
  } catch {
    return {};
  }
}

/** Uploads an approved version (immutable copy first, then `current`) and marks it published. */
export async function publishTake(slug: string, version: number, opts: PublishOptions): Promise<PublishedManifest> {
  const meta = await readMetadata(slug, version);
  if (meta.status !== "approved") {
    throw new Error(`${slug} v${version} is ${meta.status}; only approved versions can be published`);
  }
  const put = opts.put ?? (vercelPut as unknown as PutFn);
  const dir = versionDir(slug, version);
  const versioned = await upload(put, slug, version, dir, false);
  const current = opts.setCurrent === false ? undefined : await upload(put, slug, version, dir, true);
  const manifest = buildManifest(slug, version, versioned, current, opts);
  await writeFile(path.join(dir, "published.json"), JSON.stringify(manifest, null, 2) + "\n");
  await setStatus(slug, version, "published");
  return manifest;
}

/**
 * Points `current` at an already published (or approved, with its immutable copy already
 * uploaded) version, without touching the immutable blobs. Used to adopt `current` for clips
 * published before it existed, and to roll `current` back to an older version.
 */
export async function promoteToCurrent(slug: string, version: number, opts: PublishOptions): Promise<PublishedManifest> {
  const meta = await readMetadata(slug, version);
  if (meta.status !== "approved" && meta.status !== "published") {
    throw new Error(`${slug} v${version} is ${meta.status}; only approved or published versions can be made current`);
  }
  const put = opts.put ?? (vercelPut as unknown as PutFn);
  const dir = versionDir(slug, version);
  const current = await upload(put, slug, version, dir, true);
  const prior = await readManifest(dir);
  const baseUrl = new URL(current["audio.mp3"]!).origin;
  const versioned = {
    "audio.mp3": prior.audio_url ?? `${baseUrl}/${blobPath(slug, version, "audio.mp3")}`,
    "transcript.json": prior.transcript_url ?? `${baseUrl}/${blobPath(slug, version, "transcript.json")}`,
  };
  const manifest = buildManifest(slug, version, versioned, current, { ...opts, now: prior.published_at ? new Date(prior.published_at) : opts.now });
  await writeFile(path.join(dir, "published.json"), JSON.stringify(manifest, null, 2) + "\n");
  if (meta.status === "approved") await setStatus(slug, version, "published");
  return manifest;
}

function buildManifest(
  slug: string,
  version: number,
  versioned: Record<string, string>,
  current: Record<string, string> | undefined,
  opts: PublishOptions,
): PublishedManifest {
  const transcript = current?.["transcript.json"] ?? versioned["transcript.json"]!;
  return {
    hotel_slug: slug,
    version,
    published_at: (opts.now ?? new Date()).toISOString(),
    audio_url: versioned["audio.mp3"]!,
    transcript_url: versioned["transcript.json"]!,
    ...(current && { current_audio_url: current["audio.mp3"], current_transcript_url: current["transcript.json"] }),
    embed: embedSnippet(opts.scriptUrl, transcript),
  };
}
