/// <reference lib="dom" />
/**
 * Script-tag embed. On whatahotel.com:
 *
 *   <script src="https://.../wah-take.js"
 *           data-transcript="https://.../il-san-pietro-positano/transcript.json"></script>
 *
 * Optional `data-audio` overrides the audio URL (default: audio.mp3 next to the
 * transcript). The player renders in place, in the light DOM, so the transcript
 * stays visible to crawlers.
 */
import { renderTake, TAKE_CSS, type TakeTranscript } from "./render.js";

function ensureStyles(): void {
  if (document.getElementById("wah-take-css")) return;
  const style = document.createElement("style");
  style.id = "wah-take-css";
  style.textContent = TAKE_CSS;
  document.head.appendChild(style);
}

async function mount(script: HTMLScriptElement): Promise<void> {
  const src = script.dataset.transcript;
  if (!src) return;
  try {
    const res = await fetch(src);
    if (!res.ok) throw new Error(`transcript ${res.status}`);
    const transcript = (await res.json()) as TakeTranscript;
    const audio = script.dataset.audio ?? new URL("audio.mp3", new URL(src, document.baseURI)).href;
    ensureStyles();
    const host = document.createElement("div");
    host.innerHTML = renderTake(transcript, audio);
    script.insertAdjacentElement("afterend", host);
  } catch (err) {
    // A failed player must never break the hotel page.
    console.warn("[wah-take]", err);
  }
}

const current = document.currentScript as HTMLScriptElement | null;
if (current) void mount(current);
