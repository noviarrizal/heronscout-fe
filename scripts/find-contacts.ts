// Visit each lead's website (home + contact/about pages) and pull out email, Instagram and Facebook.
// Usage: pnpm find:contacts          new leads only
//        pnpm find:contacts --retry  also re-check leads that were checked before but have no email
import { Resolver } from "node:dns/promises";
import { sql } from "./lib/db";
import { fetchHtml, fetchPage } from "./lib/web";

const CONCURRENCY = 4;
const MAX_EXTRA_PAGES = 3;
const COMMON_CONTACT_PATHS = ["/contact", "/contact-us", "/about", "/about-us"];
const retry = process.argv.includes("--retry");

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}/gi;
const JUNK_EMAIL =
  /\.(png|jpe?g|gif|svg|webp|css|js)$|example\.|sentry|wixpress|wix\.com|domain\.com|mysite\.com|yourname|youremail|email\.com|godaddy|squarespace|@sentry|@2x|ingest\./i;

// Cloudflare "email protection" hides addresses as a hex string XOR'd with its first byte.
function decodeCfEmail(hex: string) {
  const key = parseInt(hex.slice(0, 2), 16);
  let out = "";
  for (let i = 2; i < hex.length; i += 2) out += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16) ^ key);
  return out;
}

// Undo the usual ways sites hide addresses from scrapers, so the email regex can see them.
function revealEmails(html: string) {
  const cloudflare = [...html.matchAll(/(?:data-cfemail="|email-protection#)([0-9a-f]{6,})/gi)]
    .map((m) => decodeCfEmail(m[1]))
    .join(" ");
  const text = html
    .replace(/&#0*64;|&#x0*40;|%40/gi, "@")
    .replace(/&#0*46;|&#x0*2e;/gi, ".")
    .replace(/\s*[[(]\s*at\s*[\])]\s*/gi, "@")
    .replace(/\s*[[(]\s*dot\s*[\])]\s*/gi, ".");
  return `${text} ${cloudflare}`;
}

function pickEmail(found: Set<string>, siteHost: string) {
  const emails = [...found].map((e) => e.toLowerCase()).filter((e) => !JUNK_EMAIL.test(e));
  const root = siteHost.replace(/^www\./, "");
  return emails.find((e) => e.endsWith(`@${root}`)) ?? emails[0] ?? null;
}

// Public resolvers: the system DNS can be a local proxy that refuses MX queries.
const dns = new Resolver({ timeout: 5_000, tries: 2 });
dns.setServers(["1.1.1.1", "8.8.8.8"]);
const mxCache = new Map<string, Promise<boolean>>();

// Bounces hurt sender reputation fast, so drop addresses whose domain can't receive mail.
function canReceiveMail(email: string) {
  const domain = email.split("@")[1];
  if (!mxCache.has(domain)) {
    mxCache.set(
      domain,
      dns.resolveMx(domain).then(
        (records) => records.length > 0,
        (err: { code?: string }) => {
          if (err.code === "ENODATA" || err.code === "ENOTFOUND") return false;
          throw new Error(`MX lookup for ${domain} failed (${err.code}); check your internet/DNS and retry`);
        },
      ),
    );
  }
  return mxCache.get(domain)!;
}

function firstMatch(html: string, re: RegExp) {
  return html.match(re)?.[0] ?? null;
}

async function scanSite(website: string) {
  const base = new URL(website.startsWith("http") ? website : `https://${website}`);
  const home = await fetchPage(base.href);
  if (!home.html) return { email: null, instagram: null, facebook: null, note: `site unreachable: ${home.error}` };

  const linked = [...home.html.matchAll(/href=["']([^"'#]+)["']/gi)]
    .map((m) => m[1])
    .filter((href) => /contact|about|get-in-touch|quote/i.test(href));
  const candidates = new Set<string>();
  for (const href of [...linked, ...COMMON_CONTACT_PATHS]) {
    try {
      const url = new URL(href, base);
      if (url.host === base.host && url.href !== base.href) candidates.add(url.href);
    } catch {
      // malformed href, ignore
    }
  }
  const extra = await Promise.all([...candidates].slice(0, MAX_EXTRA_PAGES).map(fetchHtml));

  const all = revealEmails([home.html, ...extra].join("\n"));
  const emails = new Set([...all.matchAll(EMAIL_RE)].map((m) => m[0]));
  const email = pickEmail(emails, base.host);
  const formOnly = /<form[\s>]/i.test(all);
  return {
    email,
    instagram: firstMatch(all, /https?:\/\/(www\.)?instagram\.com\/[a-z0-9_.]+/i),
    facebook: firstMatch(all, /https?:\/\/(www\.)?facebook\.com\/[a-z0-9_.-]+/i),
    note: email ? "" : `no email on ${1 + extra.filter(Boolean).length} pages${formOnly ? " (contact form only)" : ""}`,
  };
}

const leads = retry
  ? await sql`select id, name, website, email from leads where status = 'new' or (status = 'contacts_checked' and email is null)`
  : await sql`select id, name, website, email from leads where status = 'new'`;
console.log(`Checking ${leads.length} leads...`);

let withEmail = 0;
const reasons = new Map<string, number>();
const queue = [...leads];
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    for (let lead = queue.shift(); lead; lead = queue.shift()) {
      const found = lead.website ? await scanSite(lead.website) : null;
      const candidate = lead.email ?? found?.email ?? null;
      const deliverable = candidate ? await canReceiveMail(candidate) : false;
      const email = deliverable ? candidate : null;
      const note = !lead.website
        ? "no website"
        : candidate && !deliverable
          ? `${candidate} has no mail server`
          : (found?.note ?? "");
      if (email) withEmail++;
      else {
        const key = note.replace(/: .*/, "").replace(/\d+ pages/, "N pages").replace(/^\S+@\S+/, "email");
        reasons.set(key, (reasons.get(key) ?? 0) + 1);
      }
      await sql`
        update leads set
          email = ${email},
          instagram = coalesce(instagram, ${found?.instagram ?? null}),
          facebook = coalesce(facebook, ${found?.facebook ?? null}),
          status = 'contacts_checked',
          updated_at = now()
        where id = ${lead.id}
      `;
      console.log(email ? `✓ ${lead.name} → ${email}` : `· ${lead.name} (${note})`);
    }
  }),
);

console.log(`\nDone. ${withEmail}/${leads.length} leads have an email.`);
for (const [reason, n] of reasons) console.log(`  ${n} × ${reason}`);
