import { describe, expect, it } from "vitest";
import { esc, renderTake, type TakeTranscript } from "../src/widget/render.js";

const t: TakeTranscript = {
  hotel: { slug: "x", name: "X" },
  title: 'The WhataHotel Take: A "Test" <Hotel>',
  speakers: { advisor: "Luxury Advisor", traveler: "Candid Traveler" },
  turns: [
    { speaker: "advisor", name: "Luxury Advisor", text: "Cliffside & quiet." },
    { speaker: "traveler", name: "Candid Traveler", text: "Seasonal <b>only</b>." },
  ],
  short_version: { best_for: "Couples", worth_knowing: "Closed in winter" },
};

describe("renderTake", () => {
  it("renders audio, card rows that exist, and the full transcript", () => {
    const html = renderTake(t, "a/audio.mp3");
    expect(html).toContain('src="a/audio.mp3"');
    expect(html).toContain("Best for");
    expect(html).toContain("Worth knowing");
    expect(html).not.toContain("Atmosphere");
    expect(html).toContain("Cliffside &amp; quiet.");
    expect(html.match(/wah-take__turn /g)).toHaveLength(2);
  });

  it("escapes all text, including the title and audio url", () => {
    const html = renderTake(t, 'x"><script>');
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<b>only</b>");
    expect(html).toContain("&lt;Hotel&gt;");
  });

  it("omits the card when there is no short version", () => {
    expect(renderTake({ ...t, short_version: undefined }, "a.mp3")).not.toContain("wah-take__card");
  });

  it("esc handles quotes", () => expect(esc(`"'`)).toBe("&quot;&#39;"));
});
