// Email yourself the week's drafts, so the batch can be checked (and bad ones stopped) from a phone.
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
  `${waiting.length} first emails are drafted. They go out automatically, best leads first, a few per weekday:`,
  "",
  ...lines,
  "",
  "To keep one from going out: `pnpm lead no <email>`.",
  "To pause all new first emails: GitHub > Settings > Secrets and variables > Actions > Variables, set AUTO_QUEUE to off.",
].join("\n");

await createTransport().sendMail({
  from: fromAddress(),
  to: process.env.SMTP_USER,
  subject: `HeronScout: ${waiting.length} emails lined up this week`,
  text,
});
console.log(`Report sent: ${waiting.length} waiting.`);
