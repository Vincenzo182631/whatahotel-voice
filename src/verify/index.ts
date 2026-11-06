import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type Anthropic from "@anthropic-ai/sdk";
import { HOTELS_DIR, allClaims, loadProfile } from "../core/profile.js";
import { isoDay } from "../core/freshness.js";
import type { Claim, HotelProfile } from "../core/schema.js";
import { createClient } from "../script/claude.js";
import type { FirecrawlClient } from "../sources/firecrawl.js";
import { listVersions, readMetadata, readScript } from "../storage/local.js";
import { gatherEvidence, type Evidence, type Gathered } from "./evidence.js";
import { isExempt, judgeClaims, type ClaimResult } from "./judge.js";
import { decide } from "./policy.js";
import { writeReport, type VerificationReport } from "./report.js";

export interface VerifyOptions {
  fc: FirecrawlClient;
  client?: Anthropic;
  /** Mark the profile verified when the policy allows it. */
  apply?: boolean;
  refresh?: boolean;
  today?: Date;
}

/** Claims the hotel's current clip relies on: the newest approved or published version, else the newest. */
export async function usedClaims(slug: string): Promise<{ version: number | null; ids: Set<string> }> {
  const versions = (await listVersions(slug)).reverse();
  let pick: number | undefined;
  for (const v of versions) {
    const m = await readMetadata(slug, v).catch(() => undefined);
    if (m && (m.status === "approved" || m.status === "published")) {
      pick = v;
      break;
    }
  }
  pick ??= versions[0];
  if (pick === undefined) return { version: null, ids: new Set() };
  const script = await readScript(slug, pick).catch(() => undefined);
  return { version: pick, ids: new Set(script?.turns.flatMap((t) => t.claim_ids) ?? []) };
}

async function markVerified(slug: string, today: Date): Promise<void> {
  const file = path.join(HOTELS_DIR, `${slug}.json`);
  const raw = JSON.parse(await readFile(file, "utf8")) as HotelProfile;
  raw.status = "verified";
  raw.last_verified = isoDay(today);
  await writeFile(file, JSON.stringify(raw, null, 2) + "\n");
}

/** Claims checked against hotel pages, and the ones that are WhataHotel's own statements and are not. */
export function splitClaims(profile: HotelProfile): { exempt: Claim[]; toJudge: Claim[] } {
  const claims = allClaims(profile);
  const exempt = claims.filter((c) => isExempt(c, profile));
  return { exempt, toJudge: claims.filter((c) => !exempt.includes(c)) };
}

/** Merges judged claims with the exempt ones, applies the policy, optionally marks the profile verified, writes the report. */
export async function finishVerification(
  profile: HotelProfile,
  evidence: Evidence[],
  skipped: Gathered["skipped"],
  judged: ClaimResult[],
  { apply = false, today = new Date() }: { apply?: boolean; today?: Date } = {},
): Promise<VerificationReport> {
  const results: ClaimResult[] = allClaims(profile).map(
    (c) => judged.find((j) => j.claim_id === c.id) ?? { claim_id: c.id, text: c.text, status: "exempt", findings: [] },
  );
  const used = await usedClaims(profile.slug);
  const decision = decide(results, used.ids);
  const applied = apply && decision.eligible;
  if (applied) await markVerified(profile.slug, today);
  const report: VerificationReport = {
    hotel_slug: profile.slug,
    hotel_name: profile.name,
    checked_at: today.toISOString(),
    script_version: used.version,
    decision,
    applied,
    evidence: evidence.map((e) => ({ id: e.id, url: e.url, tier: e.tier, chars: e.text.length })),
    skipped,
    claims: results,
  };
  await writeReport(report);
  return report;
}

export async function verifyHotel(slug: string, opts: VerifyOptions): Promise<VerificationReport> {
  const profile = await loadProfile(slug);
  const { evidence, skipped } = await gatherEvidence(profile, opts.fc, { refresh: opts.refresh });
  if (!evidence.length) throw new Error(`No evidence pages could be loaded for ${slug}`);
  const judged = await judgeClaims(splitClaims(profile).toJudge, evidence, { client: opts.client ?? createClient() });
  return finishVerification(profile, evidence, skipped, judged, { apply: opts.apply, today: opts.today });
}
