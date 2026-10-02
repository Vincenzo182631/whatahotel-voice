import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { HotelProfileSchema, ScriptSchema, type Script } from "../src/core/schema.js";
import { checkDuration, checkScript, wordCount } from "../src/script/rules.js";

const profile = HotelProfileSchema.parse(JSON.parse(readFileSync("test/fixtures/hotels/test-hotel.json", "utf8")));
const script = (): Script =>
  ScriptSchema.parse(JSON.parse(readFileSync("test/fixtures/test-hotel.script.json", "utf8")));

describe("checkScript", () => {
  it("passes the fixture script", () => {
    expect(checkScript(script(), profile)).toEqual([]);
    expect(wordCount(script())).toBe(187);
  });

  it("requires the bottom line to cite a perk when the profile has perks", () => {
    const withPerks = { ...profile, perks: [{ id: "p-1", text: "Breakfast for two is free daily.", source_ids: ["official"] }] };
    expect(checkScript(script(), withPerks)).toContain('"bottom_line" must state the WhataHotel perks and cite a perk claim');
    const s = script();
    s.turns[s.turns.length - 1]!.claim_ids = ["p-1"];
    expect(checkScript(s, withPerks)).toEqual([]);
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
