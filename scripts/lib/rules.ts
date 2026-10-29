// Who we're allowed to cold email, per country. Not legal advice; keep it conservative.
//   US: CAN-SPAM allows B2B cold email with a working opt-out and a postal address.
//   AU: Spam Act inferred consent covers conspicuously published business addresses.
//   GB: PECR only allows it to corporate subscribers (Ltd/LLP/PLC), not sole traders.
// Everything else (CA, EU, ...) needs prior consent, so it's skipped.
// Search terms like "house painter" also return shops, art studios and franchise branches. Those either
// aren't trades or already get a corporate site, so they're not worth a preview.
const NOT_A_TRADE = /gallery|art studio|^artist|paint store|painting studio|supplier|home builder|store$/i;
const FRANCHISE_PAGE = /\/(locations?|studio|franchise)\//i;

// Recipient's local time decides when an email may go out (weekday business hours only).
const CITY_TZ: Record<string, string> = {
  phoenix: "America/Phoenix",
  scottsdale: "America/Phoenix",
  mesa: "America/Phoenix",
  houston: "America/Chicago",
  dallas: "America/Chicago",
  austin: "America/Chicago",
  "san antonio": "America/Chicago",
  denver: "America/Denver",
  "los angeles": "America/Los_Angeles",
  "new york": "America/New_York",
  atlanta: "America/New_York",
  miami: "America/New_York",
};
const COUNTRY_TZ: Record<string, string> = { US: "America/Chicago", GB: "Europe/London", AU: "Australia/Sydney" };

export function leadTimeZone(lead: { city: string | null; country_code: string | null }) {
  return CITY_TZ[lead.city?.toLowerCase() ?? ""] ?? COUNTRY_TZ[lead.country_code?.toUpperCase() ?? ""] ?? "America/Chicago";
}

export function isBusinessHours(timeZone: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short", hour: "numeric", hour12: false }).formatToParts(now);
  const weekday = parts.find((p) => p.type === "weekday")?.value;
  const hour = Number(parts.find((p) => p.type === "hour")?.value);
  return weekday !== "Sat" && weekday !== "Sun" && hour >= 8 && hour < 17;
}

export function isGoodFit(lead: { category: string | null; website: string | null }) {
  if (lead.category && NOT_A_TRADE.test(lead.category)) return false;
  if (lead.website && FRANCHISE_PAGE.test(lead.website)) return false;
  return true;
}

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
