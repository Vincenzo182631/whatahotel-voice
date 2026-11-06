/** Picks the same-property pages worth reading from a property's home page. */
const ORDER = [
  /rooms?|suites?|accommodations?|stay/i,
  /dining|restaurants?|dine|bars?|eat/i,
  /spa|wellness|fitness|pool|beach/i,
  /amenities|facilities|services/i,
  /experiences?|explore|activities|family|kids|golf|things-to-do/i,
  /location|getting-here|how-to-get|map|directions|contact/i,
  /faq|frequently/i,
  /about|overview|hotel-info|hotel-facts|the-hotel/i,
];
const SKIP = /offers?|packages?|gallery|photos?|careers?|jobs|residences|meetings|weddings?|events?|press|sitemap|privacy|terms|cookies?|login|account|cart|book|reservations?|newsletter|blog|news|gift|sustainability|accessib|\.[a-z0-9]{2,4}$/i;

export function pickPages(homeMarkdown: string, baseUrl: string, max: number): string[] {
  const base = new URL(baseUrl);
  const basePath = base.pathname.replace(/\/+$/, "");
  const baseDepth = basePath.split("/").filter(Boolean).length;
  const found = new Map<string, string>();
  for (const m of homeMarkdown.matchAll(/\[([^\]]*)\]\(([^)\s]+)[^)]*\)/g)) {
    let u: URL;
    try {
      u = new URL(m[2]!, base);
    } catch {
      continue;
    }
    if (u.hostname !== base.hostname || !/^https?:$/.test(u.protocol)) continue;
    const p = u.pathname.replace(/\/+$/, "");
    if (basePath && !(p === basePath || p.startsWith(`${basePath}/`))) continue;
    const depth = p.split("/").filter(Boolean).length;
    if (p === basePath || depth > baseDepth + 2 || SKIP.test(p)) continue;
    found.set(`${u.origin}${p}/`, `${m[1]} ${p}`);
  }
  const score = (label: string) => {
    const i = ORDER.findIndex((re) => re.test(label));
    return i === -1 ? ORDER.length : i;
  };
  return [...found.entries()]
    .sort((a, b) => score(a[1]) - score(b[1]) || a[0].length - b[0].length)
    .slice(0, max)
    .map(([u]) => u);
}
