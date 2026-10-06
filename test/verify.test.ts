import { describe, expect, it } from "vitest";
import { cleanText, nameOverlap, propertyCodes, subpageLinks, tierOf } from "../src/verify/evidence.js";
import { isExempt, quoteInText, resolveClaim, type ClaimResult, type Finding } from "../src/verify/judge.js";
import { decide } from "../src/verify/policy.js";
import type { HotelProfile } from "../src/core/schema.js";

const finding = (over: Partial<Finding>): Finding => ({
  verdict: "supported",
  doc_id: "d1",
  url: "https://www.fourseasons.com/x/",
  tier: "official",
  quote: "a quote that is long enough",
  note: "",
  quote_verified: true,
  ...over,
});

describe("quoteInText", () => {
  const text = "The hotel opened in May 2008 with **207 rooms** (182 guest rooms and 25 suites).\n\nIt’s a 33-storey tower.";
  it("matches verbatim text ignoring case, markdown and curly quotes", () => {
    expect(quoteInText("opened in May 2008 with 207 rooms", text)).toBe(true);
    expect(quoteInText("It's a 33-storey tower", text)).toBe(true);
  });
  it("rejects invented or altered quotes", () => {
    expect(quoteInText("opened in May 2008 with 250 rooms", text)).toBe(false);
    expect(quoteInText("", text)).toBe(false);
  });
  it("requires every part of an ellipsis quote", () => {
    expect(quoteInText("opened in May 2008 ... 33-storey tower", text)).toBe(true);
    expect(quoteInText("opened in May 2008 ... a glass tower", text)).toBe(false);
  });
  it("rejects fragments too short to mean anything", () => {
    expect(quoteInText("rooms", text)).toBe(false);
  });
});

describe("resolveClaim", () => {
  it("supported needs a verified quote from an official or editorial page", () => {
    expect(resolveClaim([finding({})]).status).toBe("supported");
    expect(resolveClaim([finding({ tier: "editorial" })]).status).toBe("supported");
  });
  it("press-only support is not enough", () => {
    expect(resolveClaim([finding({ tier: "press" })]).status).toBe("unverified");
  });
  it("a quote that is not in the page counts for nothing", () => {
    expect(resolveClaim([finding({ quote_verified: false })]).status).toBe("unverified");
  });
  it("a verified contradiction beats support", () => {
    expect(resolveClaim([finding({}), finding({ verdict: "contradicted", tier: "editorial" })]).status).toBe("contradicted");
  });
  it("partial support is not enough, even from an official page", () => {
    const r = resolveClaim([finding({ verdict: "partial" })]);
    expect(r.status).toBe("unverified");
    expect(r.reason).toContain("part");
  });
  it("no findings means unverified", () => {
    expect(resolveClaim([]).status).toBe("unverified");
  });
});

describe("isExempt", () => {
  const profile = { perks: [{ id: "p-1", text: "Breakfast is free.", source_ids: ["s1"] }] } as unknown as HotelProfile;
  it("exempts perks and WhataHotel's own statements only", () => {
    expect(isExempt({ id: "p-1", text: "Breakfast is free.", source_ids: ["s1"] }, profile)).toBe(true);
    expect(isExempt({ id: "c-3", text: "WhataHotel notes premium pricing.", source_ids: ["s1"] }, profile)).toBe(true);
    expect(isExempt({ id: "f-1", text: "Opened in 2008 with 207 rooms.", source_ids: ["s2"] }, profile)).toBe(false);
  });
});

describe("decide", () => {
  const r = (claim_id: string, status: ClaimResult["status"]): ClaimResult => ({ claim_id, text: claim_id, status, findings: [] });
  it("passes when used claims are supported or exempt", () => {
    const d = decide([r("f-1", "supported"), r("f-2", "unverified"), r("p-1", "exempt")], new Set(["f-1", "p-1"]));
    expect(d.eligible).toBe(true);
    expect(d.counts.unverified).toBe(1);
  });
  it("blocks on any contradiction, used or not", () => {
    expect(decide([r("f-1", "supported"), r("f-2", "contradicted")], new Set(["f-1"])).eligible).toBe(false);
  });
  it("blocks on a used claim that is unverified", () => {
    const d = decide([r("f-1", "unverified")], new Set(["f-1"]));
    expect(d.eligible).toBe(false);
    expect(d.blockers[0]).toContain("f-1");
  });
  it("treats every claim as used when there is no script yet", () => {
    expect(decide([r("f-1", "unverified")], new Set()).eligible).toBe(false);
  });
});

describe("evidence helpers", () => {
  it("classifies sources", () => {
    expect(tierOf("https://press.fourseasons.com/mumbai/hotel-facts/")).toBe("official");
    expect(tierOf("https://www.cntraveler.com/hotels/egypt/x")).toBe("editorial");
    expect(tierOf("https://en.wikipedia.org/wiki/X")).toBe("press");
  });
  it("finds property codes", () => {
    expect(propertyCodes(["https://www.fourseasons.com/dubaijb/spa/", "https://press.fourseasons.com/dubaijb/hotel-facts/", "https://example.com/a/"])).toEqual(["dubaijb"]);
  });
  it("picks useful same-property sub-pages and skips noise", () => {
    const md = "[Dining](https://www.fourseasons.com/alexandria/dining/) [Offers](/alexandria/offers/) [Spa](/alexandria/spa/) [Img](https://www.fourseasons.com/alexandria/a.jpg) [Other](https://www.fourseasons.com/paris/dining/)";
    expect(subpageLinks(md, "alexandria")).toEqual(["https://www.fourseasons.com/alexandria/dining/", "https://www.fourseasons.com/alexandria/spa/"]);
  });
  it("matches hotel names to search results", () => {
    expect(nameOverlap("Four Seasons Hotel Alexandria", "Four Seasons Hotel Alexandria at San Stefano, Egypt", "https://www.cntraveler.com/hotels/egypt/giza/four-seasons-hotel-alexandria-at-san-stefano")).toBe(1);
    expect(nameOverlap("Four Seasons Hotel Alexandria", "Cairo Marriott Hotel", "https://www.cntraveler.com/hotels/egypt/cairo-marriott")).toBeLessThan(0.6);
  });
  it("cleans markdown", () => {
    expect(cleanText("![x](http://a/b.jpg)\n[Rooms](http://a)\n\n\n\nText")).toBe("Rooms\n\nText");
  });
});
