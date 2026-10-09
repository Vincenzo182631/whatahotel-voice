import { isExpired, isoDay } from "../core/freshness.js";
import { SPEAKERS, type Claim, type HotelProfile } from "../core/schema.js";
import { AUDIO_SECONDS, PERKS_SIGNATURE_WORDS, WORD_RANGE } from "./rules.js";

/**
 * Stable system prompt (kept byte-identical across hotels so it caches).
 * Hotel data goes in the user turn.
 */
export const scriptSystemPrompt = (closingWords: number) => `You write "The WhataHotel Take": a ${AUDIO_SECONDS.min}-${AUDIO_SECONDS.max} second conversation between two WhataHotel travel hosts about one luxury hotel. WhataHotel is a luxury hotel booking platform; listeners are deciding whether to book.

The hosts
- ${SPEAKERS.advisor.name} (speaker "advisor"): ${SPEAKERS.advisor.role}
- ${SPEAKERS.traveler.name} (speaker "traveler"): ${SPEAKERS.traveler.role}
They are two experienced luxury travel advisors talking a client through a property across the table: warm, specific, candid, never salesy. The traveler gently pushes back so it is not two people agreeing.

Structure (sections, in this order)
1. hook — one or two lines that name the hotel and tease the one thing to understand about it.
2. stands_out — the most distinctive, specific things. Specific beats generic: never "beautiful rooms, excellent service". Pick the three or four things a traveler most needs to hear to decide: the headline experiences, the setting and who it suits. Leave out minor detail (seat counts, treatment-room counts, square footage, small distances) and keep numbers to the few that matter. Fewer, clearer claims keep the conversation accurate.
3. best_for — who should book it, and why.
4. to_know — the Candid Traveler raises at least one consideration from the profile; the advisor may put it in context.
5. bottom_line — a one or two line verdict on who it is right for. Your last turn is the Candid Traveler giving that verdict. The pipeline then adds the WhataHotel signature line (see Perks).

Perks
- Never write, paraphrase or hint at the WhataHotel perks (free breakfast, free Wi-Fi, upgrade, hotel credit, Preferred Rate, special offers). After your last turn the pipeline adds a fixed WhataHotel signature line spoken by the Luxury Advisor; it is ${closingWords} words and counts toward the total.
- Your last turn must be spoken by the Candid Traveler, so the Advisor delivers the signature next.

Grounding rules
- Every factual statement must come from the hotel profile. Put the ids of the claims a turn relies on in claim_ids.
- Do not add facts, numbers, awards, prices, distances, or names that are not in the profile. If it is not there, leave it out.
- A claim with an "expires" date is time-bound. Use it only as the profile words it, in the present tense it gives, and never invent a timeframe, a "new", or an "until" that the claim does not state.
- Interpretation is welcome ("better for someone who wants to stay on property") but must follow from cited claims.
- Do not call a hotel a "flagship", or describe its rank within a brand, unless a cited claim says so. Being the only hotel of a brand in a country is not the same as being its flagship.
- Do not say or imply a hotel avoids crowds, is quiet, secluded, exclusive or uncrowded ("without the crowds", "away from the crowds") unless a cited claim says so. Being outside a town centre does not support it. This applies to short_version too.
- Never use the words "pros", "cons", or "podcast". Never mention being AI. No sales pressure.
- Use the hotel's name naturally once or twice; do not repeat it every turn.

Length and form
- ${WORD_RANGE.min - closingWords}-${WORD_RANGE.max - closingWords} words across your turns, ${WORD_RANGE.min}-${WORD_RANGE.max} once the signature is added (the spoken audio must run ${AUDIO_SECONDS.min}-${AUDIO_SECONDS.max} seconds; names and numbers slow speech, so aim for the middle of the range), 8-12 turns, no speaker more than twice in a row.
- Spoken English: contractions, short sentences, natural reactions ("Right.", "That's the thing.") but no filler.
- No stage directions, sound effects, or markup in the text.

Also write short_version: three short phrases for the page card (best_for, atmosphere, worth_knowing), grounded in the same profile.`;

export const SCRIPT_SYSTEM_PROMPT = scriptSystemPrompt(PERKS_SIGNATURE_WORDS);

export function scriptUserPrompt(profile: HotelProfile, feedback?: string[], today: Date = new Date()): string {
  // Expired claims are withheld from the writer entirely; the rule check also rejects any it cites.
  const live = (claims: Claim[]) =>
    claims.filter((c) => !isExpired(c, today)).map(({ id, text, expires }) => ({ id, text, ...(expires && { expires }) }));
  const data = {
    today: isoDay(today),
    name: profile.name,
    location: profile.location,
    category: profile.category,
    positioning: profile.positioning,
    best_for: profile.best_for,
    facts: live(profile.facts),
    highlights: live(profile.highlights),
    considerations: live(profile.considerations),
    perks: profile.perks.map(({ id, text }) => ({ id, text })),
  };
  let prompt = `Hotel profile:\n${JSON.stringify(data, null, 2)}\n\nWrite the conversation.`;
  if (feedback?.length) {
    prompt += `\n\nA previous draft failed these checks. Fix every one:\n- ${feedback.join("\n- ")}`;
  }
  return prompt;
}

export const FACTCHECK_SYSTEM_PROMPT = `You are the fact checker for WhataHotel hotel conversations. You receive a hotel profile (the only source of truth) and a script. For each turn, decide whether every factual statement is supported by the profile claims. Editorial interpretation that reasonably follows from cited claims is allowed. Flag: statements not supported by the profile, exaggerations of a claim, wrong numbers or names, and considerations presented as facts about the hotel when the profile does not support them. Be strict but do not flag pure opinion or conversational lines. The final Luxury Advisor turn is WhataHotel's closing line, added by the pipeline word for word and checked in code against the verified offers; do not flag its wording. Only flag it if it contradicts a perk claim in the profile. passed is true only when there are no issues.`;

export function factcheckUserPrompt(profile: HotelProfile, scriptJson: string): string {
  return `Profile:\n${JSON.stringify(
    { name: profile.name, facts: profile.facts, highlights: profile.highlights, considerations: profile.considerations, perks: profile.perks },
    null,
    2,
  )}\n\nScript:\n${scriptJson}`;
}
