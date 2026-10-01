import { describe, expect, it } from "vitest";
import {
  WahApiError,
  WahClient,
  fetchVerifiedInfo,
  parseHotel,
  parseInfo,
  parseLenientJson,
  redact,
  type WahHotel,
} from "../src/sources/wah-api.js";

/** Shapes from Price Intelligence fixtures (tests/fixtures/whatahotel/hotel.json, whatahotel-info.test.ts). */
const HOTEL = {
  status: { connection: 1, message: "Success", code: "100", method: "hotel" },
  hotels: [
    {
      hotelID: "951", name: "The Ritz Carlton Kapalua", city: "Maui", region: "Hawaii", country: "United States",
      address: "1 Ritz Carlton Dr, Lahaina, HI 96761", "loc-lat": "21.001429", "loc-long": "-156.654040",
      url: "https://www.whatahotel.com/hotels/951/The-Ritz-Carlton-Kapalua.html", "ama-property": "RZJHMKAP",
      "primary-desc": "NULL",
    },
  ],
};
const INFO = {
  amadeus: { codes: "RZJHMKAP", count: "1" },
  hotel: {
    DESCSTATUS: "1",
    GUESTROOMS: [{ ROOMRMA: [{ RMAVAL: "Bathrobe", RMACODE: "10" }, { RMAVAL: "Bathrobe", RMACODE: "10" }] }],
    RESTAURANTS: [{ RESTAURANTNAME: "Banyan Tree" }, { RESTAURANTNAME: "Banyan Tree" }, { RESTAURANTNAME: "Burger Shack" }],
  },
  session: { sessionName: "Guest", cfID: "secret", cfToken: "secret" },
  status: { code: "200", connection: 1, message: "Success" },
};

function fakeFetch(bodies: string[]): typeof fetch {
  let i = 0;
  return (async () => new Response(bodies[Math.min(i++, bodies.length - 1)], { status: 200 })) as typeof fetch;
}
const wrap = (data: unknown) => JSON.stringify({ wahData: data });

describe("WhataHotel API client", () => {
  it("repairs trailing commas only when strict parsing fails", () => {
    expect(parseLenientJson('{"a":[1,2,],"b":"x, ]"}')).toEqual({ a: [1, 2], b: "x, ]" });
    expect(() => parseLenientJson("{oops}")).toThrow();
  });

  it("redacts the key", () => {
    expect(redact("https://x/api.cfm?method=hotel&apiKey=abc123&hotel=1")).toBe(
      "https://x/api.cfm?method=hotel&apiKey=<redacted>&hotel=1",
    );
  });

  it("treats an HTTP 200 carrying code 401 as a failure, without retrying", async () => {
    const client = new WahClient({
      apiKey: "k",
      fetchImpl: fakeFetch([wrap({ status: { connection: 0, code: "401", message: "Unauthorized" } }), wrap(HOTEL)]),
    });
    const err = await client.call("hotel", { hotel: 951 }).catch((e) => e);
    expect(err).toBeInstanceOf(WahApiError);
    expect(err.message).toContain("<redacted>");
    expect(err.message).not.toContain("apiKey=k");
  });

  it("retries a 500 and accepts code 100 as success", async () => {
    const client = new WahClient({
      apiKey: "k",
      fetchImpl: fakeFetch([wrap({ status: { connection: 0, code: "500", message: "err" } }), wrap(HOTEL)]),
    });
    expect(parseHotel(await client.call("hotel", { hotel: 951 }))).toMatchObject({
      hotelID: "951", city: "Maui", amadeusProperty: "RZJHMKAP", latitude: 21.001429,
    });
  });

  it("parses info, dedupes, and drops session credentials", () => {
    const info = parseInfo(INFO);
    expect(info.restaurants).toEqual(["Banyan Tree", "Burger Shack"]);
    expect(info.amenities).toEqual([{ code: "10", label: "Bathrobe" }]);
    expect(info.raw).not.toHaveProperty("session");
    expect(parseInfo({ amadeus: { codes: "NULL" }, hotel: { RESTAURANTS: { RESTAURANTNAME: "Solo" } } })).toMatchObject({
      amadeusCode: null,
      restaurants: ["Solo"],
    });
  });

  it("refuses info whose Amadeus code does not match the hotel", async () => {
    const hotel: WahHotel = parseHotel(HOTEL);
    const other = { ...INFO, amadeus: { codes: "FSPBIFSP" } };
    const client = new WahClient({ apiKey: "k", fetchImpl: fakeFetch([wrap(other)]) });
    await expect(fetchVerifiedInfo(client, hotel)).rejects.toThrow(/identity mismatch/);

    const degraded = { ...INFO, hotel: { ...INFO.hotel, DESCSTATUS: "0" } };
    const client2 = new WahClient({ apiKey: "k", fetchImpl: fakeFetch([wrap(degraded)]) });
    await expect(fetchVerifiedInfo(client2, hotel)).rejects.toThrow(/degraded/);
  });
});
