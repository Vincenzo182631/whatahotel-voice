import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { Kind } from "./extract.js";

/** What a closing may say about one benefit, after WhataHotel's hotel page and chain page were compared. */
export interface Benefit {
  kind: Kind;
  status: "confirmed" | "unclear" | "conflict" | "absent";
  /** Only for confirmed benefits: the facts a spoken phrase must keep. */
  amount?: number;
  /** Printed as "($200 for suites)": a higher amount WhataHotel ties to suites; the closing must say so. */
  suiteAmount?: number;
  /** WhataHotel says suites carry a higher credit without naming one amount; the closing must say so. */
  suitesHigher?: boolean;
  qualifiers: Array<"food_beverage_or_spa" | "per_stay" | "availability" | "terms">;
  hotel_excerpt?: string;
  chain_excerpt?: string;
  note?: string;
}

export interface OfferSet {
  slug: string;
  hotel: { name: string; url: string };
  chain?: { name?: string; url?: string };
  checked_at: string;
  status: "ready" | "needs_review";
  benefits: Benefit[];
  /** Problems a person should look at; the affected benefit is left out of the closing. */
  issues: string[];
  special_offers: string[];
  restrictions: string[];
  /** The closing chosen for this hotel, stored so every later step (writer budget, check, audio) uses the same words. */
  closing?: { template: string; text: string; words: number; benefits: Kind[] };
}

export const offersDir = (slug: string) => path.resolve(process.env.WH_RESEARCH_DIR ?? "data/research", slug);
export const offersFile = (slug: string) => path.join(offersDir(slug), "offers.json");

/** The stored offers for a hotel, or undefined when none were built (legacy hotels keep their existing closing). */
export function loadOffersSync(slug: string): OfferSet | undefined {
  const file = offersFile(slug);
  if (!existsSync(file)) return undefined;
  try {
    return JSON.parse(readFileSync(file, "utf8")) as OfferSet;
  } catch {
    return undefined;
  }
}
