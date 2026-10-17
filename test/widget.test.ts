import { describe, expect, it } from "vitest";
import { cleanUrl, esc, formatTime, renderTake, SUBTITLE, TITLE } from "../src/widget/render.js";

describe("renderTake", () => {
  it("renders the pill and a hidden player bar with the AI subtitle", () => {
    const html = renderTake({ audioUrl: "a/audio.mp3", hotelName: "Il San Pietro di Positano" });
    expect(html).toContain(TITLE);
    expect(html).toContain(SUBTITLE);
    expect(html).toContain('data-act="open"');
    expect(html).toContain('class="wah-take__bar" role="region"');
    expect(html).toMatch(/class="wah-take__bar"[^>]*hidden/);
    expect(html).toContain("Il San Pietro di Positano");
    expect(html).toContain('src="a/audio.mp3"');
    expect(html).not.toMatch(/transcript|Best for|Atmosphere|<details/i);
  });

  it("uses an image thumbnail only when given, and escapes every input", () => {
    expect(renderTake({ audioUrl: "a.mp3" })).toContain("wah-take__thumb--icon");
    const html = renderTake({ audioUrl: 'x"><script>', hotelName: "<b>H</b>", imageUrl: 'i"><img>' });
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<b>H</b>");
    expect(html).not.toContain('"><img>');
  });
});

describe("formatTime", () => {
  it("formats seconds as m:ss and hides bad values", () => {
    expect(formatTime(87.3)).toBe("1:27");
    expect(formatTime(59.6)).toBe("1:00");
    expect(formatTime(0)).toBe("");
    expect(formatTime(NaN)).toBe("");
  });
  it("esc handles quotes", () => expect(esc(`"'`)).toBe("&quot;&#39;"));
});

describe("cleanUrl", () => {
  const good = "https://x.test/takes/four-seasons-maui/v1/transcript.json";
  it("strips backticks, quotes and whitespace pasted from formatted text", () => {
    expect(cleanUrl("https://x.test/takes/`four-seasons-maui`/v1/transcript.json")).toBe(good);
    expect(cleanUrl("https://x.test/takes/%60four-seasons-maui%60/v1/transcript.json")).toBe(good);
    expect(cleanUrl(`  \u201c${good}\u201d \n`)).toBe(good);
    expect(cleanUrl(`'${good}'`)).toBe(good);
  });
  it("leaves a clean URL alone and returns undefined for nothing", () => {
    expect(cleanUrl(good)).toBe(good);
    expect(cleanUrl("data:audio/mpeg;base64,AAAA")).toBe("data:audio/mpeg;base64,AAAA");
    expect(cleanUrl(undefined)).toBeUndefined();
    expect(cleanUrl("  `` ")).toBeUndefined();
  });
});

import { audioObjectJsonLd, isoDuration, renderTranscript, transcriptText } from "../src/widget/render.js";

describe("transcript and AudioObject", () => {
  const t = {
    hotel: { name: "Hotel <X>", whatahotel_url: "https://www.whatahotel.com/hotels/1/x.html" },
    title: "Hotel X: Highlights",
    turns: [
      { speaker: "advisor", name: "Luxury Advisor", text: "Hello & welcome." },
      { speaker: "traveler", name: "Candid Traveler", text: "Fair enough." },
    ],
  };
  it("formats ISO 8601 durations and hides bad values", () => {
    expect(isoDuration(87.3)).toBe("PT1M27S");
    expect(isoDuration(45)).toBe("PT45S");
    expect(isoDuration(0)).toBeUndefined();
  });
  it("builds an AudioObject with the full transcript text", () => {
    const ld = audioObjectJsonLd(t, "https://x.test/audio.mp3", 87) as Record<string, any>;
    expect(ld["@type"]).toBe("AudioObject");
    expect(ld.contentUrl).toBe("https://x.test/audio.mp3");
    expect(ld.encodingFormat).toBe("audio/mpeg");
    expect(ld.duration).toBe("PT1M27S");
    expect(ld.transcript).toBe(transcriptText(t));
    expect(ld.transcript).toContain("Luxury Advisor: Hello & welcome.");
    expect(ld.about.name).toBe("Hotel <X>");
    expect(audioObjectJsonLd(t, "a.mp3")).not.toHaveProperty("duration");
  });
  it("renders an escaped, collapsed transcript and nothing when there are no turns", () => {
    const html = renderTranscript(t);
    expect(html).toContain("<details");
    expect(html).not.toMatch(/<details[^>]* open/);
    expect(html).toContain("Hello &amp; welcome.");
    expect(renderTranscript({ turns: [] })).toBe("");
  });
});
