// Scrape the next city + trade pairs from config/cities.json x TRADES that haven't been scraped yet,
// and import them. Places with and without a website both come in: find:contacts handles each kind.
// Usage: pnpm scrape [pairs=2]    each pair costs about $0.70 on Apify
import { mkdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { runActor } from "./lib/apify";
import { sql } from "./lib/db";
import { cities } from "./lib/rules";

// Plumbing and HVAC jobs are big tickets, so a website pays off fast for them.
const TRADES = ["house painter", "plumber", "hvac contractor"];
const PLACES_PER_SEARCH = 50;
const MAX_USD_PER_SEARCH = 1; // ~50 places with 5 reviews + 6 photos costs about $0.70
const ACTOR = "compass~crawler-google-places";

const count = Number(process.argv[2] ?? 2);
if (!process.env.APIFY_TOKEN) {
  console.error("APIFY_TOKEN is missing.");
  process.exit(1);
}

// Dallas, Houston and Phoenix painters were scraped by hand before scrape_runs existed.
const key = (city: string, term: string) => `${city.toLowerCase()}|${term}`;
const done = new Set([
  ...(await sql`select city, search_term from scrape_runs`).map((r) => key(r.city, r.search_term)),
  ...(await sql`select distinct city from leads where city is not null`).map((r) => key(r.city, TRADES[0])),
]);
// City by city, every trade, so plumbers and HVAC in cities already done for painters come first.
const next = cities.flatMap((c) => TRADES.map((term) => ({ ...c, term }))).filter((j) => !done.has(key(j.city, j.term))).slice(0, count);
if (next.length === 0) {
  console.log("Every city and trade in config/cities.json has been scraped. Add more cities to keep going.");
  process.exit(0);
}

await mkdir(new URL("../data/", import.meta.url), { recursive: true });
for (const c of next) {
  console.log(`Scraping ${c.term} in ${c.city}...`);
  const { runId, items } = await runActor(
    ACTOR,
    {
      searchStringsArray: [c.term],
      locationQuery: c.location,
      maxCrawledPlacesPerSearch: PLACES_PER_SEARCH,
      language: "en",
      website: "allPlaces",
      skipClosedPlaces: true,
      maxReviews: 5,
      reviewsSort: "mostRelevant",
      reviewsOrigin: "google",
      maxImages: 6,
    },
    MAX_USD_PER_SEARCH,
  );
  if (!items) {
    console.log(`  ${c.term} in ${c.city}: skipped.`);
    continue;
  }

  const slug = `${c.city}-${c.term}`.toLowerCase().replace(/\s+/g, "-");
  const file = new URL(`../data/${slug}.json`, import.meta.url);
  await writeFile(file, JSON.stringify(items));
  await sql`insert into scrape_runs (city, search_term, apify_run_id, places) values (${c.city}, ${c.term}, ${runId}, ${items.length})`;
  console.log(`  ${items.length} places.`);
  execFileSync("pnpm", ["import:apify", fileURLToPath(file), `--city=${c.city}`], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
}
