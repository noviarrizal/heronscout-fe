import { readFileSync } from "node:fs";

export type City = { city: string; location: string; timeZone: string };

// Target cities for the weekly scrape, in order. Edit config/cities.json to change the list.
export const cities: City[] = JSON.parse(readFileSync(new URL("../../config/cities.json", import.meta.url), "utf8"));

// Who we're allowed to cold email, per country. Not legal advice; keep it conservative.
//   US: CAN-SPAM allows B2B cold email with a working opt-out and a postal address.
//   AU: Spam Act inferred consent covers conspicuously published business addresses.
//   GB: PECR only allows it to corporate subscribers (Ltd/LLP/PLC), not sole traders.
// Everything else (CA, EU, ...) needs prior consent, so it's skipped.
export function canEmail(lead: { country_code: string | null; company_type: string }) {
  switch (lead.country_code?.toUpperCase()) {
    case "US":
    case "AU":
      return true;
    case "GB":
      return lead.company_type === "ltd";
    default:
      return false;
  }
}

// Search terms like "house painter" or "plumber" also return shops, art studios, museums and franchise branches. Those
// either aren't trades or already get a corporate site, so they're not worth a preview. Fewer than
// MIN_REVIEWS usually means a brand-new or dormant business.
const NOT_A_TRADE =
  /gallery|art studio|^artist|paint store|painting studio|supplier|supply|wholesale|home builder|store$|museum|exhibit|interior designer|plumbing school|trade school/i;
const NOT_A_TRADE_NAME = /\bhomes$|art league|museum/i;
const FRANCHISE_PAGE = /\/(locations?|studio|franchise|service-areas)\//i;
const FRANCHISE_BRAND =
  /certapro|that ?1 ?painter|paint ?ez|five star painting|fresh coat|360 painting|wow 1 day|n-hance|mr\.? handyman|ace handyman|handyman connection|men in kilts|kitchen tune-up|sherwin|home depot|roto-?rooter|mr\.? rooter|benjamin franklin plumbing|rescue rooter|\bars\b|one hour heating|aire serv|service experts|mister sparky|horizon services|baker brothers|abc home|len the plumber|lowe'?s|ferguson/i;
const MIN_REVIEWS = 5;

export function isGoodFit(lead: { name: string; category: string | null; website: string | null; review_count: number | null }) {
  if (lead.category && NOT_A_TRADE.test(lead.category)) return false;
  if (NOT_A_TRADE_NAME.test(lead.name)) return false;
  if (FRANCHISE_BRAND.test(lead.name) || (lead.website && FRANCHISE_BRAND.test(lead.website))) return false;
  if (lead.website && FRANCHISE_PAGE.test(lead.website)) return false;
  return (lead.review_count ?? 0) >= MIN_REVIEWS;
}

// Recipient's local time decides when an email may go out (weekday business hours only).
const CITY_TZ = new Map(cities.map((c) => [c.city.toLowerCase(), c.timeZone]));
const COUNTRY_TZ: Record<string, string> = { US: "America/Chicago", GB: "Europe/London", AU: "Australia/Sydney" };

export function leadTimeZone(lead: { city: string | null; country_code: string | null }) {
  return CITY_TZ.get(lead.city?.toLowerCase() ?? "") ?? COUNTRY_TZ[lead.country_code?.toUpperCase() ?? ""] ?? "America/Chicago";
}

export function isBusinessHours(timeZone: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short", hour: "numeric", hour12: false }).formatToParts(now);
  const weekday = parts.find((p) => p.type === "weekday")?.value;
  const hour = Number(parts.find((p) => p.type === "hour")?.value);
  return weekday !== "Sat" && weekday !== "Sun" && hour >= 8 && hour < 17;
}
