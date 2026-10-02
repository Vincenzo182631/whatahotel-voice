/**
 * Read-only Firecrawl client for fetching a hotel's OFFICIAL website as markdown.
 *
 * Official sites (peninsula.com, fourseasons.com) answer 403 to plain fetches; Firecrawl renders
 * them. Output is a dated snapshot for a person to read and cite. It is never turned into claims
 * automatically, same rule as `info` in wah-api.ts.
 *
 * The key goes in an Authorization header, never in the URL, so URLs are safe to log.
 */

const BASE_URL = "https://api.firecrawl.dev/v1/scrape";

export class FirecrawlError extends Error {
  constructor(
    message: string,
    readonly httpStatus?: number,
  ) {
    super(message);
  }
  /** Rate limit or upstream failure; a bad key (401) or payment (402) is not worth retrying. */
  get retryable(): boolean {
    return this.httpStatus === 429 || (this.httpStatus !== undefined && this.httpStatus >= 500);
  }
}

export interface FirecrawlOptions {
  apiKey: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  maxRetries?: number;
}

export interface OfficialPage {
  url: string;
  title: string | null;
  /** HTTP status the hotel's site gave Firecrawl; a 403 here means the page was NOT read. */
  statusCode: number | null;
  markdown: string;
  fetchedAt: string;
}

export interface OfficialSnapshot {
  slug: string;
  site: string;
  pages: OfficialPage[];
  /** Pages that failed, with the reason, so a gap is visible rather than silent. */
  errors: Array<{ url: string; error: string }>;
}

export class FirecrawlClient {
  private readonly fetchImpl: typeof fetch;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;

  constructor(private readonly opts: FirecrawlOptions) {
    if (!opts.apiKey) throw new Error("FIRECRAWL_API_KEY is not set. See .env.example.");
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.baseUrl = opts.baseUrl ?? BASE_URL;
    this.timeoutMs = opts.timeoutMs ?? 60_000;
    this.maxRetries = opts.maxRetries ?? 2;
  }

  static fromEnv(): FirecrawlClient {
    return new FirecrawlClient({ apiKey: process.env.FIRECRAWL_API_KEY ?? "" });
  }

  async scrape(url: string): Promise<OfficialPage> {
    if (!/^https:\/\//i.test(url)) throw new Error(`Official site URL must be https: ${url}`);
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, 500 * 2 ** (attempt - 1)));
      try {
        const res = await this.fetchImpl(this.baseUrl, {
          method: "POST",
          signal: AbortSignal.timeout(this.timeoutMs),
          headers: { "content-type": "application/json", authorization: `Bearer ${this.opts.apiKey}` },
          body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }),
        });
        const body = (await res.json().catch(() => ({}))) as FirecrawlResponse;
        if (!res.ok || !body.success) {
          throw new FirecrawlError(`Firecrawl ${res.status}: ${body.error ?? "request failed"} (${url})`, res.status);
        }
        return parsePage(url, body);
      } catch (err) {
        lastError = err;
        if (err instanceof FirecrawlError && !err.retryable) throw err;
      }
    }
    throw lastError;
  }
}

interface FirecrawlResponse {
  success?: boolean;
  error?: string;
  data?: { markdown?: string; metadata?: { title?: string; statusCode?: number; sourceURL?: string } };
}

export function parsePage(url: string, body: FirecrawlResponse, now = new Date()): OfficialPage {
  const markdown = body.data?.markdown?.trim() ?? "";
  if (!markdown) throw new FirecrawlError(`Firecrawl returned no content for ${url}`);
  const meta = body.data?.metadata ?? {};
  return {
    url: meta.sourceURL ?? url,
    title: meta.title ?? null,
    statusCode: meta.statusCode ?? null,
    markdown,
    fetchedAt: now.toISOString(),
  };
}

/** Scrapes each page in turn. One failing page is recorded, not fatal. */
export async function snapshotOfficialSite(
  client: Pick<FirecrawlClient, "scrape">,
  slug: string,
  site: string,
  pages: string[],
): Promise<OfficialSnapshot> {
  const snapshot: OfficialSnapshot = { slug, site, pages: [], errors: [] };
  for (const url of pages) {
    try {
      const page = await client.scrape(url);
      if (page.statusCode !== null && page.statusCode >= 400) {
        snapshot.errors.push({ url, error: `site answered HTTP ${page.statusCode}; content not trusted` });
      } else {
        snapshot.pages.push(page);
      }
    } catch (err) {
      snapshot.errors.push({ url, error: (err as Error).message });
    }
  }
  return snapshot;
}
