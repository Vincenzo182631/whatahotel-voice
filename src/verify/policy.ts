import type { ClaimResult } from "./judge.js";

export interface Decision {
  /** True when the profile may be marked verified without a person. */
  eligible: boolean;
  blockers: string[];
  counts: Record<"supported" | "contradicted" | "unverified" | "exempt" | "total", number>;
}

/**
 * A profile is verifiable when no claim is contradicted by a source and every claim a script
 * actually relies on is supported by an official or Condé Nast Traveler page (or is WhataHotel's
 * own statement). Unverified claims that no script uses do not block, but are listed in the report.
 * With no script yet, every claim counts as used.
 */
export function decide(results: ClaimResult[], usedClaimIds: ReadonlySet<string>): Decision {
  const used = usedClaimIds.size ? usedClaimIds : new Set(results.map((r) => r.claim_id));
  const counts = { supported: 0, contradicted: 0, unverified: 0, exempt: 0, total: results.length };
  for (const r of results) counts[r.status]++;
  const blockers: string[] = [];
  const contradicted = results.filter((r) => r.status === "contradicted").map((r) => r.claim_id);
  if (contradicted.length) blockers.push(`contradicted by a source: ${contradicted.join(", ")}`);
  const unverifiedUsed = results.filter((r) => r.status === "unverified" && used.has(r.claim_id)).map((r) => r.claim_id);
  if (unverifiedUsed.length) blockers.push(`used in the script but not verified: ${unverifiedUsed.join(", ")}`);
  return { eligible: blockers.length === 0, blockers, counts };
}
