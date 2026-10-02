const mongoose = require("mongoose");

/**
 * Every email the app sends (or would send). While SMTP isn't
 * configured, messages are only recorded here with status "simulated"
 * — nothing fails, and you can see exactly what would have gone out.
 * See services/mailService.js.
 */
const emailOutboxSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", default: null, index: true },
    // Client this entry belongs to (set automatically — see services/tenantScope.js).
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", default: null, index: true },
    to: { type: String, required: true },
    cc: String,
    subject: { type: String, required: true },
    text: String,
    attachments: [{ filename: String, size: Number }],
    status: { type: String, enum: ["sent", "simulated", "failed"], required: true },
    error: String,
    relatedType: String, // "PurchaseOrder" | "PriceRequest"
    relatedId: { type: mongoose.Schema.Types.ObjectId },
    sentBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("EmailOutbox", emailOutboxSchema);
