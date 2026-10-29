// Import a Google Maps Scraper (compass/crawler-google-places) JSON export.
// Usage: pnpm import:apify data/dallas-painters.json [--city=Dallas]
//   --city is used for businesses that hide their address on Google Maps.
import { readFile } from "node:fs/promises";
import { sql } from "./lib/db";
import { countryFromLocation } from "./lib/geo";

type ApifyPlace = {
  placeId?: string;
  title?: string;
  categoryName?: string;
  phone?: string;
  website?: string;
  address?: string;
  city?: string;
  countryCode?: string;
  totalScore?: number;
  reviewsCount?: number;
  url?: string;
  permanentlyClosed?: boolean;
  temporarilyClosed?: boolean;
  imageUrls?: string[];
  reviews?: { name?: string; text?: string; stars?: number }[];
  emails?: string[];
  instagrams?: string[];
  facebooks?: string[];
  location?: { lat?: number; lng?: number } | null;
};

const file = process.argv.slice(2).find((a) => !a.startsWith("--"));
const fallbackCity = process.argv.find((a) => a.startsWith("--city="))?.slice("--city=".length) ?? null;
if (!file) {
  console.error("Usage: pnpm import:apify <export.json> [--city=Dallas]");
  process.exit(1);
}

const places: ApifyPlace[] = JSON.parse(await readFile(file, "utf8"));
let inserted = 0;
let skipped = 0;

// Apify's default "Overview" export drops website, reviews and images, which the rest of the pipeline needs.
if (places.length && !places.some((p) => "website" in p || "reviews" in p || "imageUrls" in p)) {
  console.warn(
    "⚠ This looks like Apify's 'Overview' export: no website, reviews or images.\n" +
      "  Re-export the dataset as JSON with 'All fields' selected, otherwise no emails or previews can be made.\n",
  );
}

for (const p of places) {
  // Older/overview exports have no placeId field, but the Maps URL carries it.
  p.placeId ??= p.url ? (new URL(p.url).searchParams.get("query_place_id") ?? undefined) : undefined;
  if (!p.title || !p.placeId || p.permanentlyClosed || p.temporarilyClosed) {
    skipped++;
    continue;
  }
  const reviews = (p.reviews ?? [])
    .filter((r) => r.text && r.text.length > 20)
    .map((r) => ({ author: r.name ?? "Customer", text: r.text, rating: r.stars ?? 5 }));
  // UK outreach is limited to registered companies; this is a first pass before Companies House.
  const companyType = /\b(ltd|limited|llp|plc)\b\.?$/i.test(p.title.trim()) ? "ltd" : "unknown";

  const rows = await sql`
    insert into leads (place_id, name, category, phone, website, address, city, country_code,
      rating, review_count, maps_url, image_urls, reviews, email, instagram, facebook, company_type, raw)
    values (${p.placeId}, ${p.title}, ${p.categoryName ?? null}, ${p.phone ?? null}, ${p.website ?? null},
      ${p.address ?? null}, ${p.city ?? fallbackCity}, ${p.countryCode ?? countryFromLocation(p.location)}, ${p.totalScore ?? null},
      ${p.reviewsCount ?? null}, ${p.url ?? null}, ${JSON.stringify(p.imageUrls ?? [])},
      ${JSON.stringify(reviews)}, ${p.emails?.[0] ?? null}, ${p.instagrams?.[0] ?? null},
      ${p.facebooks?.[0] ?? null}, ${companyType}, ${JSON.stringify(p)})
    on conflict (place_id) do nothing
    returning id
  `;
  if (rows.length) inserted++;
  else skipped++;
}

console.log(`Imported ${inserted} leads, skipped ${skipped} (closed, incomplete or already in the database).`);
