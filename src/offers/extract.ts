import { htmlToLines } from "../sources/whatahotel.js";

/** The benefits a closing may mention. Anything else on a page is recorded but never spoken. */
export type Kind = "breakfast" | "wifi" | "upgrade" | "credit" | "combinable";

export interface Found {
  kind: Kind;
  excerpt: string;
}

export interface HotelOffer {
  found: Found[];
  /** The amount in the perks table's credit row ("$100 Credit"), if it names one. */
  tableCredit?: number;
  /** Every dollar amount WhataHotel prints next to the word "credit", classified. */
  creditFacts: CreditFact[];
  /** WhataHotel says suites (or higher room categories) carry a higher credit. */
  suitesHigher: boolean;
  creditQualifiers: CreditQualifier[];
  /** Words the page puts on the upgrade ("if available", "subject to availability"). */
  upgradeGuaranteed: boolean;
  combinable: "explicit" | "none";
  /** Terms printed with the current special offer (rate code, blackout dates, restrictions). */
  restrictions: string[];
  /** Current special offer headings, kept in the research output only. */
  specialOffers: string[];
}

export type CreditQualifier = "food_beverage_or_spa" | "per_stay";

/** standalone: a flat amount; range: "$100-$200"; suite: "$200 for suites"; nightly: a different promotion ("$200 Nightly Resort Credit"). */
export interface CreditFact {
  amount: number;
  kind: "standalone" | "range" | "suite" | "nightly";
  excerpt: string;
}

export interface ChainOffer {
  found: Found[];
  creditFacts: CreditFact[];
  suitesHigher: boolean;
  creditQualifiers: CreditQualifier[];
  upgradeNotes: string[];
  upgradeGuaranteed: boolean;
  breakfastGuests: number[];
  /** "hedged" when the chain page says combinability depends on the offer. */
  combinable: "explicit" | "hedged" | "none";
  combinableExcerpt?: string;
}

const GUARANTEED = /guaranteed (room )?upgrade|upgrade (is )?guaranteed|confirmed upgrade/i;
const norm = (s: string) => s.replace(/\s+/g, " ").trim();
export function creditFactsIn(text: string): { facts: CreditFact[]; suitesHigher: boolean } {
  const facts: CreditFact[] = [];
  const seen = new Set<string>();
  const add = (f: CreditFact) => {
    const key = `${f.kind}:${f.amount}`;
    if (!seen.has(key)) {
      seen.add(key);
      facts.push(f);
    }
  };
  const money = "(?:USD|US\\$|\\$)\\s?";
  const seg = new RegExp(`[^.\\n]{0,70}${money}\\d{2,4}(?:\\s*(?:-|to)\\s*(?:USD|US\\$|\\$)?\\s?\\d{2,4})?[^.\\n]{0,60}`, "gi");
  for (const m of text.matchAll(seg)) {
    const segment = norm(m[0]);
    if (!/credit/i.test(segment)) continue;
    const nightly = /nightly|per night/i.test(segment);
    for (const n of segment.matchAll(new RegExp(`${money}(\\d{2,4})(?:\\s*(-|to)\\s*(?:USD|US\\$|\\$)?\\s?(\\d{2,4}))?(\\s+for\\s+suites?)?`, "gi"))) {
      const low = Number(n[1]);
      if (n[2]) {
        add({ amount: low, kind: "range", excerpt: segment });
        add({ amount: Number(n[3]), kind: "range", excerpt: segment });
      } else add({ amount: low, kind: n[4] ? "suite" : nightly ? "nightly" : "standalone", excerpt: segment });
    }
  }
  const suitesHigher = facts.some((f) => f.kind === "suite") || /suites?[^.\n]{0,60}(higher|more) credit|higher credit[^.\n]{0,60}suites?|credit[^.\n]{0,30}higher[^.\n]{0,40}suites?/i.test(text);
  return { facts, suitesHigher };
}

const qualifiersIn = (text: string): CreditQualifier[] => [
  ...(/food (and|&) beverage( or spa)?|spa credit/i.test(text) ? (["food_beverage_or_spa"] as const) : []),
  ...(/per stay/i.test(text) ? (["per_stay"] as const) : []),
];

