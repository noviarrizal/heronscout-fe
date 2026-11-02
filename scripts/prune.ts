// Re-check leads that haven't been emailed yet against the current fit rules (scripts/lib/rules.ts).
// Leads that no longer fit are skipped: their drafts are cancelled and their previews expire.
// Usage: pnpm prune:leads [--dry]
import { sql } from "./lib/db";
import { canEmail, isGoodFit } from "./lib/rules";

const dry = process.argv.includes("--dry");

const leads = await sql`select id, name, category, website, review_count, country_code, company_type from leads where status = 'previewed'`;
const unfit = leads.filter((l) => !(canEmail(l as Parameters<typeof canEmail>[0]) && isGoodFit(l as Parameters<typeof isGoodFit>[0])));

// Logs only show lead ids: Actions logs are public on public repos.
console.log(`${unfit.length} of ${leads.length} unsent leads no longer fit${dry ? " (dry run)" : ""}: ${unfit.map((l) => l.id).join(", ")}`);
if (dry || unfit.length === 0) process.exit(0);

const ids = unfit.map((l) => Number(l.id));
await sql`update messages set status = 'cancelled' where lead_id = any(${ids}) and status in ('draft', 'approved')`;
await sql`update previews set status = 'expired' where lead_id = any(${ids})`;
await sql`update leads set status = 'skipped', updated_at = now() where id = any(${ids})`;
console.log("Skipped.");
