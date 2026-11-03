import { neon } from "@neondatabase/serverless";

// Visit beacon from ViewTracker on /p/[slug]. Only slugs stored in the database count, so demo
// fixtures, local runs without DATABASE_URL and `pnpm shorts` recordings never add rows.
const BOT = /bot|crawl|spider|preview|scan|headless|python|curl|wget|facebookexternalhit/i;

export async function POST(request: Request) {
  const ok = new Response(null, { status: 204 });
  if (!process.env.DATABASE_URL) return ok;

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(await request.text());
  } catch {
    return new Response(null, { status: 400 });
  }
  const { id, slug } = body;
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id) || typeof slug !== "string" || !/^[a-z0-9-]+$/.test(slug)) {
    return new Response(null, { status: 400 });
  }
  const userAgent = request.headers.get("user-agent")?.slice(0, 300) ?? "";
  if (BOT.test(userAgent)) return ok;
  const clamp = (v: unknown, max: number) => Math.min(max, Math.max(0, Math.round(Number(v) || 0)));
  const seconds = clamp(body.seconds, 3600);
  const depth = clamp(body.depth, 100);

  const sql = neon(process.env.DATABASE_URL);
  try {
    await sql`
      insert into preview_views (id, slug, seconds, depth, user_agent)
      select ${id}, ${slug}, ${seconds}, ${depth}, ${userAgent}
      where exists (select 1 from previews where slug = ${slug})
      on conflict (id) do update
        set seconds = greatest(preview_views.seconds, excluded.seconds),
            depth = greatest(preview_views.depth, excluded.depth)
    `;
  } catch (err) {
    // Usually preview_views doesn't exist yet: run `pnpm db:migrate`. The visitor never notices.
    console.error("preview view not saved:", (err as Error).message);
  }
  return ok;
}
