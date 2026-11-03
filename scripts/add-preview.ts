// Put a hand-made preview online for a lead found outside the scraper (e.g. on Facebook).
// Usage: pnpm add:preview <slug> [--facebook <page url>] [--country US]
// Reads fixtures/previews/<slug>.json (real leads' fixtures are gitignored, so Vercel can't see them),
// adds the lead and stores the spec in the database, valid for 30 days.
// The lead is saved as 'queued', so draft:emails and send:due leave it alone: send the first email
// yourself, then run `pnpm lead sent <email>` so replies are watched.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { sanitizeCopy, siteSpecSchema } from "../src/lib/spec";
import { sql } from "./lib/db";

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const slug = args[0];
if (!slug || !/^[a-z0-9-]+$/.test(slug) || slug.startsWith("demo-")) {
  console.error("Usage: pnpm add:preview <slug> [--facebook <page url>] [--country US]  (not for demo-* fixtures)");
  process.exit(1);
}

const file = path.join(process.cwd(), "fixtures", "previews", `${slug}.json`);
const spec = sanitizeCopy(siteSpecSchema.parse(JSON.parse(await readFile(file, "utf8"))));
const b = spec.business;

const [existing] = b.email ? await sql`select id from leads where lower(email) = lower(${b.email})` : [];
const [lead] = existing
  ? [existing]
  : await sql`
      insert into leads (name, category, phone, city, country_code, email, facebook, status)
      values (${b.name}, ${b.category}, ${b.phone ?? null}, ${b.city}, ${flag("--country") ?? "US"},
              ${b.email ?? null}, ${flag("--facebook") ?? null}, 'queued')
      returning id
    `;
await sql`
  insert into previews (slug, lead_id, spec, expires_at)
  values (${slug}, ${lead.id}, ${JSON.stringify(spec)}, now() + interval '30 days')
  on conflict (slug) do update set spec = excluded.spec, expires_at = excluded.expires_at, status = 'draft'
`;

const base = (process.env.PREVIEW_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
console.log(`${b.name}: ${existing ? "existing lead" : "new lead"} #${lead.id}, preview ${base}/p/${slug}`);
