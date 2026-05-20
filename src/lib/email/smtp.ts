import nodemailer from "nodemailer";

export type SmtpConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
  fromName: string;
  /** Optional reply-to address — defaults to the from address if not set */
  replyTo?: string;
};

export type SendResult =
  | { ok: true; messageId: string }
  | { ok: false; error: string };

export function inferSmtpHost(email: string): { host: string; port: number } {
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  if (domain === "gmail.com" || domain === "googlemail.com") {
    return { host: "smtp.gmail.com", port: 587 };
  }
  if (
    domain === "outlook.com" ||
    domain === "hotmail.com" ||
    domain === "live.com" ||
    domain === "msn.com"
  ) {
    return { host: "smtp-mail.outlook.com", port: 587 };
  }
  // Office 365 custom domains
  if (domain.endsWith(".onmicrosoft.com")) {
    return { host: "smtp.office365.com", port: 587 };
  }
  // Generic fallback — user can override in settings
  return { host: `smtp.${domain}`, port: 587 };
}

function createTransport(config: SmtpConfig) {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: false, // STARTTLS
    auth: { user: config.user, pass: config.password },
    tls: { rejectUnauthorized: true },
  });
}

export async function testSmtpConnection(
  config: SmtpConfig,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const transport = createTransport(config);
    await transport.verify();
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Connection failed",
    };
  }
}

export async function sendEmail(
  config: SmtpConfig,
  to: string,
  subject: string,
  bodyHtml: string,
  bodyText: string,
): Promise<SendResult> {
  try {
    const transport = createTransport(config);
    const info = await transport.sendMail({
      from: `"${config.fromName}" <${config.user}>`,
      to,
      subject,
      html: bodyHtml,
      text: bodyText,
      replyTo: config.replyTo ?? config.user,
    });
    return { ok: true, messageId: info.messageId };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Send failed",
    };
  }
}
