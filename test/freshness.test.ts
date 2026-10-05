import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { checkFreshness, daysBetween, isExpired, needsRefresh } from "../src/core/freshness.js";
import { HotelProfileSchema, ScriptSchema } from "../src/core/schema.js";
import { checkScript } from "../src/script/rules.js";
import { scriptUserPrompt } from "../src/script/prompt.js";

const base = HotelProfileSchema.parse(JSON.parse(readFileSync("test/fixtures/hotels/test-hotel.json", "utf8")));
const script = ScriptSchema.parse(JSON.parse(readFileSync("test/fixtures/test-hotel.script.json", "utf8")));
const day = (s: string) => new Date(`${s}T12:00:00Z`);

/** Profile where the first fact and the first consideration carry the given expiry. */
function withExpiry(fact: string | undefined, cons: string | undefined) {
  return {
    ...base,
    facts: base.facts.map((c, i) => (i === 0 ? { ...c, expires: fact } : c)),
    considerations: base.considerations.map((c, i) => (i === 0 ? { ...c, expires: cons } : c)),
  };
}

describe("expiry", () => {
  it("counts days and treats the expiry day itself as still valid", () => {
    expect(daysBetween("2026-10-05", "2026-12-15")).toBe(71);
    expect(daysBetween("2026-12-15", "2026-10-05")).toBe(-71);
    expect(isExpired({ expires: "2026-12-15" }, day("2026-12-15"))).toBe(false);
    expect(isExpired({ expires: "2026-12-15" }, day("2026-12-16"))).toBe(true);
    expect(isExpired({ expires: undefined }, day("2099-01-01"))).toBe(false);
  });

  it("flags expired and soon-to-expire claims, soonest first, and ignores far-off ones", () => {
    const p = withExpiry("2026-12-01", "2026-10-01");
    const f = checkFreshness(p, { today: day("2026-10-20"), warnDays: 45 });
    expect(f.expired.map((c) => [c.id, c.days_left])).toEqual([[p.considerations[0]!.id, -19]]);
    expect(f.expiring.map((c) => c.id)).toEqual([p.facts[0]!.id]);
    expect(checkFreshness(p, { today: day("2026-10-20"), warnDays: 10 }).expiring).toEqual([]);
  });

  it("only demands a refresh for expired claims the clip cites, or a stale profile", () => {
    const p = withExpiry(undefined, "2026-10-01");
    const cited = checkFreshness(p, { today: day("2026-10-20"), script });
    const citedIds = new Set(script.turns.flatMap((t) => t.claim_ids));
    expect(cited.expired[0]!.in_clip).toBe(citedIds.has(p.considerations[0]!.id));
    expect(needsRefresh({ ...cited, expired: [] })).toBe(false);
    const old = checkFreshness(p, { today: day("2027-06-01") });
    expect(old.profile_stale).toBe(true);
    expect(needsRefresh({ ...old, expired: [] })).toBe(true);
  });
});

describe("expired claims in scripts", () => {
  it("rejects a script that cites an expired claim and names the date", () => {
    const cited = script.turns.flatMap((t) => t.claim_ids)[0]!;
    const p = {
      ...base,
      facts: base.facts.map((c) => (c.id === cited ? { ...c, expires: "2026-01-01" } : c)),
      highlights: base.highlights.map((c) => (c.id === cited ? { ...c, expires: "2026-01-01" } : c)),
      considerations: base.considerations.map((c) => (c.id === cited ? { ...c, expires: "2026-01-01" } : c)),
    };
    expect(checkScript(script, p, day("2026-06-01")).join()).toMatch(new RegExp(`claim "${cited}", which expired on 2026-01-01`));
    expect(checkScript(script, p, day("2025-06-01")).join()).not.toMatch(/expired/);
  });

  it("withholds expired claims from the writer and passes expiry dates of live ones", () => {
    const p = withExpiry("2026-01-01", "2027-01-01");
    const prompt = scriptUserPrompt(p, undefined, day("2026-06-01"));
    expect(prompt).not.toContain(p.facts[0]!.text);
    expect(prompt).toContain(p.considerations[0]!.text);
    expect(prompt).toContain('"expires": "2027-01-01"');
    expect(prompt).toContain('"today": "2026-06-01"');
  });
});
