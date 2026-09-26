const mongoose = require("mongoose");

/**
 * ============================================================
 * TENANT (client)
 * ============================================================
 * One paying client of the platform. A client owns one or more
 * companies (Company.tenant) and user accounts (User.tenant); every
 * business record is tied to one of those companies. Isolation
 * between clients is enforced centrally by services/tenantScope.js.
 *
 * status "suspended" blocks every login and API call of the client's
 * users without deleting anything.
 * ============================================================
 */
const tenantSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, "Client name is required"], trim: true, maxlength: 150 },
    status: { type: String, enum: ["active", "suspended"], default: "active", index: true },
    notes: { type: String, trim: true, maxlength: 1000 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Tenant", tenantSchema);
