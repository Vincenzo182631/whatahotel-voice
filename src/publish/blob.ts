/**
 * Phase 4: upload an approved version to Vercel Blob and record where it lives.
 *
 * Blobs are immutable per version (`takes/<slug>/v<N>/...`, no overwrite), so a
 * published URL never changes under a hotel page. The widget needs only the
 * transcript URL: audio.mp3 sits beside it.
 */
import { put as vercelPut } from "@vercel/blob";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { readMetadata, setStatus, versionDir } from "../storage/local.js";

export type PutFn = (
  pathname: string,
  body: Buffer,
  opts: { access: "public"; addRandomSuffix: false; allowOverwrite: false; contentType: string; cacheControlMaxAge: number },
) => Promise<{ url: string }>;

export interface PublishedManifest {
  hotel_slug: string;
  version: number;
  published_at: string;
  audio_url: string;
  transcript_url: string;
  embed: string;
}

const FILES = [
  { name: "audio.mp3", contentType: "audio/mpeg" },
  { name: "transcript.json", contentType: "application/json" },
] as const;

export function blobPath(slug: string, version: number, file: string): string {
  return `takes/${slug}/v${version}/${file}`;
}

export function embedSnippet(scriptUrl: string, transcriptUrl: string): string {
  return `<script src="${scriptUrl}" data-transcript="${transcriptUrl}"></script>`;
}

export interface PublishOptions {
  /** Where wah-take.js is hosted; goes into the embed snippet. */
  scriptUrl: string;
  put?: PutFn;
  now?: Date;
}

export async function publishTake(slug: string, version: number, opts: PublishOptions): Promise<PublishedManifest> {
  const meta = await readMetadata(slug, version);
  if (meta.status !== "approved") {
    throw new Error(`${slug} v${version} is ${meta.status}; only approved versions can be published`);
  }
  const put = opts.put ?? (vercelPut as unknown as PutFn);
  const dir = versionDir(slug, version);
  const urls: Record<string, string> = {};
  for (const f of FILES) {
    const body = await readFile(path.join(dir, f.name));
    const res = await put(blobPath(slug, version, f.name), body, {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: false,
      contentType: f.contentType,
      cacheControlMaxAge: 31536000,
    });
    urls[f.name] = res.url;
  }
  const manifest: PublishedManifest = {
    hotel_slug: slug,
    version,
    published_at: (opts.now ?? new Date()).toISOString(),
    audio_url: urls["audio.mp3"]!,
    transcript_url: urls["transcript.json"]!,
    embed: embedSnippet(opts.scriptUrl, urls["transcript.json"]!),
  };
  await writeFile(path.join(dir, "published.json"), JSON.stringify(manifest, null, 2) + "\n");
  await setStatus(slug, version, "published");
  return manifest;
}
