const mongoose = require("mongoose");

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

inventoryCategorySchema.index({ company: 1, name: 1 }, { unique: true });

module.exports = mongoose.model("InventoryCategory", inventoryCategorySchema);
