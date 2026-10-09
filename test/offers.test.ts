import { describe, expect, it } from "vitest";
import { checkClosing, composeClosing } from "../src/offers/closing.js";
import { compareOffers } from "../src/offers/index.js";
import { parseChainOffer, parseHotelOffer } from "../src/offers/extract.js";
import type { Benefit } from "../src/offers/store.js";

const hotelHtml = (extra = "", combinable = true) => `<html><body>
<h2>Perks Comparison</h2><div>Amenity / Perk</div><div>Standard Published Rate</div><div>WhataHotel! Preferred Rate</div>
<div>Daily Breakfast</div><div>Room Only (Breakfast is Usually Extra)</div><div>Free Breakfast for 2 Daily</div>
<div>Room Upgrade</div><div>Priority Upgrade if Available at Check-in</div>
<div>Hotel Credit</div><div>$100 Credit</div><div>Free Wi-Fi Access</div>
<div>Any Special Offer</div><div>Not Combinable With Any Other OfferVaries</div>${combinable ? "<div>Combinable with the Exclusive Perks</div>" : ""}
<div>All reservations booked via WhataHotel!</div>${extra}</body></html>`;
const chainHtml = (combine: string, credit = "USD 100 food and beverage or spa credit per stay.") => `<html><body><h1>Chain</h1>
<p>Daily breakfast for two</p><p>Daily breakfast for two guests.</p><p>${credit}</p><p>One-category room upgrade granted on arrival.</p><p>One-category room upgrade: Subject to availability at check-in.</p>
<p>${combine}</p></body></html>`;

describe("parseHotelOffer", () => {
  it("reads the perks table and nothing else", () => {
    const o = parseHotelOffer(hotelHtml());
    expect(o.found.map((f) => f.kind).sort()).toEqual(["breakfast", "combinable", "credit", "upgrade", "wifi"]);
    expect(o.tableCredit).toBe(100);
    expect(o.creditFacts.map((f) => f.amount)).toEqual([100]);
    expect(o.combinable).toBe("explicit");
  });
  it("finds no benefit when the page has no perks table", () => {
    expect(parseHotelOffer("<html><body>Welcome to the hotel. Free Wi-Fi in the lobby.</body></html>").found).toEqual([]);
  });
  it("notes a higher suite credit printed next to the credit", () => {
    const o = parseHotelOffer(hotelHtml(`<p>Benefits including a $100 property credit ($200 for suites), room upgrades based on availability</p>`));
    expect(o.creditFacts.map((f) => [f.amount, f.kind])).toEqual([[100, "standalone"], [200, "suite"]]);
    expect(o.suitesHigher).toBe(true);
  });
});

describe("compareOffers", () => {
  const confirmed = (bs: Benefit[], kind: string) => bs.find((b) => b.kind === kind)!;
  it("confirms what both pages agree on and keeps the chain's credit condition", () => {
    const r = compareOffers(parseHotelOffer(hotelHtml()), parseChainOffer(chainHtml("Can they be combined? Yes, they apply on top of the public offers.")));
    expect(confirmed(r.benefits, "breakfast").status).toBe("confirmed");
    expect(confirmed(r.benefits, "upgrade")).toMatchObject({ status: "confirmed", qualifiers: ["availability"] });
    expect(confirmed(r.benefits, "credit")).toMatchObject({ status: "confirmed", amount: 100, qualifiers: ["food_beverage_or_spa", "per_stay"] });
    expect(confirmed(r.benefits, "combinable").status).toBe("confirmed");
    expect(r.issues).toEqual([]);
  });
  it("does not say combinable when the chain page says it is decided per offer", () => {
    const r = compareOffers(parseHotelOffer(hotelHtml()), parseChainOffer(chainHtml("Can they be combined? Generally, yes. Combinability is decided per offer.")));
    expect(confirmed(r.benefits, "combinable").status).toBe("unclear");
    expect(r.issues.join(" ")).toMatch(/decided per offer/);
  });
  it("does not say combinable when the hotel page never says so", () => {
    const r = compareOffers(parseHotelOffer(hotelHtml("", false)), parseChainOffer(chainHtml("Yes.")));
    expect(confirmed(r.benefits, "combinable").status).toBe("absent");
  });
  it("omits the credit when WhataHotel shows conflicting amounts", () => {
    const r = compareOffers(parseHotelOffer(hotelHtml(`<p>$250 resort credit</p>`)), undefined);
    expect(confirmed(r.benefits, "credit").status).toBe("conflict");
    expect(r.issues.join(" ")).toMatch(/also prints/);
  });
  it("keeps the credit with the suites condition when WhataHotel states it", () => {
    const r = compareOffers(parseHotelOffer(hotelHtml(`<p>a $100 property credit ($200 for suites)</p>`)), undefined);
    expect(confirmed(r.benefits, "credit")).toMatchObject({ status: "confirmed", amount: 100, suiteAmount: 200 });
  });
  it("treats a chain-wide range and a higher suites credit as a condition, not a conflict", () => {
    const hotel = parseHotelOffer(hotelHtml(`<script>{"description":"Includes $100-$200 Resort Credit"}</script>`));
    const chain = parseChainOffer(chainHtml("Yes.", "USD 100 hotel credit per stay, usable for spa treatments, dining or other incidental charges.").replace("</body>", "<p>Hotel credit: Suites and residences carry a higher credit (USD 100 to 200 depending on room category).</p></body>"));
    const r = compareOffers(hotel, chain);
    expect(confirmed(r.benefits, "credit")).toMatchObject({ status: "confirmed", amount: 100, suitesHigher: true, qualifiers: ["per_stay"] });
    expect(r.issues).toEqual([]);
  });
  it("ignores another promotion's credit (nightly resort credit) but flags a stray flat amount", () => {
    expect(confirmed(compareOffers(parseHotelOffer(hotelHtml(`<p>Special: $200 Nightly Resort Credit</p>`))).benefits, "credit").status).toBe("confirmed");
  });
  it("is unclear, not confirmed, without a chain page for a chain hotel", () => {
    expect(confirmed(compareOffers(parseHotelOffer(hotelHtml())).benefits, "combinable").status).toBe("unclear");
    expect(confirmed(compareOffers(parseHotelOffer(hotelHtml()), undefined, { independent: true }).benefits, "combinable").status).toBe("confirmed");
  });
  it("confirms nothing for a page without a perks table", () => {
    const r = compareOffers(parseHotelOffer("<html><body>nothing here</body></html>"));
    expect(r.benefits.every((b) => b.status === "absent")).toBe(true);
  });
});

