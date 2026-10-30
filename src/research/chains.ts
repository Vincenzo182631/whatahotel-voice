/**
 * Which official domains belong to which hotel chain. A chain's domain is only used for hotels
 * confirmed as that chain's property, and never for another chain's or an independent hotel.
 */
export interface Chain {
  id: string;
  name: string;
  match: RegExp;
  domains: string[];
  /** Other hosts that carry this chain's own property pages (e.g. a parent company's booking site). Evidence only; never searched for identity. */
  secondaryDomains?: string[];
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
  {
    id: "raffles",
    name: "Raffles",
    match: /\braffles\b/i,
    domains: ["raffles.com"],
    secondaryDomains: ["all.accor.com"],
    // raffles.com/singapore/... -> raffles.com/singapore/ ; chain-wide sections excluded
    base: (u) => {
      const b = firstOne(u);
      return b && /\/(offers|experiences|about|media|careers|destinations|search|legal|privacy|stories|press|newsroom)\/$/i.test(b) ? undefined : b;
    },
  },
  {
    id: "peninsula",
    name: "The Peninsula",
    match: /\bpeninsula\b/i,
    domains: ["peninsula.com"],
    // /en/hong-kong/... is a property section; /en/newsroom/, /en/perspectives/ etc. are chain-wide
    base: (u) => {
      const b = firstOne(u);
      return b && /\/(newsroom|perspectives|global|offers|careers|about-us|peninsula-academy|stories|search|privacy|legal)\/$/i.test(b) ? undefined : b;
    },
  },
  {
    id: "ritz-carlton",
    name: "The Ritz-Carlton",
    match: /ritz[- ]carlton/i,
    domains: ["ritzcarlton.com"],
    secondaryDomains: ["marriott.com"],
    // https://www.ritzcarlton.com/en/hotels/jhmrz-the-ritz-carlton-maui-kapalua/overview/ -> .../en/hotels/jhmrz-the-ritz-carlton-maui-kapalua/
    base: (u) => {
      const s = dropLang(seg(u));
      return s[0] === "hotels" && s[1] ? `${u.origin}/${seg(u)[0] !== s[0] ? seg(u)[0] + "/" : ""}hotels/${s[1]}/` : undefined;
    },
  },
  { id: "fairmont", name: "Fairmont", match: /fairmont/i, domains: ["fairmont.com"], secondaryDomains: ["accor.com"], base: firstOne },
  { id: "rosewood", name: "Rosewood", match: /rosewood|hotel de crillon|las ventanas al para[ií]so|the carlyle/i, domains: ["rosewoodhotels.com"],
    // rosewoodhotels.com/<lang>/<property>/... -> /<lang>/<property>/ ; chain-wide sections excluded
    base: (u) => { const s = seg(u); const o = /^[a-z]{2}(-[a-z]{2})?$/i.test(s[0] ?? "") ? 1 : 0; const p = s[o];
      return p && !/^(global|offers|about-us|about|careers|press|news|newsroom|destinations|search|legal|privacy|explore|stories|residences|gift-cards|our-hotels|sense-of-place|asaya|loyalty|media-hub)$/i.test(p) ? `${u.origin}/${s.slice(0, o + 1).join("/")}/` : undefined; } },
  { id: "aman", name: "Aman", match: /^aman/i, domains: ["aman.com"], base: (u) => { const s = dropLang(seg(u)); return s.length >= 2 ? `${u.origin}/${s[0]}/${s[1]}/` : undefined; } },
  { id: "belmond", name: "Belmond", match: /belmond/i, domains: ["belmond.com"], base: firstTwo },
  { id: "dorchester-collection", name: "Dorchester Collection", match: /dorchester/i, domains: ["dorchestercollection.com"], base: firstTwo },
  {
    id: "hyatt",
    name: "Hyatt",
    match: /\bhyatt\b/i,
    domains: ["hyatt.com"],
    // /park-hyatt/en-US/tyoph-park-hyatt-tokyo/... -> /park-hyatt/en-US/tyoph-park-hyatt-tokyo/ ; /en-US/hotel/japan/park-hyatt-tokyo/tyoph -> /en-US/hotel/japan/park-hyatt-tokyo/
    base: (u) => {
      const s = seg(u);
      const lang = (x?: string) => !!x && /^[a-z]{2}(-[a-z]{2})?$/i.test(x);
      if (lang(s[0]) && s[1] === "hotel" && s[3]) return `${u.origin}/${s.slice(0, 4).join("/")}/`;
      if (s[0] && !lang(s[0]) && lang(s[1]) && s[2]) return `${u.origin}/${s.slice(0, 3).join("/")}/`;
      return undefined;
    },
  },
  { id: "edition", name: "EDITION", match: /\bedition\b/i, domains: ["editionhotels.com"], base: firstOne },
  { id: "marriott", name: "Marriott", match: /marriott|st\.? regis|w hotel|jw marriott|kapalua bay/i, domains: ["marriott.com"],
    // marriott.com/<lang>/hotels/<code>-<name>/... -> property root; brand/offer pages excluded
    base: (u) => { const s = seg(u); const o = /^[a-z]{2}(-[a-z]{2})?$/i.test(s[0] ?? "") ? 1 : 0;
      if (s[o] !== "hotels" || !s[o + 1]) return undefined;
      if (o === 1 && s[0]?.toLowerCase() === "en") s[0] = "en-us"; // marriott.com/en/... 404s for crawlers; /en-us/ serves the page
      if (s[o + 1] === "travel") return s[o + 2] ? `${u.origin}/${s.slice(0, o + 3).join("/")}/` : undefined;
      return `${u.origin}/${s.slice(0, o + 2).join("/")}/`; } },
  { id: "one-and-only", name: "One&Only", match: /one&only/i, domains: ["oneandonlyresorts.com"], base: firstTwo },
  { id: "auberge", name: "Auberge Collection", match: /auberge/i, domains: ["aubergeresorts.com", "auberge.com"], base: firstOne },
  { id: "bulgari", name: "Bvlgari", match: /bvlgari|bulgari/i, domains: ["bulgarihotels.com"], base: firstTwo },
  {
    id: "kimpton",
    name: "Kimpton",
    match: /kimpton/i,
    domains: ["kimptonhotels.com"],
    secondaryDomains: ["ihg.com"],
    // .../kimptonhotels/hotels/us/en/montecito/sbaki/hoteldetail -> .../hotels/us/en/montecito/sbaki/ ; kimptonhotels.com/stay/<slug>/ is a property page too
    base: (u) => {
      const s = seg(u);
      const i = s.indexOf("hotels");
      if (i >= 0 && s.length >= i + 5 && /^[a-z]{2}$/i.test(s[i + 1] ?? "") && /^[a-z]{2}$/i.test(s[i + 2] ?? "") && s[0] !== "blog") return `${u.origin}/${s.slice(0, i + 5).join("/")}/`;
      return s[0] === "stay" && s[1] ? `${u.origin}/stay/${s[1]}/` : undefined;
    },
  },
  {
    id: "intercontinental",
    name: "InterContinental",
    match: /intercontinental/i,
    domains: ["ihg.com"],
    // ihg.com/intercontinental/hotels/us/en/<city>/<code>/hoteldetail -> .../hotels/us/en/<city>/<code>/
    base: (u) => {
      const s = seg(u);
      const i = s.indexOf("hotels");
      if (i >= 0 && s.length >= i + 5 && /^[a-z]{2}$/i.test(s[i + 1] ?? "") && /^[a-z]{2}$/i.test(s[i + 2] ?? "")) return `${u.origin}/${s.slice(0, i + 5).join("/")}/`;
      return undefined;
    },
  },
  {
    id: "regent",
    name: "Regent",
    match: /\bregent\b/i,
    domains: ["regenthotels.com"],
    secondaryDomains: ["ihg.com"],
    // <city>.regenthotels.com/... -> origin; regenthotels.com/<property>/... -> first segment;
    // ihg.com/regent/hotels/us/en/<city>/<code>/hoteldetail -> .../hotels/us/en/<city>/<code>/
    base: (u) => {
      const host = u.hostname.toLowerCase();
      if (host.endsWith(".regenthotels.com") && !host.startsWith("www.")) return `${u.origin}/`;
      const s = seg(u);
      if (host.endsWith("regenthotels.com")) {
        const b = firstOne(u);
        return b && !/\/(offers|media|careers|about|destinations|search|legal|privacy|news|stories|wp-content)\/$/i.test(b) ? b : undefined;
      }
      const i = s.indexOf("hotels");
      if (i >= 0 && s.length >= i + 5 && /^[a-z]{2}$/i.test(s[i + 1] ?? "") && /^[a-z]{2}$/i.test(s[i + 2] ?? "")) return `${u.origin}/${s.slice(0, i + 5).join("/")}/`;
      return undefined;
    },
  },
  {
    id: "rocco-forte",
    name: "Rocco Forte",
    match: /rocco forte|hotel de russie|brown'?s hotel|hotel de rome|hotel de la ville|villa igiea|verdura|the balmoral|hotel amigo|hotel savoy|the charles hotel|the carlton milano/i,
    domains: ["roccofortehotels.com"],
    // roccofortehotels.com/[en/]hotels-and-resorts/<property>/... and /rocco-forte-house/<property>/... -> property root
    base: (u) => {
      const s = seg(u);
      const o = /^[a-z]{2}$/i.test(s[0] ?? "") ? 1 : 0;
      return (s[o] === "hotels-and-resorts" || s[o] === "rocco-forte-house") && s[o + 1] ? `${u.origin}/${s.slice(0, o + 2).join("/")}/` : undefined;
    },
  },
  { id: "sls", name: "SLS", match: /\bsls\b/i, domains: ["slshotels.com"], secondaryDomains: ["all.accor.com", "ennismore.com"],
    base: (u) => { const b = firstOne(u); return b && !/\/(offers|about|careers|press|news|destinations|search|legal|privacy|residences|stories|loyalty|en|es|fr)\/$/i.test(b) ? b : undefined; } },
  { id: "langham", name: "Langham", match: /langham|cordis/i, domains: ["langhamhotels.com", "cordishotels.com"], base: (u) => (u.hostname.includes("cordishotels") ? firstOne(u) : firstTwo(u)) },
  { id: "hilton", name: "Hilton", match: /waldorf|hilton|conrad|\blxr\b/i, domains: ["hilton.com"],
    secondaryDomains: ["grandwailea.com", "romecavalieri.com", "arizonabiltmore.com", "therooseveltneworleans.com", "waldorfastoria.com", "waldorfastoriaberlin.de"],
    // hilton.com/<lang>/hotels/<ctyhocc-name>/... -> /<lang>/hotels/<ctyhocc-name>/ ; standalone resort domains are single-property
    base: (u) => { if (!u.hostname.endsWith("hilton.com")) return `${u.origin}/`; const s = seg(u); const o = /^[a-z]{2}(-[a-z]{2})?$/i.test(s[0] ?? "") ? 1 : 0;
      return s[o] === "hotels" && s[o + 1] ? `${u.origin}/${s.slice(0, o + 2).join("/")}/` : undefined; } },
  // multi-property group sites used by Leading Hotels members; matched by host only, never guessed from a hotel name
  { id: "como", name: "COMO Hotels", match: /^como\b/i, domains: ["comohotels.com"], base: (u) => { const s = dropLang(seg(u)); return s.length >= 2 ? `${u.origin}/${s[0]}/${s[1]}/` : undefined; } },
  { id: "starhotels", name: "Starhotels", match: /(?!)/, domains: ["starhotels.com", "starhotelscollezione.com"],
    base: (u) => { const s = seg(u); const i = s.findIndex((x) => x === "our-hotels" || x === "scrigno-our-hotels"); return i >= 0 && s[i + 1] ? `${u.origin}/${s.slice(0, i + 2).join("/")}/` : undefined; } },
  { id: "sbm", name: "Monte-Carlo Société des Bains de Mer", match: /(?!)/, domains: ["montecarlosbm.com"],
    base: (u) => { const s = seg(u); const i = s.indexOf("hotel-monaco"); return i >= 0 && s[i + 1] ? `${u.origin}/${s.slice(0, i + 2).join("/")}/` : undefined; } },
  { id: "imperial", name: "Imperial Hotels", match: /(?!)/, domains: ["imperialhotel.co.jp"],
    base: (u) => { const s = seg(u); const o = /^[a-z]{2}$/i.test(s[0] ?? "") ? 1 : 0; return /^(tokyo|osaka|kamikochi|kyoto)$/.test(s[o] ?? "") ? `${u.origin}/${s.slice(0, o + 1).join("/")}/` : undefined; } },
  { id: "melia", name: "Meliá", match: /(?!)/, domains: ["melia.com"],
    // melia.com/<lang>/hotels/<country>/<city>/<hotel>/... -> the hotel's section
    base: (u) => { const s = seg(u); const i = s.indexOf("hotels"); return i >= 0 && s[i + 3] ? `${u.origin}/${s.slice(0, i + 4).join("/")}/` : undefined; } },
  { id: "trump", name: "Trump Hotels", match: /\btrump\b/i, domains: ["trumphotels.com", "trumpdoonbeg.com"],
    // trumphotels.com/<property>/... -> /<property>/ (chain-wide sections excluded); trumpdoonbeg.com is single-property
    base: (u) => { if (u.hostname.includes("trumpdoonbeg")) return `${u.origin}/`; const b = firstOne(u);
      return b && !/\/(properties|special-offers?|special-offer-overview|luxury-hotel-programs|meetings-weddings|pet-friendly-hotels|family-friendly-hotels|best-rate-commitment|careers|contact-us|privacy-policy|terms-of-service|site-map|media|trumpcard|affiliate-charities|luxury-hotel-development|culinary-passport-dinner-series|trump-hotels-planner-privileges)\/$/i.test(b) ? b : undefined; } },
  { id: "montage", name: "Montage", match: /montage/i, domains: ["montage.com", "montagehotels.com"], base: firstOne },
  { id: "oetker", name: "Oetker Collection", match: /oetker|le bristol paris|eden rock|jumby bay|chateau saint-martin/i, domains: ["oetkercollection.com"], base: firstTwo },
  { id: "kempinski", name: "Kempinski", match: /kempinski/i, domains: ["kempinski.com"], base: firstTwo },
  { id: "six-senses", name: "Six Senses", match: /six senses/i, domains: ["sixsenses.com"], base: firstTwo },
  { id: "banyan-tree", name: "Banyan Tree", match: /banyan tree|\bangsana\b/i, domains: ["banyantree.com", "angsana.com"], base: firstTwo },
];

