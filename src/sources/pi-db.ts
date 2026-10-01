/**
 * Read-only access to the WhataHotel Price Intelligence database (Neon Postgres).
 *
 * Tables used (see that repo's db/migrations):
 *   hotel                 wah_hotel_id, name, website_url, amadeus_property
 *   hotel_research_claim  motivator, claim, source_url, fetched_at
 *                         (read from the hotel's own site; source_url is NOT NULL)
 *   hotel_amenity         code, label from method=info, identity-checked
 *
 * Every query runs inside a READ ONLY transaction, so even a connection
 * string with write rights cannot change anything from here.
 */
import pg from "pg";

export interface PiResearchClaim {
  motivator: string;
  claim: string;
  sourceUrl: string;
  fetchedAt: string;
}

export interface PiHotelRecord {
  wahHotelId: string;
  name: string;
  websiteUrl: string | null;
  amadeusProperty: string | null;
  researchedAt: string | null;
  claims: PiResearchClaim[];
  amenities: Array<{ code: string; label: string }>;
}

/** Minimal query surface so tests can stub the database. */
export type Query = <R extends Record<string, unknown>>(sql: string, params: unknown[]) => Promise<R[]>;

const iso = (v: unknown): string | null => (v instanceof Date ? v.toISOString() : v == null ? null : String(v));

export async function loadPiHotel(query: Query, wahHotelId: number): Promise<PiHotelRecord | null> {
  const [hotel] = await query<{
    id: string;
    name: string;
    website_url: string | null;
    amadeus_property: string | null;
    researched_at: Date | null;
  }>(
    `SELECT id, name, website_url, amadeus_property, researched_at
       FROM hotel WHERE wah_hotel_id = $1`,
    [String(wahHotelId)],
  );
  if (!hotel) return null;

  const claims = await query<{ motivator: string; claim: string; source_url: string; fetched_at: Date }>(
    `SELECT motivator, claim, source_url, fetched_at
       FROM hotel_research_claim WHERE hotel_id = $1
      ORDER BY motivator, fetched_at DESC`,
    [hotel.id],
  );
  const amenities = await query<{ code: string; label: string }>(
    `SELECT code, label FROM hotel_amenity WHERE hotel_id = $1 ORDER BY label`,
    [hotel.id],
  );

  return {
    wahHotelId: String(wahHotelId),
    name: hotel.name,
    websiteUrl: hotel.website_url,
    amadeusProperty: hotel.amadeus_property,
    researchedAt: iso(hotel.researched_at),
    claims: claims.map((c) => ({
      motivator: c.motivator,
      claim: c.claim,
      sourceUrl: c.source_url,
      fetchedAt: iso(c.fetched_at)!,
    })),
    amenities,
  };
}

/** Opens one connection and runs `fn` inside a read-only transaction. */
export async function withReadOnlyDb<T>(fn: (query: Query) => Promise<T>): Promise<T> {
  const connectionString = process.env.PI_DATABASE_URL;
  if (!connectionString) throw new Error("PI_DATABASE_URL is not set. See .env.example.");
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    await client.query("BEGIN TRANSACTION READ ONLY");
    const query: Query = async (sql, params) => (await client.query(sql, params)).rows;
    return await fn(query);
  } finally {
    await client.query("ROLLBACK").catch(() => {});
    await client.end();
  }
}
