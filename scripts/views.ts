// Who opened their preview after being emailed, how often, how long and how far they scrolled.
// Usage: pnpm views
// Counts come from the beacon on /p/[slug] (run `pnpm db:migrate` once to create preview_views).
// Open any preview once with ?me on each of your own devices so your checks aren't counted.
import { sql } from "./lib/db";

const rows = await sql`
  select l.name, l.email, l.status, p.slug,
    (select min(m.sent_at) from messages m where m.lead_id = l.id and m.step = 1 and m.status = 'sent') as sent_at,
    count(v.id)::int as opens, max(v.opened_at) as last_open,
    coalesce(max(v.seconds), 0)::int as seconds, coalesce(max(v.depth), 0)::int as depth
  from previews p
  join leads l on l.id = p.lead_id
  left join preview_views v on v.slug = p.slug
  where l.status in ('contacted', 'replied', 'won', 'lost')
  group by l.id, p.slug
  order by opens desc, sent_at desc nulls last
`;

const day = (d: string | null) => (d ? new Date(d).toISOString().slice(5, 16).replace("T", " ") : "-          ");
for (const r of rows) {
  const seen = r.opens ? `${r.opens}x, last ${day(r.last_open)}, ${r.seconds}s, ${r.depth}% scrolled` : "not opened";
  console.log(`sent ${day(r.sent_at)}  ${r.name} (${r.status})  ${seen}`);
}
const opened = rows.filter((r) => r.opens > 0).length;
console.log(`${opened} of ${rows.length} emailed leads opened their preview.`);
