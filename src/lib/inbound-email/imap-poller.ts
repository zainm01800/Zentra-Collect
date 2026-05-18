/**
 * IMAP poller — connects to a Gmail/Outlook inbox using stored credentials
 * and fetches unseen emails since the last poll UID.
 *
 * Uses imapflow (modern IMAP client with built-in TypeScript support).
 * Only reads email — never sends, deletes, or modifies anything.
 */

import { ImapFlow } from "imapflow";
import { decryptPassword } from "@/lib/email/crypto";

export interface ImapConfig {
  email: string;
  passwordEnc: string; // AES-256-GCM encrypted app password
  host: string;
  port: number;
  tls: boolean;
  lastUid: number; // highest UID already processed
}

export interface FetchedEmail {
  uid: number;
  fromEmail: string;
  fromName: string;
  subject: string;
  bodyText: string;
  receivedAt: Date;
}

export interface PollResult {
  emails: FetchedEmail[];
  highestUid: number; // save this back to DB after processing
}

/**
 * Infers the IMAP host from the email domain.
 * Covers Gmail and common Microsoft domains; falls back to generic IMAP.
 */
export function inferImapHost(email: string): { host: string; port: number; tls: boolean } {
  const domain = email.split("@")[1]?.toLowerCase() ?? "";

  if (domain === "gmail.com" || domain === "googlemail.com") {
    return { host: "imap.gmail.com", port: 993, tls: true };
  }
  if (
    domain === "outlook.com" ||
    domain === "hotmail.com" ||
    domain === "live.com" ||
    domain === "msn.com"
  ) {
    return { host: "outlook.office365.com", port: 993, tls: true };
  }
  if (domain.endsWith(".onmicrosoft.com")) {
    return { host: "outlook.office365.com", port: 993, tls: true };
  }

  // Generic fallback
  return { host: `imap.${domain}`, port: 993, tls: true };
}

/**
 * Connects to the IMAP inbox, fetches emails with UID > lastUid,
 * and returns their parsed content. Disconnects cleanly on completion.
 *
 * Fetches up to 50 emails per poll to keep latency predictable.
 */
export async function pollImapInbox(config: ImapConfig): Promise<PollResult> {
  const password = decryptPassword(config.passwordEnc);
  if (!password) throw new Error("Could not decrypt IMAP password.");

  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.tls,
    auth: { user: config.email, pass: password },
    logger: false, // suppress verbose imapflow logs in production
  });

  await client.connect();

  const emails: FetchedEmail[] = [];
  let highestUid = config.lastUid;

  try {
    const lock = await client.getMailboxLock("INBOX");
    try {
      // Fetch messages with UID greater than last seen
      const searchCriteria = config.lastUid > 0
        ? { uid: `${config.lastUid + 1}:*` }
        : { seen: false }; // first poll: fetch unread only

      for await (const msg of client.fetch(searchCriteria, {
        uid: true,
        envelope: true,
        bodyStructure: true,
        source: true,
      })) {
        if (!msg.uid || msg.uid <= config.lastUid) continue;

        const envelope = msg.envelope;
        const from = envelope?.from?.[0];
        const fromEmail = from?.address ?? "";
        const fromName = from?.name ?? from?.address ?? "";
        const subject = envelope?.subject ?? "";

        // Extract plain-text body from raw source
        const rawSource = msg.source?.toString("utf8") ?? "";
        const bodyText = extractPlainText(rawSource);

        if (fromEmail && bodyText.trim().length > 0) {
          emails.push({
            uid: msg.uid,
            fromEmail,
            fromName,
            subject,
            bodyText,
            receivedAt: envelope?.date ?? new Date(),
          });
        }

        if (msg.uid > highestUid) highestUid = msg.uid;

        // Cap at 50 per poll cycle
        if (emails.length >= 50) break;
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }

  return { emails, highestUid };
}

/**
 * Extracts readable plain text from a raw RFC 2822 email.
 * Strips headers, quoted text (lines starting with >), and HTML tags.
 * Returns at most 2000 chars — enough for classification, not excessive.
 */
function extractPlainText(raw: string): string {
  // Split headers from body at the first blank line
  const headerBodySplit = raw.indexOf("\r\n\r\n");
  const body = headerBodySplit >= 0 ? raw.slice(headerBodySplit + 4) : raw;

  // Strip HTML tags if present
  const stripped = body.replace(/<[^>]+>/g, " ");

  // Remove quoted lines (start with >) and lines that are just dashes/whitespace
  const lines = stripped
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith(">"))
    .filter((line) => !/^[-_=]{3,}$/.test(line.trim()));

  return lines.join("\n").replace(/\s{3,}/g, "\n\n").trim().slice(0, 2000);
}
