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
