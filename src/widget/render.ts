/**
 * Pure markup for the "Hear Hotel Highlights" player: a dark pill that opens a
 * bottom player bar. No DOM APIs here, so it is unit-testable; behaviour lives
 * in embed.ts.
 */

export const TITLE = "Hear Hotel Highlights";
export const SUBTITLE = "AI-generated highlights";

const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => ESC[c]!);

/**
 * Cleans a URL taken from an HTML attribute that was pasted from formatted text:
 * removes backticks (also as %60), straight and curly quotes, angle brackets and
 * all whitespace. None of these belong in a URL, so removing them is safe.
 */
export function cleanUrl(raw: string | undefined): string | undefined {
  const url = raw?.replace(/%60/gi, "").replace(/[`'"\u2018\u2019\u201c\u201d<>\s]/g, "");
  return url || undefined;
}

/** 87.3 -> "1:27". Returns "" for anything that is not a positive finite number. */
export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "";
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

const svg = (body: string) =>
  `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true" focusable="false">${body}</svg>`;

export const ICONS = {
  // speaker with a sparkle, as in the reference
  highlights: svg(
    '<path d="M3 9v6h4l5 4V5L7 9H3z"/><path d="M17.5 4l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9z"/><path d="M18 13l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6z"/>',
  ),
  pause: svg('<path d="M6 5h4v14H6zM14 5h4v14h-4z"/>'),
  play: svg('<path d="M8 5v14l11-7z"/>'),
  close: svg('<path d="M6.4 5 5 6.4 10.6 12 5 17.6 6.4 19l5.6-5.6 5.6 5.6 1.4-1.4-5.6-5.6L19 6.4 17.6 5 12 10.6z"/>'),
};

export interface TakeView {
  audioUrl: string;
  /** Shown in the bar; falls back to the feature title. */
  hotelName?: string;
  /** Optional thumbnail shown at the left of the bar. */
  imageUrl?: string;
}

/** `audioUrl` and `imageUrl` must be http(s) or relative; all values are escaped. */
export function renderTake(v: TakeView): string {
  const name = esc(v.hotelName || TITLE);
  const thumb = v.imageUrl
    ? `<img class="wah-take__thumb" src="${esc(v.imageUrl)}" alt="" />`
    : `<span class="wah-take__thumb wah-take__thumb--icon">${ICONS.highlights}</span>`;
  return [
    `<div class="wah-take" data-state="idle" data-playing="false">`,
    `<button type="button" class="wah-take__pill" data-act="open" aria-label="${TITLE}">${ICONS.highlights}<span class="wah-take__pill-text">${TITLE}</span><span class="wah-take__time" data-role="duration"></span></button>`,
    `<div class="wah-take__bar" role="region" aria-label="${TITLE}" hidden>`,
    thumb,
    `<span class="wah-take__meta"><span class="wah-take__name" data-role="name">${name}</span><span class="wah-take__sub">${SUBTITLE}</span></span>`,
    `<button type="button" class="wah-take__btn" data-act="toggle" aria-label="Pause"><span data-role="toggle-icon">${ICONS.pause}</span></button>`,
    `<button type="button" class="wah-take__btn" data-act="close" aria-label="Close">${ICONS.close}</button>`,
    `<span class="wah-take__progress" aria-hidden="true"><span data-role="progress"></span></span>`,
    `<audio preload="metadata" src="${esc(v.audioUrl)}"></audio>`,
    `</div>`,
    `</div>`,
  ].join("");
}

export const TAKE_CSS = `
.wah-take{font:500 15px/1.3 system-ui,-apple-system,"Segoe UI",sans-serif;color:#fff}
.wah-take *{box-sizing:border-box}
:where(.wah-take button){font:inherit;color:inherit;cursor:pointer;border:0;background:none;padding:0}
.wah-take button:focus-visible{outline:2px solid #fff;outline-offset:2px;box-shadow:0 0 0 4px #1b1b1f}
.wah-take__pill{display:inline-flex;align-items:center;gap:10px;background:#1b1b1f;border-radius:999px;padding:12px 20px}
.wah-take__pill:hover{background:#2c2c33}
.wah-take__time:empty{display:none}
.wah-take__time{font-variant-numeric:tabular-nums;opacity:.85}
.wah-take__bar{position:fixed;z-index:2147483000;left:50%;bottom:16px;transform:translateX(-50%);
width:min(640px,calc(100vw - 32px));display:flex;align-items:center;gap:12px;overflow:hidden;
background:#1b1b1f;border-radius:14px;padding:10px 12px;box-shadow:0 8px 28px rgba(0,0,0,.35)}
.wah-take__bar[hidden]{display:none}
.wah-take__thumb{flex:none;width:44px;height:44px;border-radius:8px;object-fit:cover;background:#fff}
.wah-take__thumb--icon{display:grid;place-items:center;color:#1b1b1f}
.wah-take__meta{flex:1;min-width:0;display:grid;gap:2px}
.wah-take__name{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:600}
.wah-take__sub{font-size:13px;opacity:.7;font-weight:400}
.wah-take__btn{flex:none;width:40px;height:40px;display:grid;place-items:center;border-radius:50%}
.wah-take__btn:hover{background:rgba(255,255,255,.14)}
.wah-take__btn svg{width:24px;height:24px}
.wah-take__progress{position:absolute;left:0;right:0;bottom:0;height:3px;background:rgba(255,255,255,.18)}
.wah-take__progress>span{display:block;height:100%;width:0;background:#fff}
.wah-take[data-state="open"] .wah-take__pill{visibility:hidden}
@media (prefers-reduced-motion:no-preference){.wah-take__bar:not([hidden]){animation:wah-take-in .18s ease-out}}
@keyframes wah-take-in{from{opacity:0;transform:translate(-50%,8px)}to{opacity:1;transform:translate(-50%,0)}}
`;