/** The "Perks Comparison" block of a WhataHotel hotel page, plus every credit amount printed anywhere on it. */
export function parseHotelOffer(html: string): HotelOffer {
  const lines = htmlToLines(html);
  const start = lines.findIndex((l) => /^perks comparison$/i.test(l));
  const block = start < 0 ? [] : lines.slice(start + 1, start + 25);
  const end = block.findIndex((l) => /^(all reservations booked|the best way to book)/i.test(l));
  const table = end < 0 ? block : block.slice(0, end);

  const found: Found[] = [];
  const add = (kind: Kind, re: RegExp, within: string[]) => {
    const line = within.find((l) => re.test(l));
    if (line) found.push({ kind, excerpt: line });
  };
  add("breakfast", /^free breakfast for (2|two)( guests)? daily$/i, table);
  add("wifi", /^free wi-?fi( access)?$/i, table);
  add("upgrade", /priority upgrade if available at check-?in/i, table);
  add("credit", /^\$\s?\d+ credit$/i, table);
  if (!found.some((f) => f.kind === "credit")) add("credit", /^hotel credit$/i, table);
  const combinable = table.find((l) => /combinable with (the )?exclusive perks/i.test(l));
  if (combinable) found.push({ kind: "combinable", excerpt: combinable });

  const allText = `${lines.join("\n")}\n${html.replace(/<[^>]+>/g, " ")}`;
  const credit = creditFactsIn(allText);
  const creditRow = table.find((l) => /^\$\s?\d+ credit$/i.test(l));
  const rowAmount = creditRow ? /\$\s?(\d+)/.exec(creditRow) : null;
  const specialStart = lines.findIndex((l) => /^special offer$/i.test(l));
  const specialBlock = specialStart < 0 ? [] : lines.slice(specialStart + 1, specialStart + 14);
  return {
    found,
    ...(rowAmount ? { tableCredit: Number(rowAmount[1]) } : {}),
    creditFacts: credit.facts,
    suitesHigher: credit.suitesHigher,
    creditQualifiers: qualifiersIn(lines.filter((l) => /credit/i.test(l)).join(" ")),
    // only the perk's own wording counts; a dated special offer ("Guaranteed Upgrade, valid thru ...") is a different thing
    upgradeGuaranteed: GUARANTEED.test(`${table.join("\n")}\n${(allText.match(/[^.\n]*preferred (?:partner|rate)[^.\n]*upgrade[^.\n]*/gi) ?? []).join("\n")}`),
    combinable: combinable ? "explicit" : "none",
    restrictions: specialBlock.filter((l) => /subject to availability|blackout|restrictions|discontinued|must be selected|not available/i.test(l)).map((l) => l.slice(0, 220)),
    specialOffers: specialBlock.filter((l) => l.length < 90 && !/^(\*|if you|all offers|offers may|combinable|details|get )/i.test(l)).slice(0, 3),
  };
}

/** The perks a WhataHotel chain page lists for every property in the chain. */
export function parseChainOffer(html: string): ChainOffer {
  const lines = htmlToLines(html);
  const head = lines.slice(0, 120);
  const text = head.join("\n");
  const found: Found[] = [];
  const grab = (kind: Kind, re: RegExp) => {
    const line = head.find((l) => re.test(l));
    if (line) found.push({ kind, excerpt: line.slice(0, 240) });
    return line;
  };
  grab("breakfast", /breakfast for (two|2)/i);
  const creditLine = grab("credit", /(USD|\$)\s?\d+.*credit|credit.*(USD|\$)\s?\d+/i);
  grab("upgrade", /upgrade/i);
  // sentences about other hotels' current offers ("for example Four Seasons Bahrain Bay: ... USD 250 Credit") are not the chain's perks
  const perkLines = head.filter((l) => !/offers currently listed|for example|chain specials/i.test(l));
  const credit = creditFactsIn(perkLines.join("\n"));
  const combLine = head.find((l) => /combin/i.test(l) && /(yes|generally|decided|per offer|depends|may|can be)/i.test(l));
  const hedged = !!combLine && /generally|decided per offer|per offer|depends|may |varies/i.test(combLine);
  const upgradeNotes = head.filter((l) => /upgrade/i.test(l) && /(subject to|if available|availability|granted)/i.test(l)).slice(0, 3);
  return {
    found,
    creditFacts: credit.facts,
    suitesHigher: credit.suitesHigher,
    creditQualifiers: creditLine ? qualifiersIn(creditLine) : [],
    upgradeNotes,
    upgradeGuaranteed: GUARANTEED.test(perkLines.filter((l) => /upgrade/i.test(l)).join("\n")),
    breakfastGuests: [...text.matchAll(/breakfast for (two|2|one|1|three|3|four|4)\b/gi)].map((m) => ({ one: 1, "1": 1, two: 2, "2": 2, three: 3, "3": 3, four: 4, "4": 4 })[m[1]!.toLowerCase() as "two"]!),
    combinable: combLine ? (hedged ? "hedged" : "explicit") : "none",
    combinableExcerpt: combLine?.slice(0, 260),
  };
}
