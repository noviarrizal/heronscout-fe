import "dotenv/config";
import { ImapFlow } from "imapflow";
import nodemailer from "nodemailer";

const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SENDER_NAME } = process.env;

export function requireMailConfig() {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !SENDER_NAME) {
    console.error("SMTP_HOST, SMTP_USER, SMTP_PASS and SENDER_NAME must be set in .env.");
    process.exit(1);
  }
}

export function createTransport() {
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT ?? 587),
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

export const fromAddress = () => `"${SENDER_NAME}" <${SMTP_USER}>`;

// Gmail's IMAP host mirrors its SMTP host (smtp.gmail.com -> imap.gmail.com).
function imapHost() {
  return process.env.IMAP_HOST ?? SMTP_HOST!.replace(/^smtp\./, "imap.");
}

export type InboxScan = { repliedFrom: Set<string>; bouncedRecipients: Set<string> };

// Reads the last 30 days of the inbox: who wrote back, and which of our recipients bounced.
export async function scanInbox(watchedEmails: string[]): Promise<InboxScan> {
  const watched = new Set(watchedEmails.map((e) => e.toLowerCase()));
  const result: InboxScan = { repliedFrom: new Set(), bouncedRecipients: new Set() };
  if (watched.size === 0) return result;

  const client = new ImapFlow({ host: imapHost(), port: 993, secure: true, auth: { user: SMTP_USER!, pass: SMTP_PASS! }, logger: false });
  await client.connect();
  const lock = await client.getMailboxLock("INBOX");
  try {
    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000);
    const uids = await client.search({ since }, { uid: true });
    if (!uids || uids.length === 0) return result;
    for await (const msg of client.fetch(uids, { envelope: true, source: { maxLength: 20_000 } }, { uid: true })) {
      const from = msg.envelope?.from?.[0]?.address?.toLowerCase() ?? "";
      if (watched.has(from)) result.repliedFrom.add(from);
      if (/mailer-daemon|postmaster/.test(from) && msg.source) {
        const text = msg.source.toString("utf8").toLowerCase();
        for (const email of watched) if (text.includes(email)) result.bouncedRecipients.add(email);
      }
    }
  } finally {
    lock.release();
    await client.logout();
  }
  return result;
}
