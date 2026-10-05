import { z } from "zod";

/** Where a claim came from. Every claim in a profile must point at one of these. */
export const SourceSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  type: z.enum(["whatahotel", "official", "press", "manual"]),
  title: z.string(),
  url: z.string().url().optional(),
  accessed: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

/** A single atomic statement tied to its sources. */
export const ClaimSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  text: z.string().min(3),
  source_ids: z.array(z.string()).min(1),
  /** Set on claims an importer added, so reviewers can tell them apart. Absent = curated. */
  origin: z.enum(["wah-api", "pi-db"]).optional(),
  /**
   * Last day (YYYY-MM-DD) this claim should be used in a clip. Set it on anything time-bound
   * (renovations, "new" openings, annual rankings, awards). Absent = does not expire.
   */
  expires: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const HotelCategory = z.enum(["urban", "beach", "safari", "boutique", "family", "mountain", "other"]);

export const ProfileStatus = z.enum(["draft", "verified"]);

/**
 * The hotel intelligence record. Facts and considerations are kept separate:
 * facts describe the property; considerations are sourced "things to know".
 * Editorial interpretation is left to the script writer, never stored as fact.
 */
export const HotelProfileSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  whatahotel_id: z.number().int().positive(),
  whatahotel_url: z.string().url(),
  name: z.string(),
  location: z.object({ city: z.string(), country: z.string() }),
  category: HotelCategory,
  positioning: z.string(),
  best_for: z.array(z.string()).min(1),
  facts: z.array(ClaimSchema).min(3),
  highlights: z.array(ClaimSchema).min(2),
  considerations: z.array(ClaimSchema).min(1),
  /** WhataHotel booking perks (same wording on every hotel page). Sourced from the WhataHotel page. */
  perks: z.array(ClaimSchema).default([]),
  pronunciations: z.array(z.object({ term: z.string(), say_as: z.string() })).default([]),
  sources: z.array(SourceSchema).min(1),
  status: ProfileStatus,
  last_verified: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export type Source = z.infer<typeof SourceSchema>;
export type Claim = z.infer<typeof ClaimSchema>;
export type HotelProfile = z.infer<typeof HotelProfileSchema>;

/** The two fixed WhataHotel hosts. */
export const Speaker = z.enum(["advisor", "traveler"]);
export type Speaker = z.infer<typeof Speaker>;

export const SPEAKERS: Record<Speaker, { name: string; role: string }> = {
  advisor: {
    name: "Luxury Advisor",
    role: "What stands out: setting, service, design, rooms, dining, experiences, and who it suits.",
  },
  traveler: {
    name: "Candid Traveler",
    role: "Things to consider: tradeoffs, atmosphere, logistics, value, and who may not enjoy it.",
  },
};

/** Script sections in the order the conversation must follow. */
export const Section = z.enum(["hook", "stands_out", "best_for", "to_know", "bottom_line"]);

export const ScriptTurnSchema = z.object({
  speaker: Speaker,
  section: Section,
  text: z.string().min(1),
  /** Claim ids this turn relies on. Empty only for pure banter or editorial opinion. */
  claim_ids: z.array(z.string()),
});

export const ScriptSchema = z.object({
  title: z.string(),
  turns: z.array(ScriptTurnSchema).min(6),
  short_version: z.object({
    best_for: z.string(),
    atmosphere: z.string(),
    worth_knowing: z.string(),
  }),
});

export type ScriptTurn = z.infer<typeof ScriptTurnSchema>;
export type Script = z.infer<typeof ScriptSchema>;

/** Review workflow. Nothing reaches the site before APPROVED. */
export const ReviewStatus = z.enum(["generated", "needs_review", "approved", "published", "rejected"]);
export type ReviewStatus = z.infer<typeof ReviewStatus>;

export const MetadataSchema = z.object({
  hotel_slug: z.string(),
  version: z.number().int().positive(),
  status: ReviewStatus,
  generated_at: z.string(),
  profile_last_verified: z.string(),
  script_model: z.string(),
  voice_provider: z.string(),
  voice_model: z.string(),
  /** Voice ids used per speaker. Absent on clips made before this was recorded. */
  voices: z.record(Speaker, z.string()).optional(),
  word_count: z.number().int(),
  duration_seconds: z.number().nullable(),
  fact_check: z.object({ passed: z.boolean(), issues: z.array(z.string()) }),
  /** Audio length against AUDIO_SECONDS. Absent on older versions and script-only runs. */
  length_check: z.object({ passed: z.boolean(), issue: z.string().optional() }).optional(),
  review_note: z.string().optional(),
});
export type Metadata = z.infer<typeof MetadataSchema>;
