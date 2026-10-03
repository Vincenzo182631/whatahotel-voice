/// <reference lib="dom" />
/**
 * Script-tag embed. On whatahotel.com:
 *
 *   <script src="https://.../wah-take.js"
 *           data-transcript="https://.../il-san-pietro-positano/transcript.json"></script>
 *
 * The audio is `audio.mp3` next to `data-transcript` (the transcript itself is
 * not fetched or shown), or `data-audio` when given. The player renders in
 * place and never throws into the host page.
 */
import { renderTake, TAKE_CSS } from "./render.js";

function ensureStyles(): void {
  if (document.getElementById("wah-take-css")) return;
  const style = document.createElement("style");
  style.id = "wah-take-css";
  style.textContent = TAKE_CSS;
  document.head.appendChild(style);
}

function mount(script: HTMLScriptElement): void {
  try {
    const transcript = script.dataset.transcript;
    const audio =
      script.dataset.audio ?? (transcript ? new URL("audio.mp3", new URL(transcript, document.baseURI)).href : undefined);
    if (!audio) return;
    ensureStyles();
    const host = document.createElement("div");
    host.innerHTML = renderTake(audio);
    script.insertAdjacentElement("afterend", host);
  } catch (err) {
    console.warn("[wah-take]", err);
  }
}

const current = document.currentScript as HTMLScriptElement | null;
if (current) mount(current);
