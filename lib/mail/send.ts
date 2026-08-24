import nodemailer from 'nodemailer';

/**
 * Plain nodemailer/SMTP sending — same transport shape and env-var naming as the customer-sites
 * monorepo's own pattern (`apps/southswell/api/contact`), as a proper shared function here rather
 * than copy-pasted per call site. No template engine: callers hand-build text + HTML bodies, same
 * as that reference.
 */

export type MailMessage = {
  subject: string;
  text: string;
  html: string;
  /** Lets a reply land straight in the customer's inbox instead of the transport account's. */
  replyTo?: string;
};

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Sends one email via the configured SMTP transport. Returns `{ sent: false, reason }` rather than
 * throwing when SMTP isn't configured or the send fails — callers (order notifications) shouldn't
 * let a mail hiccup block whatever already succeeded, like a saved reservation.
 */
export async function sendMail(message: MailMessage): Promise<{ sent: boolean; reason?: string }> {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || '587');
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secure = process.env.SMTP_SECURE === 'true';
  const to = process.env.ORDER_NOTIFY_TO;
  const from = process.env.ORDER_NOTIFY_FROM || 'no-reply@shift-green-fresh.local';

  if (!host || !user || !pass || !to) {
    return { sent: false, reason: 'SMTP is not configured (SMTP_HOST/USER/PASS/ORDER_NOTIFY_TO).' };
  }

  const transporter = nodemailer.createTransport({ host, port, secure, auth: { user, pass } });

  try {
    await transporter.sendMail({
      from,
      to,
      ...(message.replyTo ? { replyTo: message.replyTo } : {}),
      subject: message.subject,
      text: message.text,
      html: message.html
    });
    return { sent: true };
  } catch (err) {
    return { sent: false, reason: err instanceof Error ? err.message : String(err) };
  }
}
