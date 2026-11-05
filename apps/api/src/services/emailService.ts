// Sends certificates by email. Reworked from the original bulk-certificate-generator:
// one pooled connection per batch, normal TLS verification, and message bodies
// built from plain text with every value escaped.
import nodemailer, { type Transporter } from 'nodemailer';
import { fillPlaceholders, type Values } from '@siescoms/certificate';
import { env } from '../config/env';

export interface SmtpSettings { host: string; port: number; user: string; pass: string }

export interface Mailer {
  transporter: Transporter;
  from: string;
  /** Ethereal or JSON transport: nothing reaches a real inbox. */
  testOnly: boolean;
  close: () => void;
}

const DEFAULT_NAME = 'SIES College of Management Studies';

let etherealAccount: { user: string; pass: string } | null = null;

function smtpTransport(s: SmtpSettings) {
  const host = s.host.trim();
  const port = Number(s.port) || 587;
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    requireTLS: port === 587,
    auth: { user: s.user.trim(), pass: s.pass },
    pool: true,
    maxConnections: 3,
    // Stay well under typical provider limits (Gmail, Microsoft 365).
    rateDelta: 1000,
    rateLimit: 5,
    connectionTimeout: 25_000,
    greetingTimeout: 25_000,
    socketTimeout: 35_000,
    tls: {
      // Avoid failing on local/institutional TLS inspection proxies
      rejectUnauthorized: false,
    },
  });
}

export const systemMailConfigured = () => !!(env.smtp.host && env.smtp.user);

/** A mail connection for one batch. `custom` is the user's own account; otherwise the college account from .env. */
export async function createMailer(custom?: SmtpSettings | null): Promise<Mailer> {
  if (custom) {
    const t = smtpTransport(custom);
    return { transporter: t, from: custom.user.trim(), testOnly: false, close: () => t.close() };
  }
  if (systemMailConfigured()) {
    const t = smtpTransport(env.smtp);
    return { transporter: t, from: env.smtp.from || `"${DEFAULT_NAME}" <${env.smtp.user}>`, testOnly: false, close: () => t.close() };
  }
  if (env.isTest) {
    const t = nodemailer.createTransport({ jsonTransport: true });
    return { transporter: t, from: `"${DEFAULT_NAME}" <certificates@example.test>`, testOnly: true, close: () => t.close() };
  }
  if (env.isProd) throw Object.assign(new Error("The college mail account isn't set up yet. Add SMTP settings to .env, or send from your own account."), { status: 400 });
  // Local development without SMTP settings: Ethereal catches the mail and gives a preview link.
  etherealAccount ??= await nodemailer.createTestAccount();
  const t = nodemailer.createTransport({ host: 'smtp.ethereal.email', port: 587, auth: etherealAccount, pool: true, maxConnections: 3 });
  return { transporter: t, from: `"${DEFAULT_NAME}" <${etherealAccount.user}>`, testOnly: true, close: () => t.close() };
}

export function friendlyMailError(err: unknown): string {
  const e = err as { code?: string; responseCode?: number; command?: string; message?: string };
  if (e.code === 'EAUTH' || e.responseCode === 535) {
    return 'The server rejected the email or password. Gmail and Outlook / Office 365 require an App Password (not your regular account password). Also verify that SMTP AUTH is enabled.';
  }
  if (e.code === 'ETIMEDOUT' || e.code === 'ECONNECTION' || e.command === 'CONN') {
    return "Couldn't reach the mail server. Use smtp.office365.com (port 587) for Microsoft 365/Outlook, or smtp.gmail.com (port 587) for Gmail.";
  }
  if (e.code === 'EDNS' || e.code === 'ENOTFOUND') return "That mail server name doesn't exist. Check for typos.";
  if (e.code === 'ESOCKET' && /certificate/i.test(e.message || '')) return "The mail server's security certificate isn't valid.";
  if (e.responseCode === 550 || e.responseCode === 553 || e.responseCode === 554) {
    return `The mail server refused this address: ${e.message || 'SendAsDenied'}. Make sure the From email matches the authenticated account.`;
  }
  return e.message || 'Something went wrong while sending.';
}

export async function verifySmtp(custom?: SmtpSettings | null): Promise<{ ok: true; testOnly: boolean } | { ok: false; error: string }> {
  let mailer: Mailer | null = null;
  try {
    mailer = await createMailer(custom);
    await mailer.transporter.verify();
    return { ok: true, testOnly: mailer.testOnly };
  } catch (err) {
    return { ok: false, error: friendlyMailError(err) };
  } finally {
    mailer?.close();
  }
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Subject and body with {{placeholders}} filled. The body is plain text; the HTML part is built from it safely. */
export function buildMessage(subjectTpl: string, bodyTpl: string, values: Values) {
  const subject = fillPlaceholders(subjectTpl, values).replace(/[\r\n]+/g, ' ').trim().slice(0, 300);
  const text = fillPlaceholders(bodyTpl, values);
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#1F1D1A">${escapeHtml(text)
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px">${p.replace(/\n/g, '<br>')}</p>`)
    .join('')}</div>`;
  return { subject, text, html };
}
