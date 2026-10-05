import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

let dir: string;
beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "wah-pub-"));
  process.env.WH_OUTPUT_DIR = dir;
});

async function seed(slug: string, status: string) {
  const v = path.join(dir, slug, "v1");
  await mkdir(v, { recursive: true });
  await writeFile(path.join(v, "audio.mp3"), "mp3");
  await writeFile(path.join(v, "transcript.json"), "{}");
  await writeFile(
    path.join(v, "metadata.json"),
    JSON.stringify({
      hotel_slug: slug, version: 1, status, generated_at: new Date(0).toISOString(), profile_last_verified: "2026-10-01", voice_model: "eleven_v4",
      script_model: "m", voice_provider: "elevenlabs", word_count: 220, duration_seconds: 90,
      fact_check: { passed: true, issues: [] },
    }),
  );
}

describe("publishTake", () => {
  it("uploads audio + transcript immutably, writes a manifest, and marks published", async () => {
    await seed("a", "approved");
    const { publishTake } = await import("../src/publish/blob.js");
    const calls: Array<[string, string, boolean]> = [];
    const put = async (p: string, _b: Buffer, o: { contentType: string; allowOverwrite: boolean }) => {
      calls.push([p, o.contentType, o.allowOverwrite]);
      return { url: `https://blob.test/${p}` };
    };
    const m = await publishTake("a", 1, { scriptUrl: "https://blob.test/wah-take.js", put, now: new Date(0), setCurrent: false });
    expect(calls).toEqual([
      ["takes/a/v1/audio.mp3", "audio/mpeg", false],
      ["takes/a/v1/transcript.json", "application/json", false],
    ]);
    expect(m.embed).toBe('<script src="https://blob.test/wah-take.js" data-transcript="https://blob.test/takes/a/v1/transcript.json"></script>');
    const meta = JSON.parse(await readFile(path.join(dir, "a", "v1", "metadata.json"), "utf8"));
    expect(meta.status).toBe("published");
    expect(JSON.parse(await readFile(path.join(dir, "a", "v1", "published.json"), "utf8")).audio_url).toContain("audio.mp3");
  });

  it("refuses anything not approved and uploads nothing", async () => {
    await seed("b", "needs_review");
    const { publishTake } = await import("../src/publish/blob.js");
    let called = false;
    const put = async () => ((called = true), { url: "x" });
    await expect(publishTake("b", 1, { scriptUrl: "s", put })).rejects.toThrow(/only approved/);
    expect(called).toBe(false);
  });
});

describe("current address", () => {
  type Call = [string, boolean, number];
  const mk = (calls: Call[]) => async (p: string, _b: Buffer, o: { allowOverwrite: boolean; cacheControlMaxAge: number }) => {
    calls.push([p, o.allowOverwrite, o.cacheControlMaxAge]);
    return { url: `https://blob.test/${p}` };
  };

  it("uploads the immutable copy first, then overwrites current with a short cache, and embeds current", async () => {
    await seed("c", "approved");
    const { publishTake } = await import("../src/publish/blob.js");
    const calls: Call[] = [];
    const m = await publishTake("c", 1, { scriptUrl: "https://blob.test/wah-take.js", put: mk(calls), now: new Date(0) });
    expect(calls).toEqual([
      ["takes/c/v1/audio.mp3", false, 31536000],
      ["takes/c/v1/transcript.json", false, 31536000],
      ["takes/c/current/audio.mp3", true, 300],
      ["takes/c/current/transcript.json", true, 300],
    ]);
    expect(m.embed).toContain("takes/c/current/transcript.json");
    expect(m.transcript_url).toContain("takes/c/v1/transcript.json");
  });

  it("--no-current leaves current alone and embeds the versioned transcript", async () => {
    await seed("d", "approved");
    const { publishTake } = await import("../src/publish/blob.js");
    const calls: Call[] = [];
    const m = await publishTake("d", 1, { scriptUrl: "s", put: mk(calls), setCurrent: false });
    expect(calls.map((c) => c[0])).toEqual(["takes/d/v1/audio.mp3", "takes/d/v1/transcript.json"]);
    expect(m.current_transcript_url).toBeUndefined();
    expect(m.embed).toContain("takes/d/v1/transcript.json");
  });

  it("promoteToCurrent repoints current for a published version without touching the immutable copy", async () => {
    await seed("e", "published");
    const { promoteToCurrent } = await import("../src/publish/blob.js");
    const calls: Call[] = [];
    const m = await promoteToCurrent("e", 1, { scriptUrl: "https://blob.test/wah-take.js", put: mk(calls) });
    expect(calls.map((c) => c[0])).toEqual(["takes/e/current/audio.mp3", "takes/e/current/transcript.json"]);
    expect(m.audio_url).toBe("https://blob.test/takes/e/v1/audio.mp3");
    expect(m.embed).toContain("takes/e/current/transcript.json");
    await seed("f", "needs_review");
    await expect(promoteToCurrent("f", 1, { scriptUrl: "s", put: mk([]) })).rejects.toThrow(/only approved or published/);
  });
});
