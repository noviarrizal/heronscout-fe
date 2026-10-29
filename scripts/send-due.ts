// Send at most ONE due email per run, so a 15-minute schedule spaces emails out naturally.
// Before sending it reads the inbox: replies stop follow-ups, bounces block the address.
// Usage: pnpm send:due [--dry]    --dry shows what would happen without sending or changing anything.
import { sql } from "./lib/db";
import { createTransport, fromAddress, requireMailConfig, scanInbox } from "./lib/mail";
import { isBusinessHours, leadTimeZone } from "./lib/rules";

const dry = process.argv.includes("--dry");
const DAY = 24 * 3600 * 1000;
const MAX_BOUNCES_PER_DAY = 2;
requireMailConfig();

// 1. Replies and bounces.
const watched = await sql`select id, email from leads where status = 'contacted' and email is not null`;
const scan = await scanInbox(watched.map((l) => l.email as string));
for (const lead of watched) {
  const email = (lead.email as string).toLowerCase();
  const bounced = scan.bouncedRecipients.has(email);
  if (!bounced && !scan.repliedFrom.has(email)) continue;
  // Logs only show lead ids: Actions logs are public on public repos.
  console.log(`${bounced ? "Bounced" : "Replied"}: lead ${lead.id}`);
  if (dry) continue;
  await sql`update messages set status = 'cancelled' where lead_id = ${lead.id} and status in ('draft', 'approved')`;
  await sql`update leads set status = ${bounced ? "bounced" : "replied"}, updated_at = now() where id = ${lead.id}`;
  if (bounced) await sql`insert into suppression (email, reason) values (${email}, 'bounced') on conflict do nothing`;
}

// 2. Safety stop: repeated bounces mean bad addresses, and Gmail punishes that fast.
const [{ n: recentBounces }] = await sql`select count(*)::int as n from leads where status = 'bounced' and updated_at > now() - interval '1 day'`;
if (recentBounces >= MAX_BOUNCES_PER_DAY) {
  console.log(`Stopped: ${recentBounces} bounces in the last 24h. Check the addresses before sending more.`);
  process.exit(0);
}

// 3. Daily cap, ramping up from the first email ever sent: 5/day, then 8, then 10.
const [{ first }] = await sql`select min(sent_at) as first from messages where status = 'sent'`;
const days = first ? Math.floor((Date.now() - new Date(first).getTime()) / DAY) : 0;
const cap = Math.min(days < 7 ? 5 : days < 14 ? 8 : 10, Number(process.env.MAX_PER_DAY ?? 10));
const [{ n: sentToday }] = await sql`select count(*)::int as n from messages where status = 'sent' and sent_at > now() - interval '1 day'`;
if (sentToday >= cap) {
  console.log(`Daily cap reached (${sentToday}/${cap}).`);
  process.exit(0);
}

// 4. Next due message whose recipient is in business hours. Follow-ups go before new first emails.
const due = await sql`
  select m.id, m.lead_id, m.step, m.subject, m.body, l.email, l.name, l.city, l.country_code,
    (select first.message_id from messages first where first.lead_id = m.lead_id and first.step = 1) as thread_id
  from messages m join leads l on l.id = m.lead_id
  where m.status = 'approved' and m.send_at <= now()
    and l.status in ('previewed', 'contacted')
    and not exists (select 1 from suppression s where s.email = lower(l.email))
  order by m.step desc, m.send_at
`;
const next = due.find((m) => isBusinessHours(leadTimeZone(m as { city: string | null; country_code: string | null })));
if (!next) {
  console.log(due.length ? `${due.length} due, none in business hours right now.` : "Nothing due.");
  process.exit(0);
}

console.log(`${dry ? "Would send" : "Sending"} step ${next.step} to lead ${next.lead_id} (${sentToday + 1}/${cap} today)`);
if (dry) process.exit(0);

const info = await createTransport().sendMail({
  from: fromAddress(),
  to: next.email,
  subject: next.subject,
  text: next.body,
  ...(next.step > 1 && next.thread_id ? { inReplyTo: next.thread_id, references: next.thread_id } : {}),
});

await sql`update messages set status = 'sent', sent_at = now(), message_id = ${info.messageId} where id = ${next.id}`;
if (next.step === 1) {
  await sql`update leads set status = 'contacted', updated_at = now() where id = ${next.lead_id}`;
  await sql`update messages set status = 'approved', send_at = now() + interval '4 days' where lead_id = ${next.lead_id} and step = 2 and status = 'draft'`;
  await sql`update messages set status = 'approved', send_at = now() + interval '11 days' where lead_id = ${next.lead_id} and step = 3 and status = 'draft'`;
}
console.log("Sent.");
