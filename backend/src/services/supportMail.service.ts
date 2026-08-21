import nodemailer from "nodemailer";

export async function sendSupportMail(input: { request_users?: string; subject?: string; message?: string; htmlMessage?: string }) {
  if (!input.request_users || !process.env.SMTP_HOST) return;
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
  });
  await transport.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to: input.request_users, subject: input.subject || "Support notification", text: input.message, html: input.htmlMessage });
}
