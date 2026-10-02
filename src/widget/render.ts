/**
 * Pure HTML rendering for "The WhataHotel Take" player. Kept free of DOM APIs so
 * it is unit-testable and can also run at build time for server-rendered SEO.
 */

export interface TakeTranscript {
  hotel: { slug: string; name: string; whatahotel_url?: string };
  title: string;
  speakers: Record<string, string>;
  turns: Array<{ speaker: string; name: string; text: string }>;
  short_version?: { best_for?: string; atmosphere?: string; worth_knowing?: string };
}

const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => ESC[c]!);

const CARD_ROWS: Array<[keyof NonNullable<TakeTranscript["short_version"]>, string]> = [
  ["best_for", "Best for"],
  ["atmosphere", "Atmosphere"],
  ["worth_knowing", "Worth knowing"],
];

/** Markup for one player. All text is escaped; `audioUrl` must be http(s) or a relative path. */
export function renderTake(t: TakeTranscript, audioUrl: string): string {
  const card = CARD_ROWS.filter(([k]) => t.short_version?.[k])
    .map(([k, label]) => `<div class="wah-take__row"><dt>${label}</dt><dd>${esc(t.short_version![k]!)}</dd></div>`)
    .join("");
  const turns = t.turns
    .map(
      (turn) =>
        `<p class="wah-take__turn wah-take__turn--${esc(turn.speaker)}"><strong>${esc(turn.name)}:</strong> ${esc(turn.text)}</p>`,
    )
    .join("");
  return [
    `<section class="wah-take" aria-label="${esc(t.title)}">`,
    `<h3 class="wah-take__title">${esc(t.title)}</h3>`,
    `<audio class="wah-take__audio" controls preload="none" src="${esc(audioUrl)}"></audio>`,
    card ? `<dl class="wah-take__card" aria-label="Short version">${card}</dl>` : "",
    `<details class="wah-take__transcript"><summary>Read the transcript</summary>${turns}</details>`,
    `</section>`,
  ].join("");
}

export const TAKE_CSS = `
.wah-take{--wah-ink:#1b1b1f;--wah-muted:#5c5c66;--wah-line:#e4e1da;--wah-bg:#fbfaf7;--wah-accent:#8a6d2f;
font:16px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;color:var(--wah-ink);background:var(--wah-bg);
border:1px solid var(--wah-line);border-radius:12px;padding:16px;max-width:640px;box-sizing:border-box}
.wah-take *{box-sizing:border-box}
.wah-take__title{margin:0 0 12px;font-size:1.05rem;font-weight:600}
.wah-take__audio{width:100%;display:block}
.wah-take__card{margin:14px 0 0;display:grid;gap:8px}
.wah-take__row{display:grid;grid-template-columns:7.5rem 1fr;gap:8px;border-top:1px solid var(--wah-line);padding-top:8px}
.wah-take__row dt{color:var(--wah-accent);font-weight:600;font-size:.85rem;text-transform:uppercase;letter-spacing:.04em}
.wah-take__row dd{margin:0}
.wah-take__transcript{margin-top:14px;border-top:1px solid var(--wah-line);padding-top:10px}
.wah-take__transcript summary{cursor:pointer;color:var(--wah-muted);font-size:.9rem}
.wah-take__turn{margin:.6em 0 0}
.wah-take__turn--traveler strong{color:var(--wah-accent)}
@media (max-width:480px){.wah-take__row{grid-template-columns:1fr;gap:2px}}
`;
