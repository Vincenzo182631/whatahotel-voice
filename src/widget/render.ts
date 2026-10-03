/**
 * Pure HTML rendering for the "Hear Hotel Highlights" player. Kept free of DOM
 * APIs so it is unit-testable.
 */

export const TITLE = "Hear Hotel Highlights";

const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => ESC[c]!);

/** Markup for one player. `audioUrl` must be http(s) or a relative path; it is escaped. */
export function renderTake(audioUrl: string): string {
  return [
    `<section class="wah-take" aria-label="${TITLE}">`,
    `<h3 class="wah-take__title">${TITLE}</h3>`,
    `<audio class="wah-take__audio" controls preload="none" src="${esc(audioUrl)}"></audio>`,
    `</section>`,
  ].join("");
}

export const TAKE_CSS = `
.wah-take{--wah-ink:#1b1b1f;--wah-line:#e4e1da;--wah-bg:#fbfaf7;
font:16px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;color:var(--wah-ink);background:var(--wah-bg);
border:1px solid var(--wah-line);border-radius:12px;padding:16px;max-width:640px;box-sizing:border-box}
.wah-take *{box-sizing:border-box}
.wah-take__title{margin:0 0 12px;font-size:1.05rem;font-weight:600}
.wah-take__audio{width:100%;display:block}
`;
