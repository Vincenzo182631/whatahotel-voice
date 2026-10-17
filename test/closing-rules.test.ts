import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

const root = vi.hoisted(() => {
  const fs = require("node:fs") as typeof import("node:fs");
  const os = require("node:os") as typeof import("node:os");
  const p = require("node:path") as typeof import("node:path");
  const r = fs.mkdtempSync(p.join(os.tmpdir(), "wah-closing-"));
  process.env.WH_RESEARCH_DIR = r;
  return r;
});

import { readFileSync } from "node:fs";
import { HotelProfileSchema, ScriptSchema } from "../src/core/schema.js";
import { composeClosing } from "../src/offers/closing.js";
import type { Benefit, OfferSet } from "../src/offers/store.js";
import { checkScript, closingFor, signatureFor, withSignature } from "../src/script/rules.js";

const profile = HotelProfileSchema.parse(JSON.parse(readFileSync("test/fixtures/hotels/test-hotel.json", "utf8")));
const script = () => ScriptSchema.parse(JSON.parse(readFileSync("test/fixtures/test-hotel.script.json", "utf8")));
const benefits: Benefit[] = [
  { kind: "breakfast", status: "confirmed", qualifiers: [] },
  { kind: "wifi", status: "confirmed", qualifiers: [] },
  { kind: "upgrade", status: "confirmed", qualifiers: ["availability"] },
  { kind: "credit", status: "conflict", qualifiers: [] },
  { kind: "combinable", status: "unclear", qualifiers: [] },
];
function writeOffers(over: Partial<OfferSet> = {}) {
  const closing = composeClosing(profile.slug, benefits);
  const dir = path.join(root, profile.slug);
  mkdirSync(dir, { recursive: true });
  const set: OfferSet = { slug: profile.slug, hotel: { name: profile.name, url: "https://x.test" }, checked_at: "2026-10-09", status: "needs_review", benefits, issues: [], special_offers: [], restrictions: [], closing, ...over };
  writeFileSync(path.join(dir, "offers.json"), JSON.stringify(set));
  return closing;
}

describe("closing from verified offers", () => {
  it("keeps the fixed signature for hotels without offers.json", () => {
    expect(closingFor(profile)).toMatchObject({ verified: false, text: signatureFor(profile) });
  });

  it("ends the script on the hotel's own closing, spoken by the Advisor, and passes the rule check", () => {
    const closing = writeOffers();
    const s = withSignature(script(), profile);
    const last = s.turns[s.turns.length - 1]!;
    expect(last).toMatchObject({ speaker: "advisor", section: "bottom_line", text: closing.text, claim_ids: [] });
    expect(withSignature(s, profile).turns).toHaveLength(s.turns.length);
    expect(closingFor(profile)).toMatchObject({ verified: true, words: closing.words });
    const issues = checkScript(s, profile).filter((i) => !/word count/.test(i));
    expect(issues).toEqual([]);
  });

  it("rejects a closing that does not match, mentions an unverified benefit, or perks said earlier", () => {
    writeOffers();
    const s = withSignature(script(), profile);
    const swapped = { ...s, turns: s.turns.map((t, i) => (i === s.turns.length - 1 ? { ...t, text: "Free Wi-Fi, a $100 credit and a guaranteed upgrade." } : t)) };
    expect(checkScript(swapped, profile).join(" | ")).toMatch(/closing line for this hotel/);
    const early = { ...s, turns: s.turns.map((t, i) => (i === 2 ? { ...t, text: `${t.text} Plus free breakfast.` } : t)) };
    expect(checkScript(early, profile).join(" | ")).toMatch(/only the closing line may/);
  });
});
