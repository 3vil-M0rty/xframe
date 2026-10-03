const mongoose = require("mongoose");

/**
 * Fabrication rules (LogiKal-like article / machining assignment), carried
 * by a PROFILE ARTICLE (Product.fabRules) or by a NODE (ProfileNode.rules):
 * see services/chassisFabrication.js for the meaning of each field.
 */
// ACCESSORY RULE — "what to add" (LogiKal-like article assignment):
// see services/chassisFabrication.js for the meaning of each field.
const ruleSchema = new mongoose.Schema({
  label: { type: String, trim: true, maxlength: 150, default: "" },
  product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
  kind: { type: String, enum: ["accessory", "gasket", "consumable"], default: "accessory" },
  trigger: { type: String, enum: ["chassis", "piece", "corner", "joint", "leaf", "pane"], default: "chassis" },
  codes: [{ type: String, trim: true, uppercase: true }],
  tags: [{ type: String, trim: true }],
  openings: [{ type: String, trim: true }],
  leafRole: { type: String, enum: ["any", "active", "passive"], default: "any" },
  infill: { type: String, enum: ["any", "glass", "panel"], default: "any" },
  where: { type: String, enum: ["any", "fixed", "sash"], default: "any" },
  minW: { type: Number, default: null }, maxW: { type: Number, default: null },
  minH: { type: Number, default: null }, maxH: { type: Number, default: null },
  maxKg: { type: Number, default: null },
  condition: { type: String, trim: true, maxlength: 500, default: "" },
  measure: { type: String, enum: ["count", "length"], default: "count" },
  qty: { type: String, trim: true, maxlength: 500, default: "1" },
  length: { type: String, trim: true, maxlength: 500, default: "" },
  group: { type: String, trim: true, maxlength: 60, default: "" },
  finish: { type: String, enum: ["none", "project"], default: "none" },
  workshop: { type: String, trim: true, uppercase: true, default: "" },
  isActive: { type: Boolean, default: true },
});

// MACHINING RULE — "what to machine" on the pieces of a profile / position.
const machiningSchema = new mongoose.Schema({
  label: { type: String, trim: true, maxlength: 100, required: true },
  kind: { type: String, enum: ["drain", "drill", "mill", "slot", "notch", "other"], default: "other" },
  codes: [{ type: String, trim: true, uppercase: true }],
  tags: [{ type: String, trim: true }],
  openings: [{ type: String, trim: true }],
  face: { type: String, trim: true, default: "" },
  place: { type: String, enum: ["ends", "pitch", "center", "at", "joints"], default: "ends" },
  offset: { type: String, trim: true, maxlength: 300, default: "0" },
  pitch: { type: String, trim: true, maxlength: 300, default: "" },
  at: { type: String, trim: true, maxlength: 500, default: "" },
  size: { type: String, trim: true, maxlength: 60, default: "" },
  tool: { type: String, trim: true, maxlength: 60, default: "" },
  condition: { type: String, trim: true, maxlength: 500, default: "" },
  isActive: { type: Boolean, default: true },
});

module.exports = { ruleSchema, machiningSchema };
