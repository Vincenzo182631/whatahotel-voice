/**
 * Read-only client for the WhataHotel data API (`/data/api.cfm`).
 *
 * The quirks handled here were measured by the Price Intelligence project
 * (Vincenzo182631/Whatahotel-Price-Intelligence, packages/ingest/src/adapters/whatahotel):
 *
 *  - Every response is HTTP 200, including auth failure. The real outcome is
 *    `wahData.status`: connection 1 and code "100" (hotel) or "200" (others).
 *  - Some responses carry a trailing comma before `]`/`}`; a strict parse fails.
 *  - The key is a query parameter, so every logged URL must be redacted.
 *  - `info` is keyed by name + city and returns NO hotel name. Its only identity
 *    is `amadeus.codes`, which must match the `ama-property` from `hotel`.
 *
 * Only fields whose shape has been measured are parsed. Everything else in the
 * `info` payload is kept raw for a person to read, never turned into claims.
 */

const BASE_URL = "https://whatahotel.com/data/api.cfm";
const SUCCESS_CODES = new Set(["100", "200"]);

export type WahMethod = "hotel" | "info";

interface WahStatus {
  connection: number;
  code: string;
  message: string;
}

export class WahApiError extends Error {
  constructor(
    readonly status: WahStatus,
    readonly url: string,
  ) {
    super(`WhataHotel API ${status.code}: ${status.message} (${url})`);
  }
  get retryable(): boolean {
    return this.status.code === "500";
  }
}

export function redact(url: string): string {
  return url.replace(/(apiKey=)[^&]*/i, "$1<redacted>");
}

/** Drop commas that sit directly before a closing bracket, outside strings. */
export function stripTrailingCommas(text: string): string {
  let out = "";
  let inString = false;
  let escaped = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (inString) {
      out += ch;
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    if (ch === ",") {
      let j = i + 1;
      while (j < text.length && /\s/.test(text[j]!)) j++;
      if (text[j] === "]" || text[j] === "}") continue;
    }
    out += ch;
  }
  return out;
}

/** Strict parse first; repair only if that fails, and rethrow the original error otherwise. */
export function parseLenientJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch (strictError) {
    try {
      return JSON.parse(stripTrailingCommas(text));
    } catch {
      throw strictError;
    }
  }
}

