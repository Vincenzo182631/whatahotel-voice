import { describe, expect, it, vi } from "vitest";
import { FirecrawlClient, FirecrawlError, parsePage, snapshotOfficialSite } from "../src/sources/firecrawl.js";

const OK = { success: true, data: { markdown: "# Hotel\nRooms", metadata: { title: "Hotel", statusCode: 200, sourceURL: "https://h.com/" } } };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe("FirecrawlClient", () => {
  it("requires a key", () => {
    expect(() => new FirecrawlClient({ apiKey: "" })).toThrow(/FIRECRAWL_API_KEY/);
  });

  it("sends the key as a Bearer header, never in the URL", async () => {
    const f = vi.fn(async () => json(OK));
    const page = await new FirecrawlClient({ apiKey: "fc-secret", fetchImpl: f as never }).scrape("https://h.com/");
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).not.toContain("fc-secret");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer fc-secret");
    expect(page).toMatchObject({ title: "Hotel", statusCode: 200, markdown: "# Hotel\nRooms" });
  });

  it("rejects non-https URLs", async () => {
    const c = new FirecrawlClient({ apiKey: "k", fetchImpl: vi.fn() as never });
    await expect(c.scrape("http://h.com")).rejects.toThrow(/https/);
  });

  it("does not retry a bad key", async () => {
    const f = vi.fn(async () => json({ success: false, error: "Unauthorized" }, 401));
    const c = new FirecrawlClient({ apiKey: "k", fetchImpl: f as never, maxRetries: 2 });
    await expect(c.scrape("https://h.com/")).rejects.toBeInstanceOf(FirecrawlError);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("retries a rate limit, then succeeds", async () => {
    const f = vi.fn().mockResolvedValueOnce(json({ success: false, error: "slow down" }, 429)).mockResolvedValueOnce(json(OK));
    const page = await new FirecrawlClient({ apiKey: "k", fetchImpl: f as never }).scrape("https://h.com/");
    expect(f).toHaveBeenCalledTimes(2);
    expect(page.title).toBe("Hotel");
  });
});

describe("parsePage", () => {
  it("fails on empty content instead of storing nothing", () => {
    expect(() => parsePage("https://h.com/", { success: true, data: { markdown: "  " } })).toThrow(/no content/);
  });
});

describe("snapshotOfficialSite", () => {
  it("records failures and blocked pages as errors, keeps good pages", async () => {
    const scrape = vi
      .fn()
      .mockResolvedValueOnce({ url: "a", title: null, statusCode: 200, markdown: "ok", fetchedAt: "t" })
      .mockResolvedValueOnce({ url: "b", title: null, statusCode: 403, markdown: "Access denied", fetchedAt: "t" })
      .mockRejectedValueOnce(new Error("boom"));
    const s = await snapshotOfficialSite({ scrape }, "slug", "https://h.com/", ["a", "b", "c"]);
    expect(s.pages.map((p) => p.url)).toEqual(["a"]);
    expect(s.errors).toEqual([
      { url: "b", error: expect.stringContaining("403") },
      { url: "c", error: "boom" },
    ]);
  });
});
