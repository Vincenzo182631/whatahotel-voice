import type { Kind } from "./extract.js";
import type { Benefit } from "./store.js";

/**
 * Builds the spoken WhataHotel closing from the verified benefits of one hotel. Wording, sentence shape and
 * the order of benefits vary from hotel to hotel; the facts and conditions never do. Pure and seeded, so a hotel
 * gets the same words every time it is composed.
 */

export interface Closing {
  template: string;
  text: string;
  words: number;
  benefits: Kind[];
}

function hash(s: string): number {
  let h = 2166136261;
  for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return h >>> 0;
}
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = <T,>(r: () => number, xs: T[]): T => xs[Math.floor(r() * xs.length)]!;

const money = (n: number) => `$${n}`;

/** Spoken phrases per benefit. Every variant says the same thing; an upgrade is never promised. */
function phrases(b: Benefit): string[] {
  switch (b.kind) {
    case "breakfast":
      return ["complimentary daily breakfast for two", "free breakfast for two every day", "complimentary breakfast for two each day", "free daily breakfast for two"];
    case "wifi":
      return ["complimentary Wi-Fi access", "free Wi-Fi", "free Wi-Fi access", "complimentary Wi-Fi"];
    case "upgrade":
      return [
        "priority for a room upgrade at check-in, subject to availability",
        "a priority upgrade when one is available at check-in",
        "priority for an upgrade at check-in when one is available",
        "priority consideration for a room upgrade at check-in, subject to availability",
      ];
    case "credit": {
      const amt = b.amount ? money(b.amount) : undefined;
      if (!amt) return [];
      const fnb = b.qualifiers.includes("food_beverage_or_spa");
      const stay = b.qualifiers.includes("per_stay");
      const tail = `${stay ? " per stay" : ""}${b.suiteAmount ? `, or ${money(b.suiteAmount)} for suites` : b.suitesHigher ? ", with a higher credit for suites" : ""}`;
      return fnb
        ? [`a ${amt} credit toward food and beverage or the spa${tail}`, `a ${amt} food and beverage or spa credit${tail}`, `${amt} to spend on food and beverage or at the spa${tail}`]
        : [`a ${amt} hotel credit${tail}`, `a ${amt} credit at the hotel${tail}`, `a ${amt} property credit${tail}`];
    }
    default:
      return [];
  }
}

const COMBINE = [
  "That preferred-rate offer can also be combined with the hotel's listed exclusive perks, subject to each offer's terms.",
  "The hotel's listed exclusive perks can be combined with this preferred-rate offer, subject to each offer's terms.",
  "It can also be combined with the hotel's listed exclusive perks, subject to the terms of each offer.",
];

