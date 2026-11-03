// Leads without a website: look for an email they published elsewhere. Small trades often list a Gmail
// on their Facebook page, Yelp or BBB, and Google shows it in the result snippet, so one Google search
// per lead ("Name" City email) finds many of them. All leads go in one Apify run (~$0.0045 per search).
import { runActor } from "./apify";

const ACTOR = "apify~google-search-scraper";
const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}/gi;
const FREEMAIL = /@(gmail|yahoo|ymail|outlook|hotmail|aol|icloud|me|live|msn|comcast|att|verizon|sbcglobal|bellsouth|cox)\./i;
// Words most trade names share; matching only on the rest keeps "Pro Plumbing LLC" from claiming
// someone else's address.
const GENERIC = new Set(
  "the and of llc inc co company corp services service pro pros plumbing plumber plumbers heating cooling air hvac conditioning mechanical painting painters painter contractors contractor contracting home homes repair repairs solutions group local family brothers sons".split(
    " ",
  ),
);

type Result = { title?: string; description?: string; url?: string };
type Page = { searchQuery?: { term?: string }; organicResults?: Result[] };
export type Found = { email: string | null; facebook: string | null };

// Distinctive words of a business name, e.g. "Mazowski Mechanical LLC" -> ["mazowski"].
export function nameTokens(name: string) {
  return name
    .toLowerCase()
    .replace(/&/g, " ")
    .split(/[^a-z0-9]+/)
    // Five letters or more: a first name like "mike" would match too many strangers' Gmails.
    .filter((w) => w.length >= 5 && !GENERIC.has(w));
}

// An address counts only if it belongs to this business: the result mentions the name, and the address
// itself carries a distinctive word of it (a Gmail like mazowskimechanical@ or a domain like mazowski.com).
export function pickEmail(name: string, results: Result[]) {
  const tokens = nameTokens(name);
  if (!tokens.length) return null;
  for (const r of results) {
    const text = `${r.title ?? ""} ${r.description ?? ""}`;
    if (!tokens.some((t) => text.toLowerCase().includes(t))) continue;
    for (const raw of text.match(EMAIL_RE) ?? []) {
      const email = raw.toLowerCase().replace(/\.$/, "");
      const [local, domain] = email.split("@");
      const owned = FREEMAIL.test(email) ? local : domain;
      if (tokens.some((t) => owned.replace(/[^a-z0-9]/g, "").includes(t))) return email;
    }
  }
  return null;
}

export async function searchEmails(leads: { id: string | number; name: string; city: string | null }[]) {
  const found = new Map<string | number, Found>();
  const searchable = leads.filter((l) => nameTokens(l.name).length);
  if (!searchable.length) return found;
  const query = (l: (typeof leads)[number]) => `"${l.name}" ${l.city ?? ""} email`.replace(/\s+/g, " ").trim();
  const { items: pages } = await runActor<Page>(
    ACTOR,
    {
      queries: searchable.map(query).join("\n"),
      maxPagesPerQuery: 1,
      countryCode: "us",
      saveHtmlToKeyValueStore: false,
    },
    Math.max(0.05, searchable.length * 0.006),
  );
  const key = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  const byTerm = new Map((pages ?? []).map((p) => [key(p.searchQuery?.term ?? ""), p.organicResults ?? []]));
  for (const lead of searchable) {
    const results = byTerm.get(key(query(lead))) ?? [];
    const facebook =
      results.find((r) => /facebook\.com\/(?!sharer|login)/i.test(r.url ?? "") && nameTokens(lead.name).some((t) => (r.title ?? "").toLowerCase().includes(t)))
        ?.url ?? null;
    found.set(lead.id, { email: pickEmail(lead.name, results), facebook });
  }
  return found;
}
