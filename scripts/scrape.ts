// Scrape the next cities from config/cities.json that haven't been scraped yet, and import them.
// Usage: pnpm scrape [cities=2]
import { mkdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";
import { sql } from "./lib/db";
import { cities } from "./lib/rules";

const SEARCH_TERM = "house painter";
const PLACES_PER_CITY = 50;
const MAX_USD_PER_CITY = 1; // ~50 places with 5 reviews + 6 photos costs about $0.70
const ACTOR = "compass~crawler-google-places";

const count = Number(process.argv[2] ?? 2);
const token = process.env.APIFY_TOKEN;
if (!token) {
  console.error("APIFY_TOKEN is missing.");
  process.exit(1);
}

async function apify(path: string, init?: RequestInit) {
  const res = await fetch(`https://api.apify.com/v2${path}`, {
    ...init,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...init?.headers },
  });
  if (!res.ok) throw new Error(`Apify ${res.status}: ${await res.text()}`);
  return res.json();
}

// Dallas, Houston and Phoenix were scraped by hand before this table existed.
const done = new Set(
  [...(await sql`select city from scrape_runs`), ...(await sql`select distinct city from leads where city is not null`)].map((r) =>
    (r.city as string).toLowerCase(),
  ),
);
const next = cities.filter((c) => !done.has(c.city.toLowerCase())).slice(0, count);
if (next.length === 0) {
  console.log("Every city in config/cities.json has been scraped. Add more cities to keep going.");
  process.exit(0);
}

await mkdir(new URL("../data/", import.meta.url), { recursive: true });
for (const c of next) {
  console.log(`Scraping ${c.city}...`);
  const input = {
    searchStringsArray: [SEARCH_TERM],
    locationQuery: c.location,
    maxCrawledPlacesPerSearch: PLACES_PER_CITY,
    language: "en",
    website: "withWebsite",
    skipClosedPlaces: true,
    maxReviews: 5,
    reviewsSort: "mostRelevant",
    reviewsOrigin: "google",
    maxImages: 6,
  };
  const { data: run } = await apify(`/acts/${ACTOR}/runs?maxTotalChargeUsd=${MAX_USD_PER_CITY}`, {
    method: "POST",
    body: JSON.stringify(input),
  });

  let status = run.status as string;
  while (!["SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"].includes(status)) {
    await sleep(15_000);
    status = (await apify(`/actor-runs/${run.id}`)).data.status;
  }
  if (status !== "SUCCEEDED") {
    console.log(`  ${c.city}: Apify run ${status}, skipping.`);
    continue;
  }

  const items: unknown[] = await apify(`/datasets/${run.defaultDatasetId}/items?format=json&clean=true`);
  const file = new URL(`../data/${c.city.toLowerCase().replace(/\s+/g, "-")}.json`, import.meta.url);
  await writeFile(file, JSON.stringify(items));
  await sql`insert into scrape_runs (city, search_term, apify_run_id, places) values (${c.city}, ${SEARCH_TERM}, ${run.id}, ${items.length})`;
  console.log(`  ${items.length} places.`);
  execFileSync("pnpm", ["import:apify", fileURLToPath(file), `--city=${c.city}`], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
}
