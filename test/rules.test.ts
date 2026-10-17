import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { HotelProfileSchema, ScriptSchema, type Script } from "../src/core/schema.js";
import { PERKS_SIGNATURE, checkDuration, checkScript, signatureFor, withSignature, wordCount } from "../src/script/rules.js";

const profile = HotelProfileSchema.parse(JSON.parse(readFileSync("test/fixtures/hotels/test-hotel.json", "utf8")));
const script = (): Script =>
  ScriptSchema.parse(JSON.parse(readFileSync("test/fixtures/test-hotel.script.json", "utf8")));

describe("checkScript", () => {
  it("passes the fixture script", () => {
    expect(checkScript(script(), profile)).toEqual([]);
    expect(wordCount(script())).toBe(227);
  });

  describe("WhataHotel signature", () => {
    const perk = (id: string) => ({ id, text: `Perk ${id}.`, source_ids: ["official"] });
    const withPerks = { ...profile, perks: [perk("p-1"), perk("p-2"), perk("p-3"), perk("p-4"), perk("p-5")] };

    it("is required as the last turn when the profile has perks", () => {
      expect(checkScript(script(), withPerks).join()).toMatch(/last turn must be the WhataHotel signature line/);
    });

    it("is appended word for word by the Luxury Advisor, once", () => {
      const s = withSignature(script(), withPerks);
      const last = s.turns[s.turns.length - 1]!;
      expect(last).toMatchObject({ speaker: "advisor", section: "bottom_line", text: signatureFor(withPerks), claim_ids: ["p-1", "p-5", "p-2", "p-3"] });
      expect(withSignature(s, withPerks).turns).toHaveLength(s.turns.length);
      expect(checkScript(s, withPerks).join()).not.toMatch(/signature|states the perks/);
      expect(PERKS_SIGNATURE).toMatch(/WhataHotel Preferred Rate/);
    });

    it("replaces perks a script already states elsewhere", () => {
      const s = script();
      s.turns[s.turns.length - 1]!.claim_ids = ["p-1"];
      const fixed = withSignature(s, withPerks);
      expect(fixed.turns.filter((t) => t.claim_ids.includes("p-1"))).toHaveLength(1);
      expect(fixed.turns[fixed.turns.length - 1]!.text).toBe(signatureFor(withPerks));
    });

    it("rejects perks spoken outside the signature", () => {
      const s = withSignature(script(), withPerks);
      s.turns[2]!.claim_ids = ["p-1"];
      expect(checkScript(s, withPerks).join()).toMatch(/turn 2 states the perks/);
    });

    it("does nothing for a profile without perks", () => {
      expect(withSignature(script(), profile)).toEqual(script());
    });
  });

  it("flags pros/cons framing", () => {
    const s = script();
    s.turns[7]!.text = s.turns[7]!.text.replace("Two things I'd tell a client.", "Now the cons.");
    expect(checkScript(s, profile).join()).toMatch(/pros\/cons/);
  });

  it("flags unknown claim ids", () => {
    const s = script();
    s.turns[2]!.claim_ids.push("f-invented");
    expect(checkScript(s, profile)).toContain('turn 2 cites unknown claim "f-invented"');
  });

  it("requires the traveler to cite a consideration in to_know", () => {
    const s = script();
    for (const t of s.turns) if (t.section === "to_know") t.claim_ids = [];
    const issues = checkScript(s, profile);
    expect(issues).toContain('"to_know" must cite at least one consideration');
  });

  it("flags uncited numbers", () => {
    const s = script();
    s.turns[2]!.claim_ids = [];
    expect(checkScript(s, profile)).toContain("turn 2 states a number without citing a claim");
  });

  it("flags sections out of order and length", () => {
    const s = script();
    s.turns.reverse();
    const issues = checkScript(s, profile);
    expect(issues).toContain("first turn must be the hook");
    s.turns = s.turns.slice(0, 6);
    expect(checkScript(s, profile).join()).toMatch(/word count/);
  });

  it("flags three turns in a row from one speaker", () => {
    const s = script();
    s.turns[3]!.speaker = "advisor";
    expect(checkScript(s, profile).join()).toMatch(/three times in a row/);
  });
});

describe("checkDuration", () => {
  it("accepts audio from 75 to 100 seconds", () => {
    for (const s of [75, 88.4, 100]) expect(checkDuration(s)).toBeNull();
  });

  it("flags audio outside 75-100 seconds", () => {
    expect(checkDuration(74.9)).toMatch(/under the 75s minimum/);
    expect(checkDuration(100.1)).toMatch(/over the 100s maximum/);
  });
});
