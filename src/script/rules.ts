import { isExpired } from "../core/freshness.js";
import { allClaims } from "../core/profile.js";
import { Section, type HotelProfile, type Script } from "../core/schema.js";
import { checkClosing } from "../offers/closing.js";
import { loadOffersSync } from "../offers/store.js";

/** ~2.5 spoken words per second, measured on ElevenLabs eleven_v4 two-host dialogue (eleven_v3 was ~2.2). */
export const WORDS_PER_SECOND = 2.5;
/** The voiced audio must land inside this window (checked on the real audio, not estimated). */
export const AUDIO_SECONDS = { min: 75, max: 100 } as const;
/** eleven_v4 pace is about 2.3-2.7 words/s, so these words keep audio inside AUDIO_SECONDS. */
export const WORD_RANGE = { min: 205, max: 230 } as const;
/** ElevenLabs Text-to-Dialogue limit per request; longer scripts get chunked. */
export const DIALOGUE_CHAR_LIMIT = 2000;

const BANNED: Array<[RegExp, string]> = [
  [/\bpros\b|\bcons\b/i, 'uses "pros/cons" framing; say "what stands out" / "things to consider"'],
  [/\bpodcast\b/i, 'calls itself a podcast'],
  [/\b(as an ai|language model)\b/i, "mentions being AI"],
  [/\bguarantee[ds]?\b/i, "makes a guarantee"],
  [/\b(best|greatest) (hotel|resort) in the world\b/i, "unsupported superlative"],
  [/\b(book now|don'?t miss out|limited time)\b/i, "sales pressure language"],
];

/**
 * The WhataHotel signature: the perks, spoken word for word as the last turn of every clip by the
 * Luxury Advisor. The pipeline adds it; the writer never writes perks.
 */
export const PERKS_SIGNATURE =
  "With the WhataHotel Preferred Rate, you get free breakfast for two daily, free Wi-Fi, a priority upgrade if available at check-in, a $100 hotel credit, among other perks.";
export const PERKS_SIGNATURE_CLAIMS = ["p-1", "p-5", "p-2", "p-3"] as const;
export const PERKS_SIGNATURE_WORDS = PERKS_SIGNATURE.split(/\s+/).length;

/**
 * Rewordings of the same perks, each exactly PERKS_SIGNATURE_WORDS long, so clips for different
 * hotels do not all end on identical audio. Four Seasons clips keep the original line.
 */
export const PERKS_SIGNATURE_VARIANTS = [
  PERKS_SIGNATURE,
  "Book the WhataHotel Preferred Rate and enjoy free breakfast for two daily, free Wi-Fi, a priority upgrade when available at check-in, a $100 hotel credit, plus other perks.",
  "The WhataHotel Preferred Rate brings free daily breakfast for two, free Wi-Fi, a priority upgrade if available at check-in, a $100 hotel credit, and other perks as well.",
  "Reserve the WhataHotel Preferred Rate to get free daily breakfast for two, free Wi-Fi, a priority upgrade if available at check-in, a $100 hotel credit, among other perks.",
  "Choose the WhataHotel Preferred Rate for free breakfast for two daily, free Wi-Fi, a priority upgrade if available at check-in, a $100 hotel credit, and other perks besides.",
  "Under the WhataHotel Preferred Rate, enjoy free breakfast for two every day, free Wi-Fi, a priority upgrade if available at check-in, a $100 hotel credit, among other perks.",
  "With the WhataHotel Preferred Rate comes free breakfast for two each day, free Wi-Fi, a priority upgrade if available at check-in, a $100 hotel credit, and other perks.",
  "Booking the WhataHotel Preferred Rate means free breakfast for two every day, free Wi-Fi, a priority upgrade if available at check-in, a $100 hotel credit, among other perks.",
];

/** The signature line for a hotel: the original for Four Seasons, otherwise a stable pick by hotel name. */
export function signatureFor(profile: HotelProfile): string {
  if (/four seasons/i.test(profile.name)) return PERKS_SIGNATURE;
  let h = 0;
  for (const ch of profile.name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PERKS_SIGNATURE_VARIANTS[h % PERKS_SIGNATURE_VARIANTS.length]!;
}

/**
 * The closing line for a hotel. Hotels with verified offers (hotel:offers) get a closing built from exactly the
 * benefits WhataHotel confirmed for that property; hotels without them keep the fixed signature line.
 */
export function closingFor(profile: HotelProfile): { text: string; words: number; verified: boolean } {
  const offers = loadOffersSync(profile.slug);
  if (offers?.closing) return { text: offers.closing.text, words: offers.closing.words, verified: true };
  const text = signatureFor(profile);
  return { text, words: text.trim().split(/\s+/).length, verified: false };
}

/** Appends the closing turn (replacing any perk turns already present, so it is idempotent). */
export function withSignature(script: Script, profile: HotelProfile): Script {
  const closing = closingFor(profile);
  if (closing.verified) {
    const turns = script.turns.filter((t) => t.text !== closing.text);
    turns.push({ speaker: "advisor", section: "bottom_line", text: closing.text, claim_ids: [] });
    return { ...script, turns };
  }
  const perkIds = new Set(profile.perks.map((c) => c.id));
  if (!PERKS_SIGNATURE_CLAIMS.every((id) => perkIds.has(id))) return script;
  const turns = script.turns.filter((t) => !t.claim_ids.some((id) => perkIds.has(id)));
  turns.push({ speaker: "advisor", section: "bottom_line", text: signatureFor(profile), claim_ids: [...PERKS_SIGNATURE_CLAIMS] });
  return { ...script, turns };
}

export function wordCount(script: Script): number {
  return script.turns.reduce((n, t) => n + t.text.trim().split(/\s+/).filter(Boolean).length, 0);
}

export function estimateSeconds(script: Script): number {
  return Math.round(wordCount(script) / WORDS_PER_SECOND);
}

/** Null when the audio length is inside AUDIO_SECONDS, otherwise what is wrong with it. */
export function checkDuration(seconds: number): string | null {
  if (seconds < AUDIO_SECONDS.min) return `audio is ${seconds}s, under the ${AUDIO_SECONDS.min}s minimum`;
  if (seconds > AUDIO_SECONDS.max) return `audio is ${seconds}s, over the ${AUDIO_SECONDS.max}s maximum`;
  return null;
}

/** Deterministic checks that need no model call. Returns a list of problems. */
export function checkScript(script: Script, profile: HotelProfile, today: Date = new Date()): string[] {
  const issues: string[] = [];
  const words = wordCount(script);
  if (words < WORD_RANGE.min || words > WORD_RANGE.max) {
    issues.push(`word count ${words} outside ${WORD_RANGE.min}-${WORD_RANGE.max} (${AUDIO_SECONDS.min}-${AUDIO_SECONDS.max}s of audio)`);
  }

  const order = Section.options;
  const first = script.turns[0];
  const last = script.turns[script.turns.length - 1];
  if (first?.section !== "hook") issues.push("first turn must be the hook");
  if (last?.section !== "bottom_line") issues.push("last turn must be the bottom line");
  for (const section of order) {
    if (!script.turns.some((t) => t.section === section)) issues.push(`missing section "${section}"`);
  }
  for (let i = 1; i < script.turns.length; i++) {
    const prev = order.indexOf(script.turns[i - 1]!.section);
    const cur = order.indexOf(script.turns[i]!.section);
    if (cur < prev) issues.push(`turn ${i} goes back to "${script.turns[i]!.section}" after a later section`);
  }

  let run = 1;
  for (let i = 1; i < script.turns.length; i++) {
    run = script.turns[i]!.speaker === script.turns[i - 1]!.speaker ? run + 1 : 1;
    if (run > 2) issues.push(`turn ${i}: same speaker three times in a row`);
  }
  if (!script.turns.some((t) => t.speaker === "traveler" && t.section === "to_know")) {
    issues.push('the Candid Traveler must speak in "to_know"');
  }

  const expiredClaims = new Map(allClaims(profile).filter((c) => isExpired(c, today)).map((c) => [c.id, c.expires]));
  const claimIds = new Set(allClaims(profile).map((c) => c.id));
  const considerationIds = new Set(profile.considerations.map((c) => c.id));
  script.turns.forEach((t, i) => {
    for (const id of t.claim_ids) {
      if (!claimIds.has(id)) issues.push(`turn ${i} cites unknown claim "${id}"`);
      if (expiredClaims.has(id)) issues.push(`turn ${i} cites claim "${id}", which expired on ${expiredClaims.get(id)}`);
    }
    for (const [re, why] of BANNED) {
      if (re.test(t.text)) issues.push(`turn ${i} ${why}`);
    }
    if (t.section !== "hook" && t.section !== "bottom_line" && t.claim_ids.length === 0 && /\d/.test(t.text)) {
      issues.push(`turn ${i} states a number without citing a claim`);
    }
  });
  const toKnowCites = script.turns.filter((t) => t.section === "to_know").flatMap((t) => t.claim_ids);
  if (!toKnowCites.some((id) => considerationIds.has(id))) {
    issues.push('"to_know" must cite at least one consideration');
  }

  const verifiedClosing = closingFor(profile);
  if (verifiedClosing.verified) {
    const last = script.turns[script.turns.length - 1];
    if (last?.text !== verifiedClosing.text || last.speaker !== "advisor" || last.section !== "bottom_line") {
      issues.push("the last turn must be the WhataHotel closing line for this hotel, spoken by the Luxury Advisor, word for word");
    }
    issues.push(...checkClosing(verifiedClosing.text, loadOffersSync(profile.slug)!.benefits));
    script.turns.slice(0, -1).forEach((t, i) => {
      if (/preferred rate|free breakfast|complimentary breakfast|\bwi-?fi\b|room upgrade|priority upgrade|hotel credit/i.test(t.text)) issues.push(`turn ${i} mentions WhataHotel benefits; only the closing line may`);
    });
  } else if (PERKS_SIGNATURE_CLAIMS.every((id) => profile.perks.some((c) => c.id === id))) {
    const last = script.turns[script.turns.length - 1];
    if (last?.text !== signatureFor(profile) || last.speaker !== "advisor" || last.section !== "bottom_line") {
      issues.push("the last turn must be the WhataHotel signature line, spoken by the Luxury Advisor, word for word");
    }
    const perkIds = new Set(profile.perks.map((c) => c.id));
    script.turns.slice(0, -1).forEach((t, i) => {
      if (t.claim_ids.some((id) => perkIds.has(id))) issues.push(`turn ${i} states the perks; only the signature line may`);
    });
  }

  const chars = script.turns.reduce((n, t) => n + t.text.length, 0);
  if (chars > DIALOGUE_CHAR_LIMIT * 2) issues.push(`script is ${chars} chars; too long for a ~75s piece`);
  return issues;
}
