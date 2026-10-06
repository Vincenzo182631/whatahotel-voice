import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Gathered } from "./evidence.js";
import type { ClaimResult } from "./judge.js";
import type { Decision } from "./policy.js";

export const VERIFY_DIR = path.resolve(process.env.WH_VERIFY_DIR ?? "data/verification");

export interface VerificationReport {
  hotel_slug: string;
  hotel_name: string;
  checked_at: string;
  /** Script version whose claims were treated as "used", if any. */
  script_version: number | null;
  decision: Decision;
  applied: boolean;
  evidence: Array<{ id: string; url: string; tier: string; chars: number }>;
  skipped: Gathered["skipped"];
  claims: ClaimResult[];
}

const ICON = { supported: "✅", contradicted: "❌", unverified: "⚠️", exempt: "➖" } as const;
const cell = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, " ");

/** The human-readable checklist: one row per claim with the quote that backs it. */
export function renderChecklist(r: VerificationReport): string {
  const lines: string[] = [
    `# Verification checklist: ${r.hotel_name}`,
    "",
    `Checked ${r.checked_at.slice(0, 10)} against the hotel's own pages and Condé Nast Traveler. ` +
      `Result: **${r.decision.eligible ? "can be marked verified" : "needs attention"}**${r.applied ? " (profile set to verified)" : ""}.`,
    "",
    `Supported ${r.decision.counts.supported} · contradicted ${r.decision.counts.contradicted} · unverified ${r.decision.counts.unverified} · WhataHotel's own statements ${r.decision.counts.exempt} · total ${r.decision.counts.total}` +
      (r.script_version ? ` · script v${r.script_version}` : ""),
    "",
  ];
  if (r.decision.blockers.length) lines.push("## Blockers", "", ...r.decision.blockers.map((b) => `- ${b}`), "");
  lines.push("## Pages checked", "", ...r.evidence.map((e) => `- ${e.tier}: ${e.url}`));
  for (const s of r.skipped) lines.push(`- not available: ${s.url} (${s.reason})`);
  lines.push("", "## Claims", "", "| | Claim | Evidence |", "|---|---|---|");
  for (const c of r.claims) {
    const real = c.findings.filter((f) => f.quote_verified);
    const best = real.find((f) => f.verdict === (c.status === "contradicted" ? "contradicted" : "supported")) ?? real[0];
    const evidence = best
      ? `${best.verdict === "contradicted" ? "Source says: " : ""}"${best.quote}" (${best.tier}, ${best.url})`
      : c.status === "exempt"
        ? "WhataHotel's own offer or statement"
        : (c.reason ?? "");
    lines.push(`| ${ICON[c.status]} | **${c.claim_id}** ${cell(c.text)} | ${cell(evidence)} |`);
  }
  return lines.join("\n") + "\n";
}

export async function writeReport(r: VerificationReport): Promise<{ json: string; md: string }> {
  await mkdir(VERIFY_DIR, { recursive: true });
  const json = path.join(VERIFY_DIR, `${r.hotel_slug}.json`);
  const md = path.join(VERIFY_DIR, `${r.hotel_slug}.md`);
  await writeFile(json, JSON.stringify(r, null, 2) + "\n");
  await writeFile(md, renderChecklist(r));
  return { json, md };
}
