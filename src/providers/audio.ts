import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

/** Re-encode any audio ffmpeg can read into the delivery format (MP3, 44.1 kHz mono, 128k). */
export async function toMp3(input: Buffer, inputExt: string): Promise<Buffer> {
  return withTmp(async (dir) => {
    const src = path.join(dir, `in.${inputExt}`);
    const out = path.join(dir, "out.mp3");
    await writeFile(src, input);
    await run("ffmpeg", ["-y", "-loglevel", "error", "-i", src, "-ac", "1", "-ar", "44100", "-b:a", "128k", out]);
    return readFile(out);
  });
}

/** Joins MP3 segments with a short gap between them. */
export async function concatMp3(segments: Buffer[], gapSeconds = 0.25): Promise<Buffer> {
  if (segments.length === 1) return segments[0]!;
  return withTmp(async (dir) => {
    const inputs: string[] = [];
    for (const [i, seg] of segments.entries()) {
      const file = path.join(dir, `seg${i}.mp3`);
      await writeFile(file, seg);
      inputs.push("-i", file);
    }
    const gap = `aevalsrc=0:d=${gapSeconds}:s=44100`;
    const parts = segments.map((_, i) => `[${i}:a]aresample=44100,aformat=channel_layouts=mono[a${i}]`);
    const chain: string[] = [];
    segments.forEach((_, i) => {
      chain.push(`[a${i}]`);
      if (i < segments.length - 1) {
        parts.push(`${gap}[g${i}]`);
        chain.push(`[g${i}]`);
      }
    });
    const filter = `${parts.join(";")};${chain.join("")}concat=n=${chain.length}:v=0:a=1[out]`;
    const out = path.join(dir, "out.mp3");
    await run("ffmpeg", ["-y", "-loglevel", "error", ...inputs, "-filter_complex", filter, "-map", "[out]", "-b:a", "128k", out]);
    return readFile(out);
  });
}

export async function durationSeconds(audio: Buffer): Promise<number> {
  return withTmp(async (dir) => {
    const file = path.join(dir, "probe.mp3");
    await writeFile(file, audio);
    const { stdout } = await run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]);
    return Math.round(Number.parseFloat(stdout.trim()) * 10) / 10;
  });
}

/** A tone of the given length; used by the mock provider. */
export async function tone(seconds: number, frequency: number): Promise<Buffer> {
  return withTmp(async (dir) => {
    const out = path.join(dir, "tone.mp3");
    await run("ffmpeg", [
      "-y", "-loglevel", "error", "-f", "lavfi",
      "-i", `sine=frequency=${frequency}:duration=${seconds}:sample_rate=44100`,
      "-af", "volume=0.15", "-ac", "1", "-b:a", "64k", out,
    ]);
    return readFile(out);
  });
}

async function withTmp<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(path.join(tmpdir(), "wh-audio-"));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