const list = (xs: string[]) => (xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")}, and ${xs[xs.length - 1]}`);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

interface Template {
  id: string;
  build: (items: string) => string;
}
const TEMPLATES: Template[] = [
  { id: "check-pref", build: (i) => `Check WhataHotel for preferred rates here, which include ${i}.` },
  { id: "book-through", build: (i) => `Book through WhataHotel's preferred rate and you'll get ${i}.` },
  { id: "that-is-what", build: (i) => `${cap(i)}: that's what the WhataHotel preferred rate adds at this hotel.` },
  { id: "expect", build: (i) => `With WhataHotel's preferred rate at this hotel, expect ${i}.` },
  { id: "if-you-book", build: (i) => `If you book through WhataHotel, the preferred rate comes with ${i}.` },
  { id: "one-more", build: (i) => `One more thing: the WhataHotel preferred rate here brings ${i}.` },
  { id: "for-this", build: (i) => `For this property, WhataHotel's preferred rate adds ${i}.` },
  { id: "look-for", build: (i) => `Look for the WhataHotel preferred rate, which brings ${i}.` },
  { id: "worth-asking", build: (i) => `Worth knowing: WhataHotel's preferred rate includes ${i}.` },
  { id: "when-you", build: (i) => `When you reserve with WhataHotel's preferred rate, you also get ${i}.` },
];

const NONE = [
  { id: "none-check", text: "Check this hotel's WhataHotel page for available preferred rates and offers." },
  { id: "none-see", text: "For current preferred rates and offers at this hotel, see its WhataHotel page." },
  { id: "none-find", text: "You can find this hotel's available rates and offers on its WhataHotel page." },
];

const wordCount = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

export interface ComposeOptions {
  /** Templates other hotels' recent closings used; avoided so consecutive clips do not end alike. */
  recentTemplates?: string[];
  /** Texts of recent closings; never repeated exactly. */
  recentTexts?: string[];
}

export function composeClosing(slug: string, benefits: Benefit[], opts: ComposeOptions = {}): Closing {
  const confirmed = benefits.filter((b) => b.status === "confirmed" && (b.kind !== "credit" || b.amount) && b.kind !== "combinable");
  const combine = benefits.some((b) => b.kind === "combinable" && b.status === "confirmed");
  const recentT = new Set(opts.recentTemplates ?? []);
  const recentX = new Set(opts.recentTexts ?? []);
  const kinds = confirmed.map((b) => b.kind);

  for (let attempt = 0; attempt < 40; attempt++) {
    const r = rng(hash(`${slug}#${attempt}`));
    if (!confirmed.length) {
      const opt = NONE.filter((n) => !recentT.has(n.id) && !recentX.has(n.text));
      const n = pick(r, opt.length ? opt : NONE);
      return { template: n.id, text: n.text, words: wordCount(n.text), benefits: [] };
    }
    const order = [...confirmed];
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [order[i], order[j]] = [order[j]!, order[i]!];
    }
    // a phrase with its own comma ("..., subject to availability") would blur the list, so it only goes last
    const chosen = order.map((b) => {
      const all = phrases(b);
      const plain = all.filter((x) => !x.includes(","));
      return { b, all, plain };
    });
    chosen.sort((x, y) => Number(!x.plain.length) - Number(!y.plain.length));
    const lastIdx = chosen.length - 1;
    const parts = chosen.map((c, i) => pick(r, i === lastIdx || !c.plain.length ? c.all : c.plain));
    const items = list(parts);
    const pool = TEMPLATES.filter((t) => !recentT.has(t.id));
    const t = pick(r, pool.length ? pool : TEMPLATES);
    const text = `${t.build(items)}${combine ? ` ${pick(r, COMBINE)}` : ""}`;
    if (attempt < 39 && recentX.has(text)) continue;
    return { template: `${t.id}${combine ? "+combine" : ""}`, text, words: wordCount(text), benefits: [...kinds, ...(combine ? (["combinable"] as const) : [])] };
  }
  throw new Error("unreachable");
}

/** Problems with a closing against what was verified: a benefit that was not confirmed, or wording that promises too much. */
export function checkClosing(text: string, benefits: Benefit[]): string[] {
  const issues: string[] = [];
  const ok = (k: Kind) => benefits.some((b) => b.kind === k && b.status === "confirmed");
  if (/breakfast/i.test(text) && !ok("breakfast")) issues.push("closing mentions breakfast, which is not confirmed for this hotel");
  if (/wi-?fi/i.test(text) && !ok("wifi")) issues.push("closing mentions Wi-Fi, which is not confirmed for this hotel");
  if (/upgrade/i.test(text) && !ok("upgrade")) issues.push("closing mentions an upgrade, which is not confirmed for this hotel");
  if (/\bcredit\b|\$\d/i.test(text) && !ok("credit")) issues.push("closing mentions a credit, which is not confirmed for this hotel");
  if (/combin/i.test(text) && !ok("combinable")) issues.push("closing says offers can be combined, which WhataHotel does not explicitly confirm for this hotel");
  if (/upgrade/i.test(text) && !/availab|if one is|when one is/i.test(text)) issues.push("closing mentions an upgrade without saying it depends on availability");
  if (/guarantee|will be upgraded|you'?ll be upgraded/i.test(text)) issues.push("closing promises an upgrade");
  const credit = benefits.find((b) => b.kind === "credit" && b.status === "confirmed");
  if (credit?.qualifiers.includes("food_beverage_or_spa") && /\bcredit\b|\$\d/i.test(text) && !/food and beverage/i.test(text)) issues.push("credit condition (food and beverage or spa) is missing from the closing");
  if ((credit?.suiteAmount || credit?.suitesHigher) && /\bcredit\b|\$\d/i.test(text) && !/suites?/i.test(text)) issues.push("credit condition (higher amount for suites) is missing from the closing");
  if (credit?.qualifiers.includes("per_stay") && /\bcredit\b|\$\d/i.test(text) && !/per stay/i.test(text)) issues.push("credit condition (per stay) is missing from the closing");
  return issues;
}
