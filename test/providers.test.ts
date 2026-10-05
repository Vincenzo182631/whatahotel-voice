import { afterEach, describe, expect, it, vi } from "vitest";
import { chunkLines } from "../src/providers/elevenlabs.js";
import { extractAudio } from "../src/providers/gemini.js";
import { applyPronunciations, GLOBAL_PRONUNCIATIONS, withGlobalPronunciations } from "../src/providers/types.js";
import { PERKS_SIGNATURE } from "../src/script/rules.js";

describe("providers", () => {
  it("chunks dialogue at turn boundaries under the char limit", () => {
    const line = (n: number) => ({ speaker: "advisor" as const, text: "x".repeat(n) });
    const chunks = chunkLines([line(900), line(900), line(900)], 2000);
    expect(chunks.map((c) => c.length)).toEqual([2, 1]);
    expect(() => chunkLines([line(2001)], 2000)).toThrow();
  });

  it("respells hard names on word boundaries only", () => {
    const p = [{ term: "Wailea", say_as: "why-LAY-ah" }];
    expect(applyPronunciations("Four Seasons Wailea, Wailea's beach", p)).toBe(
      "Four Seasons why-LAY-ah, why-LAY-ah's beach",
    );
    expect(applyPronunciations("Waileans", p)).toBe("Waileans");
  });

  it("takes the last audio block from a Gemini interaction", () => {
    const json = {
      steps: [
        { content: [{ type: "text" }] },
        { content: [{ type: "audio", data: Buffer.from("old").toString("base64") }] },
        { content: [{ type: "audio", data: Buffer.from("new").toString("base64"), mime_type: "audio/wav" }] },
      ],
    };
    expect(extractAudio(json).data.toString()).toBe("new");
    expect(() => extractAudio({ steps: [] })).toThrow(/no audio/);
  });
});

describe("global pronunciations", () => {
  it("say the brand as 'What a Hotel' in the closing line and anywhere else it is spoken", () => {
    expect(applyPronunciations(PERKS_SIGNATURE, withGlobalPronunciations([]))).toMatch(/^With the What a Hotel Preferred Rate,/);
    expect(applyPronunciations("A WhataHotel! pick.", GLOBAL_PRONUNCIATIONS)).toBe("A What a Hotel! pick.");
  });

  it("apply to every hotel ahead of its own list, which can override a term", () => {
    const own = [{ term: "Wailea", say_as: "why-LAY-ah" }];
    expect(withGlobalPronunciations(own).map((p) => p.term)).toEqual(["WhataHotel", "Wailea"]);
    const override = [{ term: "WhataHotel", say_as: "Whata Hotel" }];
    expect(withGlobalPronunciations(override)).toEqual(override);
  });

  it("leave the written script untouched: only the voiced lines are respelled", () => {
    const turn = { speaker: "advisor" as const, text: "WhataHotel picks." };
    applyPronunciations(turn.text, GLOBAL_PRONUNCIATIONS);
    expect(turn.text).toBe("WhataHotel picks.");
  });
});

describe("host voices", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("default to Eric (advisor) and Jessica (traveler) with no environment variables", async () => {
    vi.stubEnv("ELEVENLABS_VOICE_ADVISOR", "");
    vi.stubEnv("ELEVENLABS_VOICE_TRAVELER", "");
    const { ElevenLabsProvider, DEFAULT_VOICES } = await import("../src/providers/elevenlabs.js");
    expect(new ElevenLabsProvider().voices).toEqual(DEFAULT_VOICES);
    expect(DEFAULT_VOICES).toEqual({ advisor: "cjVigY5qzO86Huf0OWal", traveler: "cgSgspJ2msm6clMCkdW9" });
  });

  it("let an environment variable override a default", async () => {
    vi.stubEnv("ELEVENLABS_VOICE_ADVISOR", "custom-advisor");
    vi.stubEnv("ELEVENLABS_VOICE_TRAVELER", "");
    const { ElevenLabsProvider, DEFAULT_VOICES } = await import("../src/providers/elevenlabs.js");
    expect(new ElevenLabsProvider().voices).toEqual({ advisor: "custom-advisor", traveler: DEFAULT_VOICES.traveler });
  });

  it("are recorded in clip metadata", async () => {
    const { MetadataSchema } = await import("../src/core/schema.js");
    const meta = {
      hotel_slug: "x", version: 1, status: "needs_review", generated_at: "t", profile_last_verified: "2026-10-01",
      script_model: "m", voice_provider: "elevenlabs", voice_model: "eleven_v4", word_count: 220, duration_seconds: 90,
      fact_check: { passed: true, issues: [] },
    };
    expect(MetadataSchema.parse(meta).voices).toBeUndefined();
    const withVoices = { ...meta, voices: { advisor: "a", traveler: "t" } };
    expect(MetadataSchema.parse(withVoices).voices).toEqual({ advisor: "a", traveler: "t" });
  });
});