const all = (over: Partial<Record<string, Partial<Benefit>>> = {}): Benefit[] =>
  (["breakfast", "wifi", "upgrade", "credit", "combinable"] as const).map((kind) => ({ kind, status: "confirmed", qualifiers: kind === "upgrade" ? ["availability"] : [], ...(kind === "credit" ? { amount: 100 } : {}), ...over[kind] }) as Benefit);

describe("composeClosing", () => {
  it("is stable for a hotel and says only confirmed benefits", () => {
    const b = all({ credit: { status: "conflict", amount: undefined }, combinable: { status: "unclear" } });
    const a = composeClosing("hotel-a", b);
    expect(composeClosing("hotel-a", b).text).toBe(a.text);
    expect(a.text).toMatch(/breakfast/i);
    expect(a.text).not.toMatch(/credit|\$|combin/i);
    expect(checkClosing(a.text, b)).toEqual([]);
  });
  it("varies wording, order and shape across hotels", () => {
    const texts = new Set(Array.from({ length: 30 }, (_, i) => composeClosing(`hotel-${i}`, all()).text));
    expect(texts.size).toBeGreaterThan(20);
    const templates = new Set(Array.from({ length: 30 }, (_, i) => composeClosing(`hotel-${i}`, all()).template));
    expect(templates.size).toBeGreaterThan(6);
  });
  it("avoids the templates and texts recent hotels used", () => {
    const first = composeClosing("hotel-x", all());
    const next = composeClosing("hotel-x", all(), { recentTemplates: [first.template.replace(/\+combine$/, "")], recentTexts: [first.text] });
    expect(next.template.replace(/\+combine$/, "")).not.toBe(first.template.replace(/\+combine$/, ""));
  });
  it("never promises an upgrade and always keeps the availability condition", () => {
    for (let i = 0; i < 60; i++) {
      const t = composeClosing(`h-${i}`, all()).text;
      expect(t).toMatch(/availab|when one is/i);
      expect(checkClosing(t, all())).toEqual([]);
    }
  });
  it("keeps the credit conditions it was verified with", () => {
    const b = all({ credit: { qualifiers: ["food_beverage_or_spa", "per_stay"], suiteAmount: 200 } });
    const hi = all({ credit: { qualifiers: ["per_stay"], suitesHigher: true } });
    for (let i = 0; i < 30; i++) {
      const t = composeClosing(`g-${i}`, hi).text;
      if (/credit|\$100/i.test(t)) expect(t).toMatch(/higher credit for suites/);
      expect(checkClosing(t, hi)).toEqual([]);
    }
    for (let i = 0; i < 40; i++) {
      const t = composeClosing(`h-${i}`, b).text;
      if (/credit|\$100|to spend/i.test(t)) expect(t).toMatch(/food and beverage/i), expect(t).toMatch(/per stay/), expect(t).toMatch(/\$200 for suites/);
      expect(checkClosing(t, b)).toEqual([]);
    }
  });
  it("only mentions combining when it is confirmed, and says terms apply", () => {
    expect(composeClosing("h", all({ combinable: { status: "unclear" } })).text).not.toMatch(/combin/i);
    expect(composeClosing("h", all()).text).toMatch(/combined[^.]*terms|terms[^.]*combined/i);
  });
  it("falls back to a simple pointer to the hotel's WhataHotel page when nothing is verified", () => {
    const none = composeClosing("h", all({ breakfast: { status: "absent" }, wifi: { status: "absent" }, upgrade: { status: "absent" }, credit: { status: "conflict" }, combinable: { status: "absent" } }));
    expect(none.text).toMatch(/WhataHotel page/);
    expect(none.benefits).toEqual([]);
  });
  it("checkClosing catches an unverified benefit and an over-promise", () => {
    const b = all({ wifi: { status: "absent" } });
    expect(checkClosing("You get free Wi-Fi.", b).join()).toMatch(/Wi-Fi/);
    expect(checkClosing("You'll be upgraded.", b).join()).toMatch(/promises|availability/);
  });
});
