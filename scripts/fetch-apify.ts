// Download a finished Google Maps Scraper dataset straight into data/, ready for import:apify.
// Usage: pnpm fetch:apify <datasetId> data/houston.json
import "dotenv/config";
import { writeFile } from "node:fs/promises";

const [datasetId, out] = process.argv.slice(2);
const token = process.env.APIFY_TOKEN;
if (!datasetId || !out) {
  console.error("Usage: pnpm fetch:apify <datasetId> <output.json>");
  process.exit(1);
}
if (!token) {
  console.error("APIFY_TOKEN is missing in .env (Apify Console > Settings > API & Integrations).");
  process.exit(1);
}

const url = `https://api.apify.com/v2/datasets/${datasetId}/items?format=json&clean=true`;
const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
if (!res.ok) {
  console.error(`Apify ${res.status}: ${await res.text()}`);
  process.exit(1);
}
const items: unknown[] = await res.json();
await writeFile(out, JSON.stringify(items));
console.log(`Saved ${items.length} places to ${out}.`);
