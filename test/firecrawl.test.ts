import { describe, expect, it, vi } from "vitest";
import { FirecrawlClient, FirecrawlError } from "../src/sources/firecrawl.js";

const reply = (status: number, body: unknown) => vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify(body), { status }));

describe("FirecrawlClient", () => {
  it("scrapes with a bearer key and returns the requested formats", async () => {
    const fetchFn = reply(200, { success: true, data: { markdown: "# Hi", metadata: { title: "T" } } });
    const page = await new FirecrawlClient("fc-test", fetchFn as unknown as typeof fetch).scrape("https://x.test");
    expect(page).toEqual({ url: "https://x.test", markdown: "# Hi", rawHtml: undefined, title: "T" });
    const init = fetchFn.mock.calls[0]![1]!;
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer fc-test");
    expect(JSON.parse(init.body as string)).toEqual({ url: "https://x.test", formats: ["markdown"] });
  });

  it("throws on API errors", async () => {
    const client = new FirecrawlClient("bad", reply(401, { success: false, error: "Unauthorized" }) as unknown as typeof fetch);
    await expect(client.scrape("https://x.test")).rejects.toThrow(FirecrawlError);
  });

  it("requires the env key", () => {
    expect(() => FirecrawlClient.fromEnv({})).toThrow(/FIRECRAWL_API_KEY/);
  });
});
