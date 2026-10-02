// Must load before the schema is compiled — registers the client-isolation plugin.
require("../services/tenantScope");
const mongoose = require("mongoose");
const translatable = require("../plugins/translatable");

/**
 * ============================================================
 * INVENTORY CATEGORY (rubrique)
 * ============================================================
 * Companies define their own categories here (e.g. "Matière
 * première", "Produits finis", "Emballage") from Production ->
 * Settings — there's no fixed enum, since every company's
 * inventory structure is different. `icon` is a Lucide icon NAME
 * (e.g. "Package", "Wheat") chosen from a curated picker on the
 * frontend (see utils/inventoryIcons.js) — stored as a plain
 * string so the frontend can render it via its icon-name → 
 * component lookup, without the backend needing to know anything
 * about Lucide.
 * ============================================================
 */

const inventoryCategorySchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },

    name: {
      type: String,
      required: [true, "Category name is required"],
      trim: true,
    },

    // Sub-categories: "Profilés aluminium" › "Série ATLAS 78 — coulissants",
    // "Série garde-corps"… null = top-level category. Up to 4 levels.
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InventoryCategory",
      default: null,
      index: true,
    },

    // Accounting account for purchases of articles in this category
    // (PCGE): 6121 matières premières, 6122 matières et fournitures
    // consommables, 6125 achats non stockés, 2332 installations
    // techniques... Empty -> the company's default purchase account.
    accountingAccount: {
      type: String,
      trim: true,
      default: "",
      match: [/^(\d{4,10})?$/, "An accounting account is 4 to 10 digits"],
    },

    // Fixed assets (immobilisations): their VAT goes to 34551 (TVA
    // récupérable sur immobilisations) instead of 34552 (sur charges).
    isFixedAsset: {
      type: Boolean,
      default: false,
    },

    // A Lucide icon name (e.g. "Package", "Beaker", "Wheat") — see
    // the curated list in the frontend's utils/inventoryIcons.js.
    icon: {
      type: String,
      trim: true,
      default: "Package",
    },

    color: {
      type: String,
      trim: true,
      default: "#4c8dff",
    },

    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

// Multilingual (fr/en/ar) content layer for `name` and `description` —
// see plugins/translatable.js.
inventoryCategorySchema.plugin(translatable, { fields: ["name", "description"] });

// A name is unique among its siblings: "Accessoires" can exist under two series.
inventoryCategorySchema.index({ company: 1, parent: 1, name: 1 }, { unique: true });

const InventoryCategory = mongoose.model("InventoryCategory", inventoryCategorySchema);

// Databases created before sub-categories have a unique index on
// { company, name } alone, which would refuse "Accessoires" under two
// different parents — drop it once connected (no-op when absent).
function dropLegacyNameIndex() {
  try {
    const p = InventoryCategory.collection?.dropIndex?.("company_1_name_1");
    if (p && typeof p.catch === "function") p.catch(() => {});
  } catch { /* index already gone / test database */ }
}
if (mongoose.connection.readyState === 1) dropLegacyNameIndex();
else mongoose.connection.once("open", dropLegacyNameIndex);

module.exports = InventoryCategory;
