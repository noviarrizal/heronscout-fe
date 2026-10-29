// Research each lead + its local competitors, ask the LLM for a site spec, check it, and save it as a draft preview.
// Usage: pnpm build:previews [count=10] [--dry]
//   --dry  writes specs to fixtures/previews/ instead of the database, so you can review them with `pnpm dev`.
import { writeFile } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";
import { z } from "zod";
import { sanitizeCopy, siteSpecSchema, type SiteSpec } from "../src/lib/spec";
import { sql } from "./lib/db";
import { enforceFacts, type Review } from "./lib/enforce-facts";
import { chatJson, type ChatMessage } from "./lib/llm";
import { canEmail, isGoodFit } from "./lib/rules";
import { SPEC_SYSTEM_PROMPT } from "./lib/spec-prompt";
import { digestPage, fetchHtml } from "./lib/web";

const args = process.argv.slice(2);
const count = Number(args.find((a) => /^\d+$/.test(a)) ?? 10);
const dry = args.includes("--dry");
const MAX_ATTEMPTS = 3;
const PAUSE_MS = 4_000; // stay under free-tier rate limits

const designSchema = siteSpecSchema.omit({ business: true });

type Lead = {
  id: number;
  name: string;
  category: string | null;
  city: string | null;
  address: string | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  rating: string | null; // numeric columns come back as strings
  review_count: number | null;
  reviews: Review[];
  image_urls: string[];
  country_code: string | null;
  company_type: string;
};

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

async function research(lead: Lead) {
  const competitors = await sql`
    select name, website, rating, review_count from leads
    where id <> ${lead.id} and city is not distinct from ${lead.city} and website is not null
    order by (category is not distinct from ${lead.category}) desc, review_count desc nulls last
    limit 3
  `;
  const [own, ...rivals] = await Promise.all([
    lead.website ? fetchHtml(lead.website) : Promise.resolve(""),
    ...competitors.map((c) => fetchHtml(c.website)),
  ]);

  return {
    business: {
      name: lead.name,
      category: lead.category,
      city: lead.city,
      address: lead.address,
      rating: lead.rating ? Number(lead.rating) : null,
      reviewCount: lead.review_count,
    },
    reviews: lead.reviews.slice(0, 12).map((r) => ({ ...r, text: r.text.slice(0, 500) })),
    images: lead.image_urls.slice(0, 9),
    ownWebsite: own ? digestPage(own) : null,
    competitors: competitors
      .map((c, i) => ({ name: c.name, rating: c.rating, reviewCount: c.review_count, site: rivals[i] ? digestPage(rivals[i], 1200) : null }))
      .filter((c) => c.site),
  };
}

async function designSpec(lead: Lead): Promise<SiteSpec> {
  const data = await research(lead);
  const messages: ChatMessage[] = [
    { role: "system", content: SPEC_SYSTEM_PROMPT },
    { role: "user", content: `Research (JSON):\n${JSON.stringify(data)}` },
  ];

  for (let attempt = 1; ; attempt++) {
    const { raw, json } = await chatJson(messages);
    const parsed = designSchema.safeParse(json);
    let problem = parsed.success ? null : z.prettifyError(parsed.error);

    if (parsed.success) {
      const sections = enforceFacts(parsed.data.sections, data.images, data.reviews);
      const spec = siteSpecSchema.safeParse({
        business: {
          name: lead.name,
          category: lead.category ?? "Local business",
          city: lead.city ?? "",
          phone: lead.phone ?? undefined,
          email: lead.email ?? undefined,
          rating: data.business.rating ?? undefined,
          reviewCount: lead.review_count ?? undefined,
        },
        theme: parsed.data.theme,
        sections,
      });
      if (spec.success) return sanitizeCopy(spec.data);
      problem = `After removing invented reviews/images the spec became invalid: ${z.prettifyError(spec.error)}`;
    }

    if (attempt >= MAX_ATTEMPTS) throw new Error(problem ?? "invalid spec");
    messages.push(
      { role: "assistant", content: raw },
      { role: "user", content: `That JSON was rejected:\n${problem}\nReturn the full corrected JSON object.` },
    );
  }
}

const candidates = (await sql`
  select * from leads l
  where status = 'contacts_checked' and email is not null
    and not exists (select 1 from previews p where p.lead_id = l.id)
  order by review_count desc nulls last
`) as Lead[];

const queue: Lead[] = [];
for (const lead of candidates) {
  if (canEmail(lead) && isGoodFit(lead)) queue.push(lead);
  else if (!dry) await sql`update leads set status = 'skipped', updated_at = now() where id = ${lead.id}`;
}
const batch = queue.slice(0, count);
console.log(`${batch.length} leads to design (${candidates.length - queue.length} skipped: country rules or not a trade).`);

const base = process.env.PREVIEW_BASE_URL ?? "http://localhost:3000";
for (const [i, lead] of batch.entries()) {
  try {
    const spec = await designSpec(lead);
    let slug = slugify(`${lead.name} ${lead.city ?? ""}`);
    if (dry) {
      await writeFile(new URL(`../fixtures/previews/${slug}.json`, import.meta.url), JSON.stringify(spec, null, 2));
      console.log(`✓ ${lead.name} → http://localhost:3000/p/${slug}`);
    } else {
      const taken = await sql`select 1 from previews where slug = ${slug}`;
      if (taken.length) slug = `${slug}-${lead.id}`;
      await sql`
        insert into previews (slug, lead_id, spec, expires_at)
        values (${slug}, ${lead.id}, ${JSON.stringify(spec)}, now() + interval '30 days')
      `;
      await sql`update leads set status = 'previewed', updated_at = now() where id = ${lead.id}`;
      console.log(`✓ ${lead.name} → ${base}/p/${slug}`);
    }
  } catch (err) {
    console.log(`✗ ${lead.name}: ${(err as Error).message.slice(0, 300)}`);
  }
  if (i < batch.length - 1) await sleep(PAUSE_MS);
}
