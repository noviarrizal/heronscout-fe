# heronscout-fe

Outreach pipeline for selling websites to trades: scrape leads, find contacts, research, render a
non-template preview per lead at `/p/[slug]`, then send plain personal emails.

## Setup

```bash
pnpm install
cp .env.example .env   # fill DATABASE_URL (Neon), LLM_*, SMTP_*
pnpm db:migrate
pnpm dev               # http://localhost:3000/p/demo-dallas-painter
```

Without `DATABASE_URL`, previews are read from `fixtures/previews/<slug>.json`.

## Pipeline

| Step | Command | Status |
|---|---|---|
| 1. Import Google Maps Scraper export | `pnpm import:apify data/<file>.json` | done |
| 2. Find email / Instagram / Facebook on each website | `pnpm find:contacts` | done |
| 3. Research lead + competitors, write site spec (LLM) | `pnpm build:previews 10` (add `--dry` to write to `fixtures/` instead) | done |
| 4. Render preview (`src/components/site`) + screenshot QA | renderer done, QA next | |
| 5. Write emails, schedule, send via SMTP, stop on reply | – | later |

The site spec contract lives in `src/lib/spec.ts`. The LLM picks sections, variants, palette,
fonts and copy; code renders them, so previews vary without ever breaking.

Deploy: Vercel, connected to this repo. The email sender runs on a GitHub Actions schedule, not Vercel Cron. Previews are `noindex` and carry a "free preview" banner.
