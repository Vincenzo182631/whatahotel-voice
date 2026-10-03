import { describe, expect, it } from "vitest";
import { esc, renderTake, TITLE } from "../src/widget/render.js";

describe("renderTake", () => {
  it("renders only the title and the audio player", () => {
    const html = renderTake("a/audio.mp3");
    expect(TITLE).toBe("Hear Hotel Highlights");
    expect(html).toContain(">Hear Hotel Highlights</h3>");
    expect(html).toContain('src="a/audio.mp3"');
    expect(html).not.toMatch(/transcript|Best for|Atmosphere|Worth knowing|<details/i);
  });

  it("escapes the audio url", () => {
    const html = renderTake('x"><script>');
    expect(html).not.toContain("<script>");
  });

  it("esc handles quotes", () => expect(esc(`"'`)).toBe("&quot;&#39;"));
});
