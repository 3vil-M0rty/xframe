const nodemailer = require("nodemailer");
const EmailOutbox = require("../models/EmailOutbox");

/**
 * ============================================================
 * EMAIL — with a safe placeholder mode
 * ============================================================
 * Configure these in backend/.env to send for real:
 *   SMTP_HOST=smtp.gmail.com      SMTP_PORT=465 (or 587)
 *   SMTP_USER=...                 SMTP_PASS=...  (app password)
 *   SMTP_SECURE=true              (true for 465, false for 587)
 *   MAIL_FROM="Atlas Industries <achats@atlas.ma>"
 *
 * Until SMTP_HOST is set, NOTHING is sent: each message is recorded in
 * the EmailOutbox collection with status "simulated", and the API
 * reports `simulated: true` so the UI can say so. Nothing fails.
 * Every real send is recorded in the outbox too (sent / failed).
 * ============================================================
 */

let transporter = null;
const isConfigured = () => !!process.env.SMTP_HOST;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: String(process.env.SMTP_SECURE || "").toLowerCase() === "true",
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
  }
  return transporter;
}

const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || "").trim());

/**
 * attachments: [{ filename, content: Buffer, contentType }]
 * meta: { company, relatedType, relatedId, sentBy }
 * Returns { status: "sent" | "simulated", outboxId }. Throws on a
 * real sending failure (after recording it as "failed").
 */
async function sendMail({ to, cc, subject, text, attachments = [] }, meta = {}) {
  const record = {
    company: meta.company || null,
    to,
    cc: cc || undefined,
    subject,
    text,
    attachments: attachments.map((a) => ({ filename: a.filename, size: a.content ? a.content.length : 0 })),
    relatedType: meta.relatedType,
    relatedId: meta.relatedId,
    sentBy: meta.sentBy,
  };

  if (!isConfigured()) {
    const saved = await EmailOutbox.create({ ...record, status: "simulated" });
    console.log(`[mail] SIMULATED (no SMTP configured) -> ${to} | ${subject} | ${attachments.map((a) => a.filename).join(", ")}`);
    return { status: "simulated", outboxId: saved._id };
  }

  try {
    await getTransporter().sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to,
      cc: cc || undefined,
      subject,
      text,
      attachments,
    });
    const saved = await EmailOutbox.create({ ...record, status: "sent" });
    return { status: "sent", outboxId: saved._id };
  } catch (error) {
    await EmailOutbox.create({ ...record, status: "failed", error: error.message }).catch(() => {});
    throw error;
  }
}

/** Collects a pdfkit document into a Buffer (for attachments). */
function pdfToBuffer(doc) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });
}

module.exports = { sendMail, pdfToBuffer, isEmail, isConfigured };
