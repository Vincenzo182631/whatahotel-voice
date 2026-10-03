import { describe, expect, it } from "vitest";
import { esc, formatTime, renderTake, SUBTITLE, TITLE } from "../src/widget/render.js";

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
