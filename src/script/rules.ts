import { allClaims } from "../core/profile.js";
import { Section, type HotelProfile, type Script } from "../core/schema.js";

/** ~2.2 spoken words per second, measured on ElevenLabs eleven_v3 two-host dialogue. */
export const WORDS_PER_SECOND = 2.2;
export const TARGET_SECONDS = 75;
export const WORD_RANGE = { min: 150, max: 170 } as const;
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

export function wordCount(script: Script): number {
  return script.turns.reduce((n, t) => n + t.text.trim().split(/\s+/).filter(Boolean).length, 0);
}

export function estimateSeconds(script: Script): number {
  return Math.round(wordCount(script) / WORDS_PER_SECOND);
}

/** Deterministic checks that need no model call. Returns a list of problems. */
export function checkScript(script: Script, profile: HotelProfile): string[] {
  const issues: string[] = [];
  const words = wordCount(script);
  if (words < WORD_RANGE.min || words > WORD_RANGE.max) {
    issues.push(`word count ${words} outside ${WORD_RANGE.min}-${WORD_RANGE.max} (~${TARGET_SECONDS}s)`);
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

  const claimIds = new Set(allClaims(profile).map((c) => c.id));
  const considerationIds = new Set(profile.considerations.map((c) => c.id));
  script.turns.forEach((t, i) => {
    for (const id of t.claim_ids) {
      if (!claimIds.has(id)) issues.push(`turn ${i} cites unknown claim "${id}"`);
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

  if (profile.perks.length > 0) {
    const perkIds = new Set(profile.perks.map((c) => c.id));
    const bottomCites = script.turns.filter((t) => t.section === "bottom_line").flatMap((t) => t.claim_ids);
    if (!bottomCites.some((id) => perkIds.has(id))) issues.push('"bottom_line" must state the WhataHotel perks and cite a perk claim');
  }

  const chars = script.turns.reduce((n, t) => n + t.text.length, 0);
  if (chars > DIALOGUE_CHAR_LIMIT * 2) issues.push(`script is ${chars} chars; too long for a ~75s piece`);
  return issues;
}
