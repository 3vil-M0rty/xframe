// Must load before the schema is compiled — registers the client-isolation plugin.
require("../services/tenantScope");
const mongoose = require("mongoose");

/**
 * PRODUCTION ORDER (ordre de fabrication, OF-YYYY-NNNN) — the work of
 * ONE workshop on one project (or, for a laquage service, for an
 * outside customer).
 *
 *   items    what the workshop produces (chassis for Aluminium, panes for
 *            Vitrage, bars to lacquer for Laquage)
 *   needs    what it consumes: theoretical quantity (from the catalogue
 *            formulas, in the article's stock unit) vs consumed (booked
 *            by the workshop manager as InventoryMovements)
 *   outputs  Laquage only: lacquered variants put into stock
 *   dependsOn  orders of the feeding workshops (Laquage/Vitrage → Aluminium)
 */
const needSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", default: null },
  baseProduct: { type: mongoose.Schema.Types.ObjectId, ref: "Product", default: null },
  finish: { type: mongoose.Schema.Types.ObjectId, ref: "Finish", default: null },
  kind: { type: String, trim: true },
  materialType: { type: String, trim: true, default: "" },
  label: { type: String, trim: true, maxlength: 250 },
  measure: { type: String, enum: ["length", "area", "count"], default: "count" },
  pieces: { type: Number, default: 0 },
  totalLength: { type: Number, default: 0 }, // mm
  area: { type: Number, default: 0 }, // m²
  theoretical: { type: Number, default: 0 }, // stock units
  consumed: { type: Number, default: 0 }, // stock units
  unit: { type: String, trim: true, default: "" },
  unitCost: { type: Number, default: 0 },
  cuts: { type: mongoose.Schema.Types.Mixed, default: undefined }, // [{ length, qty, angle, label, ref }]
  cutPlan: { type: mongoose.Schema.Types.Mixed, default: undefined }, // bars: { barLength, patterns, efficiency } ; glass: { type: "sheet", sheetWidth, sheetHeight, patterns, fromStock, toBuy }
  pieceList: { type: mongoose.Schema.Types.Mixed, default: undefined }, // glass/panels: [{ width, height, qty, label, ref }]
  candidates: { type: mongoose.Schema.Types.Mixed, default: undefined }, // glass: plateaux (article ids) it could be cut from
  warning: { type: String, trim: true, default: "" },
  extra: { type: Boolean, default: false }, // added by hand (not from the catalogue)
});

const itemSchema = new mongoose.Schema({
  projectItem: { type: mongoose.Schema.Types.ObjectId, default: null },
  ref: { type: String, trim: true, default: "" },
  label: { type: String, trim: true, maxlength: 300 },
  model: { type: mongoose.Schema.Types.ObjectId, ref: "ChassisModel", default: null },
  product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", default: null },
  finish: { type: mongoose.Schema.Types.ObjectId, ref: "Finish", default: null },
  L: { type: Number, default: null },
  H: { type: Number, default: null },
  quantity: { type: Number, default: 1, min: 0 },
  done: { type: Number, default: 0, min: 0 },
});

const outputSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true }, // raw article
  variant: { type: mongoose.Schema.Types.ObjectId, ref: "Product", default: null }, // lacquered article
  finish: { type: mongoose.Schema.Types.ObjectId, ref: "Finish", default: null },
  quantity: { type: Number, default: 0, min: 0 }, // planned
  produced: { type: Number, default: 0, min: 0 },
  rejected: { type: Number, default: 0, min: 0 },
  paintSurface: { type: Number, default: 0 }, // m² total
});

const productionOrderSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    number: { type: String, required: true, trim: true },
    workshop: { type: mongoose.Schema.Types.ObjectId, ref: "Workshop", required: true, index: true },
    kind: { type: String, enum: ["laquage", "aluminium", "vitrage", "other"], default: "other" },
    project: { type: mongoose.Schema.Types.ObjectId, ref: "Project", default: null, index: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", default: null },
    customerMaterial: { type: Boolean, default: false }, // laquage of the customer's own bars
    title: { type: String, trim: true, maxlength: 200 },
    status: {
      type: String,
      enum: ["draft", "planned", "in_progress", "done", "cancelled"],
      default: "draft",
      index: true,
    },
    priority: { type: String, enum: ["low", "normal", "high", "urgent"], default: "normal" },
    dependsOn: [{ type: mongoose.Schema.Types.ObjectId, ref: "ProductionOrder" }],
    plannedStart: { type: Date, default: null },
    dueDate: { type: Date, default: null },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    assignees: [{ type: mongoose.Schema.Types.ObjectId, ref: "Employee" }],
    items: [itemSchema],
    needs: [needSchema],
    outputs: [outputSchema],
    labourMinutes: { type: Number, default: 0 },
    // Workshop flow (see services/workshopFlow.js)
    materialsReceivedAt: { type: Date, default: null }, // last transfer received
    framesDoneAt: { type: Date, default: null }, // aluminium: chassis made, waiting for their glass
    glassReceivedAt: { type: Date, default: null }, // aluminium: glass units received from Vitrage
    // Step done by a sub-contractor (glass ordered cut, outside lacquering, laser cutting…).
    subcontract: {
      supplier: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier", default: null },
      purchaseOrder: { type: mongoose.Schema.Types.ObjectId, ref: "PurchaseOrder", default: null },
      note: { type: String, trim: true, maxlength: 300, default: "" },
      at: { type: Date, default: null },
      by: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    },
    notes: { type: String, trim: true, maxlength: 2000 },
    history: [{
      status: String, note: String,
      at: { type: Date, default: Date.now },
      by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      _id: false,
    }],
    lateNotifiedAt: { type: Date, default: null }, // "past due" alert sent (reset when dueDate changes)
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);
productionOrderSchema.index({ company: 1, number: 1 }, { unique: true });
productionOrderSchema.index({ company: 1, workshop: 1, status: 1 });

module.exports = mongoose.model("ProductionOrder", productionOrderSchema);
