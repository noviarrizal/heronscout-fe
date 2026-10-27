import { readFile } from "node:fs/promises";
import path from "node:path";
import { neon } from "@neondatabase/serverless";
import { sanitizeCopy, siteSpecSchema, type SiteSpec } from "./spec";

export async function getPreview(slug: string): Promise<SiteSpec | null> {
  if (!/^[a-z0-9-]+$/.test(slug)) return null;
  const spec = (await fromDatabase(slug)) ?? (await fromFixture(slug));
  return spec && sanitizeCopy(spec);
}

async function fromDatabase(slug: string) {
  if (!process.env.DATABASE_URL) return null;
  const sql = neon(process.env.DATABASE_URL);
  const rows = await sql`
    select spec from previews
    where slug = ${slug}
      and status <> 'expired'
      and (expires_at is null or expires_at > now())
  `;
  return rows.length ? siteSpecSchema.parse(rows[0].spec) : null;
}

// Demo previews and `build:previews --dry` output live in fixtures/previews/<slug>.json.
async function fromFixture(slug: string) {
  try {
    const file = path.join(process.cwd(), "fixtures", "previews", `${slug}.json`);
    return siteSpecSchema.parse(JSON.parse(await readFile(file, "utf8")));
  } catch {
    return null;
  }
}
