/**
 * Which official domains belong to which hotel chain. A chain's domain is only used for hotels
 * confirmed as that chain's property, and never for another chain's or an independent hotel.
 */
export interface Chain {
  id: string;
  name: string;
  match: RegExp;
  domains: string[];
  /** The property's own section of the chain site (e.g. https://www.fourseasons.com/sydney/), or undefined if the URL is not a property page. */
  base: (u: URL) => string | undefined;
}

const seg = (u: URL) => u.pathname.split("/").filter(Boolean);
const dropLang = (s: string[]) => (s[0] && /^[a-z]{2}(-[a-z]{2})?$/i.test(s[0]) ? s.slice(1) : s);
const firstTwo = (u: URL) => {
  const s = dropLang(seg(u));
  return s.length >= 2 ? `${u.origin}/${seg(u)[0] !== s[0] ? seg(u)[0] + "/" : ""}${s[0]}/${s[1]}/` : undefined;
};
const firstOne = (u: URL) => {
  const s = dropLang(seg(u));
  return s.length >= 1 ? `${u.origin}/${seg(u)[0] !== s[0] ? seg(u)[0] + "/" : ""}${s[0]}/` : undefined;
};

export const CHAINS: Chain[] = [
  {
    id: "four-seasons",
    name: "Four Seasons",
    match: /four seasons/i,
    domains: ["fourseasons.com"],
    base: (u) => {
      const c = seg(u)[0];
      return c && !["en", "content", "alt", "press"].includes(c.toLowerCase()) ? `${u.origin}/${c}/` : undefined;
    },
  },
  {
    id: "mandarin-oriental",
    name: "Mandarin Oriental",
    match: /mandarin oriental/i,
    domains: ["mandarinoriental.com"],
    base: (u) => {
      const s = dropLang(seg(u));
      return s.length >= 2 ? `${u.origin}/en/${s[0]}/${s[1]}/` : undefined;
    },
  },
  { id: "peninsula", name: "The Peninsula", match: /\bpeninsula\b/i, domains: ["peninsula.com"], base: firstOne },
  { id: "ritz-carlton", name: "The Ritz-Carlton", match: /ritz-carlton/i, domains: ["ritzcarlton.com"], base: firstTwo },
  { id: "rosewood", name: "Rosewood", match: /rosewood/i, domains: ["rosewoodhotels.com"], base: firstTwo },
  { id: "aman", name: "Aman", match: /^aman\b/i, domains: ["aman.com"], base: firstTwo },
  { id: "belmond", name: "Belmond", match: /belmond/i, domains: ["belmond.com"], base: firstTwo },
  { id: "dorchester-collection", name: "Dorchester Collection", match: /dorchester/i, domains: ["dorchestercollection.com"], base: firstTwo },
  { id: "hyatt", name: "Hyatt", match: /\bhyatt\b/i, domains: ["hyatt.com"], base: firstTwo },
  { id: "marriott", name: "Marriott", match: /marriott|st\.? regis|w hotel|jw marriott|edition/i, domains: ["marriott.com"], base: firstTwo },
  { id: "one-and-only", name: "One&Only", match: /one&only/i, domains: ["oneandonlyresorts.com"], base: firstTwo },
  { id: "six-senses", name: "Six Senses", match: /six senses/i, domains: ["sixsenses.com"], base: firstTwo },
];

export const chainById = (id: string) => CHAINS.find((c) => c.id === id);
export const chainOfName = (name: string) => CHAINS.find((c) => c.match.test(name));

const hostIs = (host: string, domain: string) => host === domain || host.endsWith(`.${domain}`);
export const chainOfHost = (host: string) => CHAINS.find((c) => c.domains.some((d) => hostIs(host.replace(/^www\./, ""), d)));

/** Sites that describe hotels but are never the hotel's own site. */
const THIRD_PARTY = [
  "booking.com", "expedia.", "hotels.com", "tripadvisor.", "agoda.", "trivago.", "kayak.", "orbitz.", "priceline.", "travelocity.",
  "hotelscombined.", "makemytrip.", "trip.com", "ctrip.", "wikipedia.org", "wikivoyage.org", "facebook.com", "instagram.com",
  "youtube.com", "yelp.", "lonelyplanet.", "fodors.", "forbes.com", "telegraph.co.uk", "cntraveler.com", "whatahotel.com",
  "mrandmrssmith.", "smallluxuryhotels.", "slh.com", "leadinghotels.", "relaischateaux.", "preferredhotels.", "virtuoso.",
  "tablethotels.", "hotelplanner.", "reservations.com", "google.com", "bing.com", "linkedin.com", "pinterest.", "tiktok.com",
];
export const isThirdParty = (host: string) => THIRD_PARTY.some((t) => host.includes(t));
