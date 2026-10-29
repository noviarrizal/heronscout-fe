// Record what happened with a lead while emails are sent by hand.
// Usage: pnpm lead sent <email>      first email went out (follow-ups get scheduled for day 4 and day 11)
//        pnpm lead replied <email>   they answered: stop all follow-ups
//        pnpm lead no <email>        they said no: stop everything and never email again
//        pnpm lead won <email>       they paid
import { sql } from "./lib/db";

const [action, email] = process.argv.slice(2);
const actions = ["sent", "replied", "no", "won"];
if (!actions.includes(action) || !email?.includes("@")) {
  console.error(`Usage: pnpm lead <${actions.join("|")}> <email>`);
  process.exit(1);
}

const [lead] = await sql`select id, name from leads where lower(email) = lower(${email})`;
if (!lead) {
  console.error(`No lead with email ${email}.`);
  process.exit(1);
}

switch (action) {
  case "sent":
    await sql`update messages set status = 'sent', sent_at = now() where lead_id = ${lead.id} and step = 1`;
    await sql`update messages set status = 'approved', send_at = now() + interval '4 days' where lead_id = ${lead.id} and step = 2 and status = 'draft'`;
    await sql`update messages set status = 'approved', send_at = now() + interval '11 days' where lead_id = ${lead.id} and step = 3 and status = 'draft'`;
    await sql`update leads set status = 'contacted', updated_at = now() where id = ${lead.id}`;
    break;
  case "replied":
  case "won":
  case "no":
    await sql`update messages set status = 'cancelled' where lead_id = ${lead.id} and status in ('draft', 'approved')`;
    await sql`update leads set status = ${action === "no" ? "lost" : action}, updated_at = now() where id = ${lead.id}`;
    if (action === "no") {
      await sql`insert into suppression (email, reason) values (lower(${email}), 'replied no') on conflict do nothing`;
    }
    break;
}

console.log(`${lead.name}: ${action}.`);

// Follow-ups due today, so they can be sent by hand until the automatic sender exists.
const due = await sql`
  select l.name, l.email, m.step, m.subject from messages m join leads l on l.id = m.lead_id
  where m.status = 'approved' and m.send_at <= now() order by m.send_at
`;
if (due.length) {
  console.log(`\nFollow-ups due now:`);
  for (const d of due) console.log(`  step ${d.step}  ${d.email}  "${d.subject}"`);
}