export const chainById = (id: string) => CHAINS.find((c) => c.id === id);
// "Hilton Head" is a place (Omni Hilton Head Oceanfront Resort), not the Hilton chain
export const chainOfName = (name: string) => CHAINS.find((c) => c.match.test(name.replace(/\bhilton head\b|\bpeninsula papagayo\b|\bsun peninsula\b/gi, "")));

const hostIs = (host: string, domain: string) => host === domain || host.endsWith(`.${domain}`);
const bare = (host: string) => host.replace(/^www\./, "").toLowerCase();
/** The chain whose own domain this is (secondary domains excluded). */
export const chainOfHost = (host: string) => CHAINS.find((c) => c.domains.some((d) => hostIs(bare(host), d)));
/** Every chain that treats this host as its own, including parent-company sites. */
export const chainsOfHost = (host: string) => CHAINS.filter((c) => [...c.domains, ...(c.secondaryDomains ?? [])].some((d) => hostIs(bare(host), d)));
export const hostBelongsTo = (chainId: string, host: string) => chainsOfHost(host).some((c) => c.id === chainId);

/** Sites that describe hotels but are never the hotel's own site. */
const THIRD_PARTY = [
  "booking.com", "expedia.", "hotels.com", "tripadvisor.", "agoda.", "trivago.", "kayak.", "orbitz.", "priceline.", "travelocity.",
  "hotelscombined.", "makemytrip.", "trip.com", "ctrip.", "wikipedia.org", "wikivoyage.org", "facebook.com", "instagram.com",
  "youtube.com", "yelp.", "lonelyplanet.", "fodors.", "forbes.com", "telegraph.co.uk", "cntraveler.com", "whatahotel.com",
  "mrandmrssmith.", "smallluxuryhotels.", "slh.com", "leadinghotels.", "relaischateaux.", "preferredhotels.", "virtuoso.",
  "tablethotels.", "hotelsone.", "travelweekly.", "travelagewest.", "travelpulse.", "forbestravelguide.", "lhw.com", "lartisien.",
  "hotelsearch.", "hotels-in-", "fivestaralliance.", "travelandleisure.", "cntraveller.", "momondo.", "skyscanner.", "jetsetter.", "com-hotel.com", "lushexperiences.", "dupontcirclebid.", "hummingbird.travel", "celticcastles.", "historichotels.org", "visitlisboa.com", "guestreservations.", "guide.michelin.com", "luxurylink.", "americanexpress.com", "hotelplanner.", "reservations.com", "google.com", "bing.com", "linkedin.com", "pinterest.", "tiktok.com",
];
// an entry matches at a label boundary, so "hotels.com" catches www.hotels.com but not kivotoshotels.com
const matchesAt = (host: string, t: string) => host.startsWith(t) || host.includes(`.${t}`);
// city booking aggregators that put the hotel's name in a subdomain (me-by-melia.lisbongreathotels.com)
// and city booking aggregators that host one subdomain per hotel (41-hotel.londonhotelsgb.com)
const AGGREGATOR_HOST = /(^|\.)[a-z]+greathotels\.com$|^(?!www\.)[a-z0-9]+-[a-z0-9-]+\.[a-z]+hotels[a-z]{0,3}\.com$/;
export const isThirdParty = (host: string) =>
  !chainOfHost(host) && (AGGREGATOR_HOST.test(host) || THIRD_PARTY.some((t) => matchesAt(host, t)));
