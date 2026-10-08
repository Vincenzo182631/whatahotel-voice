/// <reference lib="dom" />
/**
 * Script-tag embed. On whatahotel.com:
 *
 *   <script src="https://.../wah-take.js"
 *           data-transcript="https://.../il-san-pietro-positano/transcript.json"></script>
 *
 * Renders a "Hear Hotel Highlights" pill in place; clicking it opens a player
 * bar and plays. Audio is `audio.mp3` beside `data-transcript` (or `data-audio`).
 * The transcript supplies the hotel name, a collapsed "Read the transcript" panel and a JSON-LD AudioObject (with the transcript text) added to the page head. Optional `data-image` adds a
 * thumbnail. URLs are cleaned of stray backticks, quotes and spaces. If the audio
 * cannot be loaded the widget removes itself, and it never throws into the host
 * page.
 */
import { audioObjectJsonLd, cleanUrl, formatTime, ICONS, renderTake, renderTranscript, TAKE_CSS, type TranscriptData } from "./render.js";

function ensureStyles(): void {
  if (document.getElementById("wah-take-css")) return;
  const style = document.createElement("style");
  style.id = "wah-take-css";
  style.textContent = TAKE_CSS;
  document.head.appendChild(style);
}

function wire(root: HTMLElement): void {
  const bar = root.querySelector<HTMLElement>(".wah-take__bar")!;
  const audio = root.querySelector<HTMLAudioElement>("audio")!;
  const q = (role: string) => root.querySelector<HTMLElement>(`[data-role="${role}"]`)!;
  const setPlaying = (on: boolean) => {
    root.dataset.playing = String(on);
    q("toggle-icon").innerHTML = on ? ICONS.pause : ICONS.play;
    root.querySelector('[data-act="toggle"]')!.setAttribute("aria-label", on ? "Pause" : "Play");
  };
  const showDuration = () => (q("duration").textContent = formatTime(audio.duration));

  audio.addEventListener("loadedmetadata", showDuration);
  // A dead player is worse than none: if the audio cannot load, remove the widget.
  audio.addEventListener("error", () => {
    console.warn("[wah-take] audio failed to load:", audio.currentSrc || audio.src);
    (root.parentElement ?? root).remove();
  });
  audio.addEventListener("play", () => setPlaying(true));
  audio.addEventListener("pause", () => setPlaying(false));
  audio.addEventListener("ended", () => setPlaying(false));
  audio.addEventListener("timeupdate", () => {
    if (audio.duration > 0) q("progress").style.width = `${(audio.currentTime / audio.duration) * 100}%`;
  });

  root.addEventListener("click", (e) => {
    const act = (e.target as Element).closest<HTMLElement>("[data-act]")?.dataset.act;
    if (act === "open") {
      root.dataset.state = "open";
      bar.hidden = false;
      void audio.play().catch(() => setPlaying(false));
      root.querySelector<HTMLElement>('[data-act="toggle"]')!.focus();
    } else if (act === "toggle") {
      if (audio.paused) {
        if (audio.ended) audio.currentTime = 0;
        void audio.play().catch(() => setPlaying(false));
      } else audio.pause();
    } else if (act === "close") {
      audio.pause();
      audio.currentTime = 0;
      q("progress").style.width = "0";
      bar.hidden = true;
      root.dataset.state = "idle";
      root.querySelector<HTMLElement>('[data-act="open"]')!.focus();
    }
  });
  root.addEventListener("keydown", (e) => {
    if ((e as KeyboardEvent).key === "Escape" && root.dataset.state === "open") {
      root.querySelector<HTMLElement>('[data-act="close"]')!.click();
    }
  });
}

async function fetchTranscript(transcriptUrl: string): Promise<TranscriptData | undefined> {
  try {
    const res = await fetch(transcriptUrl);
    if (!res.ok) return undefined;
    return (await res.json()) as TranscriptData;
  } catch {
    return undefined;
  }
}

/** Adds the AudioObject JSON-LD to the page; the duration is filled in once the audio reports it. */
function addJsonLd(t: TranscriptData, audioUrl: string, audio: HTMLAudioElement): void {
  const tag = document.createElement("script");
  tag.type = "application/ld+json";
  tag.dataset.wahTake = "audio-object";
  const write = () => (tag.textContent = JSON.stringify(audioObjectJsonLd(t, audioUrl, Number.isFinite(audio.duration) ? audio.duration : undefined)));
  write();
  audio.addEventListener("loadedmetadata", write);
  document.head.appendChild(tag);
}

function mount(script: HTMLScriptElement): void {
  try {
    const transcript = cleanUrl(script.dataset.transcript);
    const transcriptUrl = transcript ? new URL(transcript, document.baseURI).href : undefined;
    const audioUrl = cleanUrl(script.dataset.audio) ?? (transcriptUrl ? new URL("audio.mp3", transcriptUrl).href : undefined);
    if (!audioUrl) return;
    ensureStyles();
    const host = document.createElement("div");
    host.innerHTML = renderTake({ audioUrl, imageUrl: cleanUrl(script.dataset.image) });
    const root = host.firstElementChild as HTMLElement;
    wire(root);
    script.insertAdjacentElement("afterend", host);
    if (transcriptUrl) {
      void fetchTranscript(transcriptUrl).then((t) => {
        if (!t) return;
        if (t.hotel?.name) root.querySelector('[data-role="name"]')!.textContent = t.hotel.name;
        root.insertAdjacentHTML("beforeend", renderTranscript(t));
        addJsonLd(t, audioUrl, root.querySelector<HTMLAudioElement>("audio")!);
      });
    }
  } catch (err) {
    console.warn("[wah-take]", err);
  }
}

const current = document.currentScript as HTMLScriptElement | null;
if (current) mount(current);
