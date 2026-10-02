import { existsSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { generateHotel } from "../src/pipeline.js";
import { listVersions, setStatus } from "../src/storage/local.js";

afterAll(() => rmSync("test/.output", { recursive: true, force: true }));

describe("generateHotel (mock provider, manual script)", () => {
  it("writes a complete, versioned output folder", async () => {
    rmSync("test/.output", { recursive: true, force: true });
    const first = await generateHotel("test-hotel", {
      provider: "mock",
      scriptFile: "test/fixtures/test-hotel.script.json",
    });
    for (const f of ["audio.mp3", "transcript.json", "script.json", "source-profile.json", "metadata.json"]) {
      expect(existsSync(path.join(first.dir, f)), f).toBe(true);
    }
    expect(first.metadata).toMatchObject({ version: 1, status: "needs_review", voice_provider: "mock", word_count: 168 });
    // ~168 words at 2.2 w/s plus gaps: roughly 75-90 seconds.
    expect(first.metadata.duration_seconds).toBeGreaterThan(70);
    expect(first.metadata.duration_seconds).toBeLessThan(95);
    // No API key in tests: the model fact check is recorded as skipped, so it cannot pass.
    expect(first.metadata.fact_check.passed).toBe(false);

    const transcript = JSON.parse(readFileSync(path.join(first.dir, "transcript.json"), "utf8"));
    expect(transcript.turns[0].name).toBe("Luxury Advisor");
    expect(transcript.sources.map((s: { title: string }) => s.title)).toContain("Hotel Fixture official site");

    const second = await generateHotel("test-hotel", { provider: "mock", fromVersion: 1, scriptOnly: true });
    expect(second.metadata).toMatchObject({ version: 2, status: "generated", script_model: "reused:v1" });
    expect(await listVersions("test-hotel")).toEqual([1, 2]);
  });

  it("enforces review transitions", async () => {
    await expect(setStatus("test-hotel", 1, "published")).rejects.toThrow(/Cannot move/);
    expect((await setStatus("test-hotel", 1, "approved")).status).toBe("approved");
  });
});
