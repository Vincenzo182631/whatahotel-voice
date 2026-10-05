/**
 * Freshness: which claims, and which clips built on them, are going out of date.
 * A claim can carry `expires` (YYYY-MM-DD, the last day it may be used). A profile
 * not re-verified for a while is flagged too.
 */
import { allClaims } from "./profile.js";
import type { Claim, HotelProfile, Script } from "./schema.js";

export const WARN_DAYS = 45;
export const STALE_PROFILE_DAYS = 90;

const DAY_MS = 86_400_000;

export const isoDay = (d: Date): string => d.toISOString().slice(0, 10);

/** Whole days from `from` to `to` (both YYYY-MM-DD). Negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

/** True once the day after `expires` has started: the expiry day itself is still valid. */
export function isExpired(claim: Pick<Claim, "expires">, today: Date = new Date()): boolean {
  return claim.expires !== undefined && claim.expires < isoDay(today);
}

export interface ClaimFlag {
  id: string;
  text: string;
  expires: string;
  /** Days until expiry; negative = already expired. */
  days_left: number;
  /** Whether the latest clip's script cites this claim (always true when no script is given). */
  in_clip: boolean;
}

export interface Freshness {
  slug: string;
  profile_age_days: number;
  profile_stale: boolean;
  expired: ClaimFlag[];
  expiring: ClaimFlag[];
}

export function checkFreshness(
  profile: HotelProfile,
  opts: { today?: Date; warnDays?: number; script?: Script } = {},
): Freshness {
  const today = isoDay(opts.today ?? new Date());
  const warn = opts.warnDays ?? WARN_DAYS;
  const cited = opts.script ? new Set(opts.script.turns.flatMap((t) => t.claim_ids)) : undefined;
  const flags: ClaimFlag[] = [];
  for (const c of allClaims(profile)) {
    if (!c.expires) continue;
    const days_left = daysBetween(today, c.expires);
    if (days_left > warn) continue;
    flags.push({ id: c.id, text: c.text, expires: c.expires, days_left, in_clip: cited ? cited.has(c.id) : true });
  }
  flags.sort((a, b) => a.days_left - b.days_left);
  const age = daysBetween(profile.last_verified, today);
  return {
    slug: profile.slug,
    profile_age_days: age,
    profile_stale: age > STALE_PROFILE_DAYS,
    expired: flags.filter((f) => f.days_left < 0),
    expiring: flags.filter((f) => f.days_left >= 0),
  };
}

/** A hotel needs attention when anything it relies on has expired or its profile is stale. */
export function needsRefresh(f: Freshness): boolean {
  return f.expired.some((c) => c.in_clip) || f.profile_stale;
}
