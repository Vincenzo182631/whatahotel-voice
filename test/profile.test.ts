import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validateProfile } from "../src/core/profile.js";

const fixture = () => JSON.parse(readFileSync("test/fixtures/hotels/test-hotel.json", "utf8"));

describe("validateProfile", () => {
  it("accepts a well-formed profile", () => {
    expect(validateProfile(fixture())).toMatchObject({ ok: true, errors: [] });
  });

  it("rejects a claim citing an unknown source", () => {
    const p = fixture();
    p.facts[0].source_ids = ["nowhere"];
    expect(validateProfile(p).errors).toContain('claim "f-rooms" cites unknown source "nowhere"');
  });

  it("rejects duplicate claim ids across sections", () => {
    const p = fixture();
    p.highlights[0].id = "f-rooms";
    expect(validateProfile(p).errors).toContain('duplicate claim id "f-rooms"');
  });

  it("rejects a claim without sources", () => {
    const p = fixture();
    p.considerations[0].source_ids = [];
    expect(validateProfile(p).ok).toBe(false);
  });
});
