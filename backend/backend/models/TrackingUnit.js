// Must load before the schema is compiled — registers the client-isolation plugin.
require("../services/tenantScope");
const mongoose = require("mongoose");

/**
 * ============================================================
 * TRACKING UNIT (suivi châssis) — ONE physical chassis of a project
 * ============================================================
 * A project ouvrage "F1 × 4" gives four units F1-1 … F1-4. Each unit
 * is split into deliverable PARTS (from its model's `deliveryParts`,
 * editable per unit): frame, sashes, glass, fly screen, curtain-wall
 * modules… so a sliding window can be delivered frame first and
 * sashes later, or a chassis without its glass.
 *
 * Every part counts its pieces through the stages:
 *   started ≥ made ≥ ready ≥ delivered ≥ installed   (≤ quantity)
 * A part nobody started is "to_make" (pas entamé) even when other
 * parts of the same chassis are in progress; the chassis itself is
 * "in_production" as soon as any of its parts is started.
 * and gets a derived `status`; the unit's status is its least
 * advanced active part. Delivery notes (DeliveryNote) move
 * `deliveredQty`; production / logistics move the others.
 * ============================================================
 */
const STAGES = ["to_make", "in_production", "made", "ready", "partially_delivered", "delivered", "installed", "received", "cancelled"];
const PART_KINDS = ["complete", "frame", "sash", "glass", "module", "screen", "panel", "accessory", "other"];

const partSchema = new mongoose.Schema({
  key: { type: String, trim: true, default: "" },
  label: { type: String, required: true, trim: true, maxlength: 150 },
  kind: { type: String, enum: PART_KINDS, default: "other" },
  quantity: { type: Number, required: true, min: 0, default: 1 }, // pieces (2 vantaux, 12 modules…)
  width: { type: Number, default: null }, // element size (mm) — null = the chassis size
  height: { type: Number, default: null },
  startedQty: { type: Number, default: 0, min: 0 }, // pieces in progress or further (≥ made)
  madeQty: { type: Number, default: 0, min: 0 },
  readyQty: { type: Number, default: 0, min: 0 },
  deliveredQty: { type: Number, default: 0, min: 0 },
  installedQty: { type: Number, default: 0, min: 0 },
  cancelled: { type: Boolean, default: false },
  status: { type: String, enum: STAGES, default: "to_make" },
  notes: { type: String, trim: true, maxlength: 300 },
});

const historySchema = new mongoose.Schema({
  at: { type: Date, default: Date.now },
  by: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  action: { type: String, trim: true },
  note: { type: String, trim: true, maxlength: 500 },
}, { _id: false });

const trackingUnitSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    project: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    projectItem: { type: mongoose.Schema.Types.ObjectId, required: true },
    index: { type: Number, required: true, min: 1 },
    ref: { type: String, trim: true, required: true },
    model: { type: mongoose.Schema.Types.ObjectId, ref: "ChassisModel", default: null },
    label: { type: String, trim: true, maxlength: 300 },
    L: { type: Number, default: null },
    H: { type: Number, default: null },
    finish: { type: mongoose.Schema.Types.ObjectId, ref: "Finish", default: null },
    specHash: { type: String, default: "" }, // model + size + colour + options when last synced
    parts: [partSchema],
    status: { type: String, enum: STAGES, default: "to_make", index: true },
    productionStartedAt: { type: Date, default: null },
    receivedAt: { type: Date, default: null }, // réception client
    cancelled: { type: Boolean, default: false },
    cancelledAt: { type: Date, default: null },
    cancelReason: { type: String, trim: true, maxlength: 300 },
    // Changed (size, model, options…) after production started: must be remade / checked.
    modified: { type: Boolean, default: false },
    modifiedAt: { type: Date, default: null },
    history: [historySchema],
  },
  { timestamps: true }
);
trackingUnitSchema.index({ project: 1, projectItem: 1, index: 1 }, { unique: true });

const ORDER = ["to_make", "in_production", "made", "ready", "partially_delivered", "delivered", "installed", "received"];

function partStatus(p, unit) {
  if (p.cancelled || unit.cancelled) return "cancelled";
  const q = p.quantity || 0;
  if (q <= 0) return "cancelled";
  if (p.installedQty >= q) return unit.receivedAt ? "received" : "installed";
  if (p.deliveredQty >= q) return "delivered";
  if (p.deliveredQty > 0) return "partially_delivered";
  if (p.readyQty >= q) return "ready";
  if (p.madeQty >= q) return "made";
  if (p.startedQty > 0 || p.madeQty > 0) return "in_production";
  return "to_make";
}

trackingUnitSchema.pre("validate", function computeStatus() {
  for (const p of this.parts) {
    const q = p.quantity || 0;
    p.deliveredQty = Math.min(Math.max(p.deliveredQty || 0, 0), q);
    p.madeQty = Math.min(Math.max(p.madeQty || 0, p.deliveredQty), q);
    p.startedQty = Math.min(Math.max(p.startedQty || 0, p.madeQty), q);
    p.readyQty = Math.min(Math.max(p.readyQty || 0, 0), p.madeQty);
    p.deliveredQty = Math.min(Math.max(p.deliveredQty || 0, 0), q);
    p.installedQty = Math.min(Math.max(p.installedQty || 0, 0), p.deliveredQty);
    p.status = partStatus(p, this);
  }
  if (this.cancelled) { this.status = "cancelled"; return; }
  const active = this.parts.filter((p) => p.status !== "cancelled");
  if (!active.length) { this.status = "to_make"; return; }
  const ranks = active.map((p) => ORDER.indexOf(p.status));
  let min = Math.min(...ranks);
  // Any part started → the chassis is in production (not "not started").
  const started = !!this.productionStartedAt || active.some((p) => p.startedQty > 0 || p.madeQty > 0 || p.deliveredQty > 0);
  if (min === 0 && started) min = ORDER.indexOf("in_production");
  // Some parts delivered, others not yet → partially delivered.
  if (ORDER[min] !== "partially_delivered" && min < ORDER.indexOf("partially_delivered") && active.some((p) => p.deliveredQty > 0)) min = ORDER.indexOf("partially_delivered");
  this.status = ORDER[min];
});

trackingUnitSchema.statics.STAGES = STAGES;
trackingUnitSchema.statics.PART_KINDS = PART_KINDS;
trackingUnitSchema.statics.ORDER = ORDER;

module.exports = mongoose.model("TrackingUnit", trackingUnitSchema);