export interface WahClientOptions {
  apiKey: string;
  baseUrl?: string;
  maxRetries?: number;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export class WahClient {
  private readonly baseUrl: string;
  private readonly maxRetries: number;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly opts: WahClientOptions) {
    if (!opts.apiKey) throw new Error("WAH_API_KEY is not set. See .env.example.");
    this.baseUrl = opts.baseUrl ?? BASE_URL;
    this.maxRetries = opts.maxRetries ?? 2;
    this.timeoutMs = opts.timeoutMs ?? 30_000;
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  static fromEnv(): WahClient {
    return new WahClient({ apiKey: process.env.WAH_API_KEY ?? "" });
  }

  async call(method: WahMethod, params: Record<string, string | number>): Promise<Record<string, unknown>> {
    const url = new URL(this.baseUrl);
    url.searchParams.set("method", method);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
    url.searchParams.set("apiKey", this.opts.apiKey);
    const safeUrl = redact(url.toString());

    let lastError: unknown;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, 500 * 2 ** (attempt - 1)));
      try {
        const res = await this.fetchImpl(url, {
          signal: AbortSignal.timeout(this.timeoutMs),
          headers: { accept: "application/json", "user-agent": "WhataHotelVoice/0.1 (+internal content pipeline)" },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status} from ${safeUrl}`);
        const body = parseLenientJson(await res.text()) as { wahData?: Record<string, unknown> & { status?: WahStatus } };
        const data = body?.wahData;
        if (!data?.status) throw new Error(`Malformed response (no wahData.status) from ${safeUrl}`);
        // THE status check: HTTP 200 means nothing here.
        if (data.status.connection !== 1 || !SUCCESS_CODES.has(String(data.status.code))) {
          throw new WahApiError(data.status, safeUrl);
        }
        return data;
      } catch (err) {
        lastError = err;
        if (err instanceof WahApiError && !err.retryable) throw err;
      }
    }
    throw lastError;
  }
}

/* ── method=hotel ─────────────────────────────────────────────────────── */

export interface WahHotel {
  hotelID: string;
  name: string;
  city?: string;
  region?: string;
  country?: string;
  address?: string;
  url?: string;
  latitude?: number;
  longitude?: number;
  /** Amadeus property code: the identity `info` responses are checked against. */
  amadeusProperty: string | null;
}

const text = (v: unknown): string | undefined => {
  if (typeof v !== "string" && typeof v !== "number") return undefined;
  const t = String(v).trim();
  return t === "" || t.toUpperCase() === "NULL" ? undefined : t;
};

export function parseHotel(data: Record<string, unknown>): WahHotel {
  const hotels = Array.isArray(data.hotels) ? data.hotels : [];
  const h = (hotels[0] ?? {}) as Record<string, unknown>;
  const id = text(h.hotelID);
  const name = text(h.name);
  if (!id || !name) throw new Error("hotel response contained no hotel");
  const num = (v: unknown) => {
    const n = Number.parseFloat(String(v));
    return Number.isFinite(n) ? n : undefined;
  };
  return {
    hotelID: id,
    name,
    city: text(h.city),
    region: text(h.region),
    country: text(h.country),
    address: text(h.address),
    url: text(h.url),
    latitude: num(h["loc-lat"]),
    longitude: num(h["loc-long"]),
    amadeusProperty: text(h["ama-property"]) ?? null,
  };
}

export async function fetchHotel(client: WahClient, id: number): Promise<WahHotel> {
  return parseHotel(await client.call("hotel", { hotel: id }));
}

/* ── method=info ──────────────────────────────────────────────────────── */

export interface WahInfo {
  /** `amadeus.codes`; null when absent or the literal "NULL". */
  amadeusCode: string | null;
  restaurants: string[];
  amenities: Array<{ code: string; label: string }>;
  /** DESCSTATUS other than "1": the source reporting failure inside a success. */
  degraded: boolean;
  /** Full payload minus the session block, for human review only. */
  raw: Record<string, unknown>;
}

/** The source collapses one-element arrays to a bare object. */
function asArray(node: unknown): unknown[] {
  if (Array.isArray(node)) return node;
  return node && typeof node === "object" ? [node] : [];
}

export function parseInfo(data: Record<string, unknown>): WahInfo {
  const amadeus = (data.amadeus ?? {}) as Record<string, unknown>;
  const hotel = (data.hotel ?? {}) as Record<string, unknown>;
  const status = text(hotel.DESCSTATUS);

  const amenities: WahInfo["amenities"] = [];
  const seen = new Set<string>();
  // GUESTROOMS is an array of room blocks, each with its own ROOMRMA list.
  for (const block of asArray(hotel.GUESTROOMS)) {
    for (const row of asArray((block as Record<string, unknown>)?.ROOMRMA)) {
      const r = row as Record<string, unknown>;
      const code = text(r.RMACODE);
      const label = text(r.RMAVAL);
      if (!code || !label || seen.has(code)) continue;
      seen.add(code);
      amenities.push({ code, label });
    }
  }

  const restaurants = [
    ...new Set(
      asArray(hotel.RESTAURANTS)
        .map((r) => text((r as Record<string, unknown>)?.RESTAURANTNAME))
        .filter((n): n is string => Boolean(n)),
    ),
  ];

  // Session carries cfID/cfToken, which are credentials. Never store them.
  const { session: _session, ...raw } = data;
  return { amadeusCode: text(amadeus.codes) ?? null, restaurants, amenities, degraded: status !== undefined && status !== "1", raw };
}

/** Remove non-ASCII characters (e.g. ®, é) and collapse the whitespace they leave behind. */
export function stripNonAscii(s: string): string {
  return s.replace(/[^\x20-\x7E]/g, "").replace(/\s+/g, " ").trim();
}

/**
 * Fetches `info` and refuses it unless its Amadeus code matches the hotel's.
 * Without this, one hotel's data can silently land on another with a similar name.
 */
export async function fetchVerifiedInfo(client: WahClient, hotel: WahHotel): Promise<WahInfo> {
  if (!hotel.amadeusProperty) throw new Error(`hotel ${hotel.hotelID} has no Amadeus code; cannot verify info`);
  if (!hotel.city) throw new Error(`hotel ${hotel.hotelID} has no city; info needs one`);
  // Non-ASCII names are rejected upstream with a 400, so they are stripped. A wrong match is
  // still caught by the Amadeus check below.
  const info = parseInfo(
    await client.call("info", { hotelName: stripNonAscii(hotel.name), hotelCity: stripNonAscii(hotel.city) }),
  );
  if (info.amadeusCode !== hotel.amadeusProperty) {
    throw new Error(
      `info identity mismatch for ${hotel.name}: got ${info.amadeusCode ?? "none"}, expected ${hotel.amadeusProperty}`,
    );
  }
  if (info.degraded) throw new Error(`info for ${hotel.name} is degraded (DESCSTATUS != 1)`);
  return info;
}
