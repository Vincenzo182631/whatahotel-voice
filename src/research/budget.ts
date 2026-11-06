/** Per-hotel limits and usage tracking for a research run. */
export interface Limits {
  /** Pages kept for one hotel (the home page counts). */
  maxPages: number;
  /** Firecrawl calls (searches and scrapes) for one hotel. */
  maxFirecrawlCalls: number;
  /** Attempts for one rate-limited Firecrawl call. */
  maxRetries: number;
  /** Characters of page text handed to the Claude subagent: a stand-in for its token use (about 4 characters a token). */
  maxChars: number;
}

export interface Usage {
  firecrawl_calls: number;
  firecrawl_searches: number;
  cache_hits: number;
  direct_fetches: number;
  pages: number;
  chars: number;
  est_claude_tokens: number;
}

export class BudgetExceeded extends Error {
  constructor(readonly what: string) {
    super(`limit reached: ${what}`);
  }
}

const num = (v: string | undefined, d: number) => (v !== undefined && Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : d);

export function limitsFromEnv(env: NodeJS.ProcessEnv = process.env, over: Partial<Limits> = {}): Limits {
  return {
    maxPages: over.maxPages ?? num(env.WH_RESEARCH_MAX_PAGES, 12),
    maxFirecrawlCalls: over.maxFirecrawlCalls ?? num(env.WH_RESEARCH_MAX_FC_CALLS, 20),
    maxRetries: over.maxRetries ?? num(env.WH_RESEARCH_MAX_RETRIES, 3),
    maxChars: over.maxChars ?? num(env.WH_RESEARCH_MAX_CHARS, 150_000),
  };
}

export class Budget {
  readonly usage: Usage = { firecrawl_calls: 0, firecrawl_searches: 0, cache_hits: 0, direct_fetches: 0, pages: 0, chars: 0, est_claude_tokens: 0 };
  constructor(readonly limits: Limits) {}

  /** Count one Firecrawl call, refusing it when the limit is already used up. */
  firecrawl(kind: "scrape" | "search" = "scrape") {
    if (this.usage.firecrawl_calls >= this.limits.maxFirecrawlCalls) throw new BudgetExceeded(`${this.limits.maxFirecrawlCalls} Firecrawl calls`);
    this.usage.firecrawl_calls++;
    if (kind === "search") this.usage.firecrawl_searches++;
  }
  cacheHit() { this.usage.cache_hits++; }
  direct() { this.usage.direct_fetches++; }

  /** Reserve room for one more page of the given size; throws when a page or text limit would be passed. */
  addPage(chars: number) {
    if (this.usage.pages >= this.limits.maxPages) throw new BudgetExceeded(`${this.limits.maxPages} pages`);
    if (this.usage.chars + chars > this.limits.maxChars) throw new BudgetExceeded(`${this.limits.maxChars} characters of page text`);
    this.usage.pages++;
    this.usage.chars += chars;
    this.usage.est_claude_tokens = Math.round(this.usage.chars / 4);
  }
}
