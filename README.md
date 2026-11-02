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
| 5. Write first email + 2 follow-ups (LLM), export `outbox/<date>.md` | `pnpm draft:emails 10` | done |
| 6. Track manual sends and replies | `pnpm lead sent\|replied\|no\|won <email>` | done |
| 7. Re-check unsent leads against the fit rules (franchises, non-trades, < 5 reviews) | `pnpm prune:leads [--dry]` | done |
| 8. Optionally push specific first emails ahead of the automatic pick | `pnpm queue 5`, `pnpm queue list` | done |
| 9. Send one due email per run (3 → 5 → 8 → 10/day, 45-120 min apart, recipient's weekday 8am-5pm, stops on reply/bounce); when nothing approved is due it picks the best drafted first email itself | `pnpm send:due [--dry]`, scheduled by `.github/workflows/send-due.yml` | done |

## Automation

| Workflow | When | What |
|---|---|---|
| `weekly.yml` | Mondays 01:00 UTC, or by hand | `scrape` next 2 cities from `config/cities.json` → `find:contacts` → `build:previews` → `draft:emails` → `prune:leads` → `report` (emails you the week's drafts) |
| `queue.yml` | By hand, optional | Approves the next N first emails ahead of the automatic pick |
| `send-due.yml` | Every 15 min, US weekday hours | Sends one email if the cap and spacing allow. Set repository variable `AUTO_QUEUE=off` to only send queued ones |

Weekly and queue read secrets from the `env` environment. Send-due reads repository secrets.

GitHub Actions secrets needed for sending: `DATABASE_URL`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` (Gmail app password), `SENDER_NAME`.

Reply templates and the offer: `docs/reply-templates.md`.

## Shorts

`pnpm shorts <demo-slug> [--music track.mp3]` records a ~29 s vertical before/after video
(1080x1920) to `out/shorts/<slug>.mp4`: hook card, a dated "before" site, the preview scrolling
with a caption per section, closing card. Run `pnpm dev` first (or pass `--base <url>`); needs
Edge or Chrome and ffmpeg (`FFMPEG_PATH` if not on PATH).

Only `fixtures/previews/demo-*.json` work: those are fictional businesses. Real leads' previews
use their names and Google photos, so never publish them. Override any line with a `"short"`
object in the fixture (`title`, `before`, `outroCta`, `labels`, ...; see `scripts/lib/shorts-pages.ts`).

The site spec contract lives in `src/lib/spec.ts`. The LLM picks sections, variants, palette,
fonts and copy; code renders them, so previews vary without ever breaking.

Deploy: Vercel, connected to this repo. The email sender runs on a GitHub Actions schedule, not Vercel Cron. Previews are `noindex` and carry a "free preview" banner.
