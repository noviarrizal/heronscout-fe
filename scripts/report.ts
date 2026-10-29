// Email yourself what's waiting for approval, so the week's batch can be checked from a phone.
// Usage: pnpm report
import { sql } from "./lib/db";
import { createTransport, fromAddress, requireMailConfig } from "./lib/mail";

requireMailConfig();
const base = (process.env.PREVIEW_BASE_URL ?? "").replace(/\/$/, "");

const waiting = await sql`
  select l.name, l.city, l.review_count, m.subject, p.slug
  from messages m join leads l on l.id = m.lead_id join previews p on p.lead_id = l.id and p.status <> 'expired'
  where m.step = 1 and m.status = 'draft' and l.status = 'previewed'
  order by l.review_count desc nulls last
`;
const [{ sent, replied, won }] = await sql`
  select count(*) filter (where status in ('contacted', 'replied', 'won', 'lost', 'bounced'))::int as sent,
         count(*) filter (where status = 'replied')::int as replied,
         count(*) filter (where status = 'won')::int as won
  from leads
`;

const lines = waiting.map(
  (w, i) => `${i + 1}. ${w.name} (${w.city}, ${w.review_count ?? 0} reviews)\n   "${w.subject}"\n   ${base}/p/${w.slug}`,
);
const text = [
  `So far: ${sent} contacted, ${replied} replied, ${won} won.`,
  "",
  `${waiting.length} first emails are drafted and waiting for approval, best leads first:`,
  "",
  ...lines,
  "",
  "To approve the next ones: GitHub > Actions > Queue emails > Run workflow (or `pnpm queue 3`).",
  "Nothing is sent until you queue it.",
].join("\n");

await createTransport().sendMail({
  from: fromAddress(),
  to: process.env.SMTP_USER,
  subject: `HeronScout: ${waiting.length} emails waiting for approval`,
  text,
});
console.log(`Report sent: ${waiting.length} waiting.`);
