import nodemailer, { Transporter } from "nodemailer";

interface SendEmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  const host = process.env.SMTP_HOST;
  if (!host) {
    return null;
  }
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT) || 587,
      auth: process.env.SMTP_USER
        ? {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          }
        : undefined,
    });
  }
  return transporter;
}

export async function sendEmail(options: SendEmailOptions): Promise<void> {
  const t = getTransporter();

  if (!t) {
    // Without SMTP, development logs the message so links can be followed
    // locally. Production never logs the body: it can hold a password-reset
    // link, and anyone with log access could use it to take over the account.
    if (process.env.NODE_ENV === "production") {
      console.warn(`[email] SMTP not configured; skipped "${options.subject}"`);
    } else {
      console.log("[email] (no SMTP configured) would send:", {
        to: options.to,
        subject: options.subject,
        text: options.text,
      });
    }
    return;
  }

  await t.sendMail({
    from: process.env.SMTP_FROM || "The Arena <no-reply@thearena.local>",
    to: options.to,
    subject: options.subject,
    text: options.text,
    html: options.html,
  });
}
