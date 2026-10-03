// Must load before the schema is compiled — registers the client-isolation plugin.
require("../services/tenantScope");
const mongoose = require("mongoose");

/**
 * PROFILE SECTION — the DXF cross-section of a profile article
 * (services/dxfSection.js). One per raw article (colour variants share it).
 *   pieces     parsed geometry as imported (mm), per layer — kept so the
 *              orientation / layers can be changed without re-importing
 *   transform  quarter turns + mirrors chosen on the import screen
 *   paths      normalised drawing (bbox min at 0,0): closed contours with
 *              their nesting depth (even = matter, odd = chamber) + open lines
 *   metrics    width (in-plane), height (depth), area, kg/m, perimeters
 */
const profileSectionSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    fileName: { type: String, trim: true, maxlength: 200, default: "" },
    source: { type: String, default: null }, // the original DXF text (≤ 3 MB) for download
    units: { type: Number, default: 4 },
    scale: { type: Number, default: 1 },
    layers: [{ name: String, count: Number, _id: false }],
    hiddenLayers: [{ type: String }],
    pieces: { type: mongoose.Schema.Types.Mixed, default: [] },
    transform: {
      rot: { type: Number, default: 0 },
      flipX: { type: Boolean, default: false },
      flipY: { type: Boolean, default: false },
    },
    paths: { type: mongoose.Schema.Types.Mixed, default: [] },
    metrics: { type: mongoose.Schema.Types.Mixed, default: {} },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);
profileSectionSchema.index({ company: 1, product: 1 }, { unique: true });

module.exports = mongoose.model("ProfileSection", profileSectionSchema);
