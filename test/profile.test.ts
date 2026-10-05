import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
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

describe("pronunciation respellings", () => {
  it("are lowercase syllables (approved by ear 2026-10-06); only single spelled-out letters may be capitals", () => {
    for (const slug of readdirSync("data/hotels").filter((f) => f.endsWith(".json"))) {
      const profile = JSON.parse(readFileSync(path.join("data/hotels", slug), "utf8"));
      for (const { term, say_as } of profile.pronunciations as Array<{ term: string; say_as: string }>) {
        const shouty = say_as.split(/[\s-]+/).filter((t) => /^[A-Z]{2,}$/.test(t));
        expect(shouty, `${profile.slug}: "${term}" -> "${say_as}"`).toEqual([]);
      }
    }
  });
});

describe("signature perks", () => {
  it("every hotel profile carries all the perk claims the closing line states", async () => {
    const { PERKS_SIGNATURE_CLAIMS } = await import("../src/script/rules.js");
    for (const file of readdirSync("data/hotels").filter((f) => f.endsWith(".json"))) {
      const profile = JSON.parse(readFileSync(path.join("data/hotels", file), "utf8"));
      const ids = new Set((profile.perks as Array<{ id: string }>).map((c) => c.id));
      for (const id of PERKS_SIGNATURE_CLAIMS) expect(ids.has(id), `${profile.slug} is missing perk ${id}`).toBe(true);
    }
  });
});
