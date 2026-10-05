import { describe, expect, it } from "vitest";
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
