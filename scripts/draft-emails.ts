// Write the first email + two follow-ups for every lead that has a preview, and save them as drafts.
// Usage: pnpm draft:emails [count=10] [--dry]
//   Also writes outbox/<date>.md so the first batch can be sent by hand from Gmail.
//   --dry  only writes the outbox file, nothing is saved to the database.
import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";
import { z } from "zod";
import { sanitizeCopy } from "../src/lib/spec";
import { sql } from "./lib/db";
import { EMAIL_SYSTEM_PROMPT, PREVIEW_PLACEHOLDER } from "./lib/email-prompt";
import { chatJson, type ChatMessage } from "./lib/llm";
import { digestPage, fetchHtml } from "./lib/web";

const args = process.argv.slice(2);
const count = Number(args.find((a) => /^\d+$/.test(a)) ?? 10);
const dry = args.includes("--dry");
const MAX_ATTEMPTS = 3;
const PAUSE_MS = 3_000;

const senderName = process.env.SENDER_NAME;
const senderAddress = process.env.SENDER_ADDRESS_LINE;
const previewBase = (process.env.PREVIEW_BASE_URL ?? "").replace(/\/$/, "");
if (!senderName || !senderAddress || !previewBase) {
  console.error("Set SENDER_NAME, SENDER_ADDRESS_LINE and PREVIEW_BASE_URL in .env first.");
  process.exit(1);
}

const draftSchema = z.object({
  subject: z.string().min(3).max(60),
  body: z.string(),
  followUp1: z.string(),
  followUp2: z.string(),
});
type Draft = z.infer<typeof draftSchema>;

const BANNED = /hope this (email|message) finds you|just following up|touch base|circle back|elevate|game.?changer|stand out from the competition|online presence|\bseo\b|conversions?|\$\d|price|!/i;

const words = (s: string) => s.trim().split(/\s+/).length;

// The model is told the rules; this checks the ones that matter for deliverability and tone.
function problems(d: Draft): string[] {
  const out: string[] = [];
  if (d.body.split(PREVIEW_PLACEHOLDER).length !== 2) out.push(`body must contain ${PREVIEW_PLACEHOLDER} exactly once`);
  if (words(d.body) > 110) out.push(`body is ${words(d.body)} words, keep it under 90`);
  if (!d.body.includes("\n\n")) out.push("split the body into short paragraphs separated by blank lines");
  if (words(d.followUp1) > 50) out.push("followUp1 is too long");
  if (words(d.followUp2) > 40) out.push("followUp2 is too long");
  for (const [field, text] of Object.entries(d)) {
    const hit = text.match(BANNED);
    if (hit) out.push(`${field} uses banned wording: "${hit[0]}"`);
    if (/(regards|cheers|best,|thanks,|unsubscribe)\s*$/i.test(text.trim())) out.push(`${field} has a sign-off; code adds it`);
  }
  return out;
}

// Name + postal address (CAN-SPAM) + a plain-language opt-out (CAN-SPAM, PECR).
const signature = `\n\n${senderName}\n${senderAddress}\n\nIf it's not for you, just reply "no" and I won't email again.`;

type Lead = {
  id: number;
  name: string;
  category: string | null;
  city: string | null;
  country_code: string | null;
  website: string | null;
  email: string;
  rating: string | null;
  review_count: number | null;
  reviews: { author: string; text: string; rating: number }[];
  slug: string;
};

async function draftFor(lead: Lead): Promise<Draft> {
  const site = lead.website ? await fetchHtml(lead.website) : "";
  const research = {
    business: lead.name,
    trade: lead.category,
    city: lead.city,
    country: lead.country_code,
    googleRating: lead.rating ? Number(lead.rating) : null,
    reviewCount: lead.review_count,
    reviews: lead.reviews.slice(0, 6).map((r) => r.text.slice(0, 300)),
    currentWebsite: lead.website ? (site ? digestPage(site, 800) : "listed but would not load") : "none",
  };
  const messages: ChatMessage[] = [
    { role: "system", content: EMAIL_SYSTEM_PROMPT },
    { role: "user", content: `Research (JSON):\n${JSON.stringify(research)}` },
  ];

  for (let attempt = 1; ; attempt++) {
    const { raw, json } = await chatJson(messages);
    const parsed = draftSchema.safeParse(json);
    const issues = parsed.success ? problems(sanitizeCopy(parsed.data)) : [z.prettifyError(parsed.error)];
    if (parsed.success && issues.length === 0) return sanitizeCopy(parsed.data);
    if (attempt >= MAX_ATTEMPTS) throw new Error(issues.join("; "));
    messages.push(
      { role: "assistant", content: raw },
      { role: "user", content: `Fix these and return the full JSON again:\n- ${issues.join("\n- ")}` },
    );
  }
}

const leads = (await sql`
  select l.id, l.name, l.category, l.city, l.country_code, l.website, l.email, l.rating, l.review_count, l.reviews, p.slug
  from leads l
  join previews p on p.lead_id = l.id and p.status <> 'expired'
  where l.status = 'previewed' and l.email is not null
    and not exists (select 1 from suppression s where lower(s.email) = lower(l.email))
    and not exists (select 1 from messages m where m.lead_id = l.id)
  order by l.review_count desc nulls last
  limit ${count}
`) as Lead[];
console.log(`Drafting emails for ${leads.length} leads...`);

const date = new Date().toISOString().slice(0, 10);
const outbox: string[] = [
  `# Outbox ${date}\n\nSend from Gmail as plain text, then run \`pnpm lead sent <email>\`. Replies: \`pnpm lead replied|no|won <email>\`.\n`,
];

for (const [i, lead] of leads.entries()) {
  try {
    const d = await draftFor(lead);
    const link = `${previewBase}/p/${lead.slug}`;
    const fill = (s: string) => s.replaceAll(PREVIEW_PLACEHOLDER, link);
    const steps = [
      { step: 1, subject: d.subject, body: fill(d.body) + signature },
      { step: 2, subject: `Re: ${d.subject}`, body: fill(d.followUp1) + signature },
      { step: 3, subject: `Re: ${d.subject}`, body: fill(d.followUp2) + signature },
    ];

    if (!dry) {
      for (const m of steps) {
        await sql`insert into messages (lead_id, step, subject, body) values (${lead.id}, ${m.step}, ${m.subject}, ${m.body})`;
      }
    }
    outbox.push(
      `---\n\n## ${lead.name} (${lead.city ?? "?"})\n\n**To:** ${lead.email}  \n**Preview:** ${link}\n\n**Subject:** ${steps[0].subject}\n\n\`\`\`\n${steps[0].body}\n\`\`\`\n\n<details><summary>Follow-ups (day 4, day 11)</summary>\n\n\`\`\`\n${steps[1].body}\n\`\`\`\n\n\`\`\`\n${steps[2].body}\n\`\`\`\n</details>\n`,
    );
    console.log(`✓ ${lead.name}: "${d.subject}"`);
  } catch (err) {
    console.log(`✗ ${lead.name}: ${(err as Error).message.slice(0, 300)}`);
  }
  if (i < leads.length - 1) await sleep(PAUSE_MS);
}

await mkdir(new URL("../outbox/", import.meta.url), { recursive: true });
const file = new URL(`../outbox/${date}.md`, import.meta.url);
await writeFile(file, outbox.join("\n"));
console.log(`\nWrote outbox/${date}.md${dry ? " (dry run, nothing saved to the database)" : ""}.`);
