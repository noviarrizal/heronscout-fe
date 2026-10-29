// Approve the next N first emails for automatic sending. Nothing is sent without being queued here.
// Usage: pnpm queue 5          queue the 5 leads with the most reviews
//        pnpm queue list       show what's queued and due
import { sql } from "./lib/db";

const arg = process.argv[2];

if (arg === "list") {
  const rows = await sql`
    select l.name, l.email, m.step, m.status, m.send_at from messages m join leads l on l.id = m.lead_id
    where m.status = 'approved' order by m.send_at
  `;
  for (const r of rows) console.log(`step ${r.step}  ${new Date(r.send_at).toISOString().slice(0, 16)}  ${r.name} <${r.email}>`);
  console.log(`${rows.length} approved.`);
  process.exit(0);
}

const count = Number(arg);
if (!Number.isInteger(count) || count < 1) {
  console.error("Usage: pnpm queue <count> | pnpm queue list");
  process.exit(1);
}

const queued = await sql`
  update messages m set status = 'approved', send_at = now()
  where m.id in (
    select m2.id from messages m2 join leads l on l.id = m2.lead_id
    where m2.step = 1 and m2.status = 'draft' and l.status = 'previewed'
      and not exists (select 1 from suppression s where s.email = lower(l.email))
    order by l.review_count desc nulls last
    limit ${count}
  )
  returning m.lead_id
`;
console.log(`Queued ${queued.length} first emails. They go out one at a time via pnpm send:due.`);
