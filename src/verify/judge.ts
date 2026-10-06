import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { Claim, HotelProfile } from "../core/schema.js";
import { createClient, parseWith } from "../script/claude.js";
import type { Evidence, EvidenceTier } from "./evidence.js";

export type ClaimStatus = "supported" | "contradicted" | "unverified" | "exempt";

export interface Finding {
  verdict: "supported" | "partial" | "contradicted";
  doc_id: string;
  url: string;
  tier: EvidenceTier;
  quote: string;
  note: string;
  /** True only when the quote appears word for word in the page text we fetched. */
  quote_verified: boolean;
}

export interface ClaimResult {
  claim_id: string;
  text: string;
  status: ClaimStatus;
  findings: Finding[];
  reason?: string;
}

const JudgeSchema = z.object({
  results: z.array(
    z.object({
      claim_id: z.string(),
      findings: z.array(
        z.object({
          verdict: z.enum(["supported", "partial", "contradicted"]),
          doc_id: z.string(),
          quote: z.string(),
          note: z.string(),
        }),
      ),
    }),
  ),
});

export const JUDGE_SYSTEM_PROMPT = `You verify claims about one hotel against evidence pages. Each claim must be checked ONLY against the documents provided; never use your own knowledge.

For every claim return findings:
- "supported": the quotes together establish EVERY element of the claim. Every number, name, date, unit and list item must be covered. Do not stretch: a claim stronger than the page (more rooms, a superlative, a ranking, "only", "largest") is NOT supported unless the page says so. If several documents together cover all elements, report each quote as "supported".
- "partial": the page establishes only some elements of a compound claim (for example one restaurant of four named, or the opening year but not the month). If any element is not covered by any document, every finding for that claim must be "partial", never "supported".
- "contradicted": a document states something incompatible with the claim (different number, name, floor, location, date, or says the opposite).
- If no document addresses the claim, return no findings.

Each finding needs the document id and a quote copied VERBATIM (exact characters, at most 240 characters) from that document. If you cannot quote it exactly, do not report it. A claim may have both supporting and contradicting findings. Claims that report what the hotel or a guide "says" or "describes" are checked against what the page says. Return one entry per claim id, in the order given.`;

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[‘’‛′`´]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[‐-―−]/g, "-")
    .replace(/ /g, " ")
    .replace(/[*_#>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Does the quote appear in the page text? Ellipses split a quote into parts that must each appear. */
export function quoteInText(quote: string, text: string): boolean {
  const hay = norm(text);
  const parts = quote
    .split(/\.\.\.|…/)
    .map(norm)
    .filter((p) => p.length > 0);
  return parts.length > 0 && parts.every((p) => p.length >= 12 && hay.includes(p));
}

/** Perks are WhataHotel's own offer; "WhataHotel notes/lists/pro tip" claims report WhataHotel's own view. */
export function isExempt(claim: Claim, profile: HotelProfile): boolean {
  return profile.perks.some((p) => p.id === claim.id) || /^whatahotel('s)?\b/i.test(claim.text.trim());
}

/** Turns raw findings into a status. A finding only counts if its quote was found in the page. */
export function resolveClaim(findings: Finding[]): { status: ClaimStatus; reason?: string } {
  const real = findings.filter((f) => f.quote_verified);
  if (real.some((f) => f.verdict === "contradicted")) return { status: "contradicted", reason: "a source says something different" };
  const strong = real.filter((f) => f.verdict === "supported" && f.tier !== "press");
  if (strong.length) return { status: "supported" };
  if (real.some((f) => f.verdict === "supported")) return { status: "unverified", reason: "only supported by a press or Wikipedia page" };
  if (real.some((f) => f.verdict === "partial")) return { status: "unverified", reason: "sources cover only part of the claim" };
  if (findings.length) return { status: "unverified", reason: "quoted evidence could not be found in the page text" };
  return { status: "unverified", reason: "no source states it" };
}

function documentsBlock(evidence: Evidence[]): string {
  return evidence.map((e) => `<document id="${e.id}" url="${e.url}" tier="${e.tier}">\n${e.text}\n</document>`).join("\n\n");
}

/** Checks claims against the evidence in batches; every returned quote is verified in code. */
export async function judgeClaims(
  claims: Claim[],
  evidence: Evidence[],
  { client = createClient(), batchSize = 25 }: { client?: Anthropic; batchSize?: number } = {},
): Promise<ClaimResult[]> {
  const byId = new Map(evidence.map((e) => [e.id, e]));
  const out: ClaimResult[] = [];
  for (let i = 0; i < claims.length; i += batchSize) {
    const batch = claims.slice(i, i + batchSize);
    const user =
      `<documents>\n${documentsBlock(evidence)}\n</documents>\n\nClaims to check:\n` +
      batch.map((c) => JSON.stringify({ claim_id: c.id, claim: c.text })).join("\n");
    const parsed = await parseWith(client, JudgeSchema, JUDGE_SYSTEM_PROMPT, user, "high");
    const returned = new Map(parsed.results.map((r) => [r.claim_id, r.findings]));
    for (const c of batch) {
      const findings: Finding[] = (returned.get(c.id) ?? []).flatMap((f) => {
        const doc = byId.get(f.doc_id);
        if (!doc) return [];
        return [{ ...f, url: doc.url, tier: doc.tier, quote: f.quote.trim(), quote_verified: quoteInText(f.quote, doc.text) }];
      });
      out.push({ claim_id: c.id, text: c.text, findings, ...resolveClaim(findings) });
    }
  }
  return out;
}
