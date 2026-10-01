/**
 * Pulls the editorial content of a whatahotel.com hotel page into a raw source
 * document. This is input for building a profile, not a profile itself.
 */

export interface WhataHotelPage {
  url: string;
  fetched_at: string;
  whatahotel_id: number;
  name: string;
  address: { street?: string; city?: string; postal_code?: string; country?: string };
  star_rating?: number;
  average_rating?: number;
  insider_take?: string;
  whats_special?: string;
  pro_tip?: string;
  dont_miss?: string;
  pros: string[];
  cons: string[];
}

const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘",
  rdquo: "”", ldquo: "“", mdash: "—", ndash: "–", hellip: "…", eacute: "é", egrave: "è",
};

function decode(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n: string) => ENTITIES[n.toLowerCase()] ?? m);
}

export function htmlToLines(html: string): string[] {
  return decode(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, "\n"),
  )
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

/** Text of the line(s) after a heading, up to the next known heading. */
function after(lines: string[], heading: RegExp, stops: RegExp[]): string[] {
  const start = lines.findIndex((l) => heading.test(l));
  if (start < 0) return [];
  const out: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (stops.some((s) => s.test(line))) break;
    out.push(line);
  }
  return out;
}

const H = {
  take: /^An Insider'?s Take$/i,
  special: /^What'?s Special\??$/i,
  tip: /^WhatAHotel! Pro-Tip:?$/i,
  miss: /^Don'?t Miss$/i,
  insights: /^Insights, Pros & Cons/i,
  pros: /^Pros:?$/i,
  cons: /^Cons:?$/i,
  perks: /^Perks Comparison$/i,
  offer: /^Special Offer$/i,
};
const ALL_HEADINGS = Object.values(H);

interface LdHotel {
  "@type"?: string;
  name?: string;
  address?: { streetAddress?: string; addressLocality?: string; postalCode?: string; addressCountry?: string };
  starRating?: { ratingValue?: string };
}

function findLdHotel(html: string): LdHotel | undefined {
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)) {
    try {
      const data = JSON.parse(m[1] ?? "");
      const graph: LdHotel[] = Array.isArray(data["@graph"]) ? data["@graph"] : [data];
      const hotel = graph.find((g) => g["@type"] === "Hotel");
      if (hotel) return hotel;
    } catch {
      // Malformed block; keep looking.
    }
  }
  return undefined;
}

export function parseWhataHotelPage(html: string, url: string, fetchedAt = new Date()): WhataHotelPage {
  const lines = htmlToLines(html);
  const ld = findLdHotel(html);
  const idMatch = url.match(/\/hotels\/(\d+)\//);
  const join = (heading: RegExp) => after(lines, heading, ALL_HEADINGS).join(" ").trim() || undefined;
  const ratingLine = after(lines, H.insights, [H.pros])[0];
  const rating = ratingLine ? Number.parseFloat(ratingLine) : NaN;

  return {
    url,
    fetched_at: fetchedAt.toISOString(),
    whatahotel_id: idMatch ? Number(idMatch[1]) : 0,
    name: (ld?.name ?? "").trim(),
    address: {
      street: ld?.address?.streetAddress,
      city: ld?.address?.addressLocality,
      postal_code: ld?.address?.postalCode,
      country: ld?.address?.addressCountry,
    },
    star_rating: ld?.starRating?.ratingValue ? Number(ld.starRating.ratingValue) : undefined,
    average_rating: Number.isFinite(rating) ? rating : undefined,
    insider_take: join(H.take)?.replace(/^['"‘“]|['"’”]$/g, ""),
    whats_special: join(H.special),
    pro_tip: join(H.tip),
    dont_miss: join(H.miss),
    pros: after(lines, H.pros, [H.cons, H.offer, H.perks]),
    cons: after(lines, H.cons, [H.offer, H.perks]),
  };
}

export async function fetchWhataHotelPage(url: string): Promise<WhataHotelPage> {
  const res = await fetch(url, { headers: { "User-Agent": "WhataHotelVoice/0.1 (+internal content pipeline)" } });
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  return parseWhataHotelPage(await res.text(), url);
}
