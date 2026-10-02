/**
 * Minimal Firecrawl client (https://docs.firecrawl.dev/api-reference/endpoint/scrape).
 * Used for pages a plain fetch can't get (bot protection, JS rendering) and for
 * pulling official hotel sites into markdown for research.
 */

const BASE_URL = "https://api.firecrawl.dev/v1";

export interface FirecrawlPage {
  url: string;
  markdown?: string;
  rawHtml?: string;
  title?: string;
}

export class FirecrawlError extends Error {}

export class FirecrawlClient {
  constructor(
    private readonly apiKey: string,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  static fromEnv(env = process.env): FirecrawlClient {
    const key = env.FIRECRAWL_API_KEY;
    if (!key) throw new FirecrawlError("FIRECRAWL_API_KEY is not set");
    return new FirecrawlClient(key);
  }

  async scrape(url: string, formats: Array<"markdown" | "rawHtml"> = ["markdown"]): Promise<FirecrawlPage> {
    const res = await this.fetchFn(`${BASE_URL}/scrape`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url, formats }),
    });
    const body = (await res.json().catch(() => ({}))) as {
      success?: boolean;
      error?: string;
      data?: { markdown?: string; rawHtml?: string; metadata?: { title?: string } };
    };
    if (!res.ok || !body.success || !body.data) {
      throw new FirecrawlError(`Firecrawl ${res.status} for ${url}: ${body.error ?? "no data returned"}`);
    }
    return { url, markdown: body.data.markdown, rawHtml: body.data.rawHtml, title: body.data.metadata?.title };
  }
}
