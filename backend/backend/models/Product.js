// Must load before the schema is compiled — registers the client-isolation plugin.
require("../services/tenantScope");
const mongoose = require("mongoose");
const translatable = require("../plugins/translatable");

/**
 * ============================================================
 * PRODUCT (inventory item)
 * ============================================================
 * One document per stock item — raw material, finished product,
 * or whatever category the company has defined (see
 * InventoryCategory). `quantity` here is always the CURRENT
 * quantity; the full history that lets the Inventory page show
 * "what was in stock on date X" lives in InventoryMovement, not
 * here — see that model for why.
 *
 * `supplierReference` is deliberately a plain string, not a ref —
 * there's no Supplier model yet ("will be added later" per the
 * spec this was built from). `prices` holds one entry per
 * supplier NAME (same reasoning) until that model exists; migrating
 * to a real Supplier ref later just means adding a `supplier` ObjectId
 * alongside `supplierName` here, not restructuring the array.
 * ============================================================
 */

const supplierPriceSchema = new mongoose.Schema(
  {
    supplierName: { type: String, trim: true, required: true },
    price: { type: Number, required: true, min: 0 },
    // Optional external reference for this product AT that
    // supplier (their own catalog/SKU number) — not required,
    // per the spec ("fournisseurs référence (not necessary)").
    supplierReference: { type: String, trim: true },
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },

    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InventoryCategory",
      required: true,
      index: true,
    },

    name: {
      type: String,
      required: [true, "Product name is required"],
      trim: true,
    },

    // Required — this is the company's own internal stock code.
    // Required when production creates an article (enforced in
    // routes/products.js), but may be empty for an article the
    // purchasing team created from a purchase-order line — they add
    // it later (PATCH /products/:id/supplier-info).
    internalReference: {
      type: String,
      trim: true,
      uppercase: true,
    },

    image: {
      url: { type: String, trim: true },
      publicId: { type: String, trim: true },
    },

    quantity: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },

    unit: {
      type: String,
      trim: true,
      default: "unit", // e.g. kg, L, pièce — free text, not enumerated
    },

    // Low-stock threshold — the Inventory page flags any product
    // at or below this.
    threshold: {
      type: Number,
      min: 0,
      default: 0,
    },

    prices: [supplierPriceSchema],

    // Optional — "prix de vente (not necessary)".
    sellingPrice: {
      type: Number,
      min: 0,
      default: null,
    },

    currency: {
      type: String,
      trim: true,
      default: "MAD",
    },

    notes: {
      type: String,
      trim: true,
      maxlength: 1000,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    // ---------------- Aluminium joinery (technical data) ----------------
    // What the article IS for the chassis catalogue / BOM engine.
    materialType: {
      type: String,
      enum: ["profile", "powder", "glass", "accessory", "gasket", "panel", "consumable", "other", null],
      default: null,
      index: true,
    },
    // How it is counted in stock: unit (pieces / boxes / cartridges), bar
    // (whole bars of `barLength`), meter, m2, sheet (whole sheets of
    // sheetWidth × sheetHeight), kg.
    stockMode: {
      type: String,
      enum: ["unit", "bar", "meter", "m2", "sheet", "kg"],
      default: "unit",
    },
    barLength: { type: Number, default: null, min: 0 }, // mm
    // Profile geometry (mm), like a profile library: épaisseur de chambre +
    // ailette externe + ailette interne = hauteur totale (in the plane of the
    // frame: mitres, talons, tête-bêche) ; largeur = depth into the wall.
    // Formulas use them as ch / ae / ai / hp / lp (see services/chassisBom.js).
    profileChamber: { type: Number, default: null, min: 0 },
    profileOuterFin: { type: Number, default: null, min: 0 },
    profileInnerFin: { type: Number, default: null, min: 0 },
    profileHeight: { type: Number, default: null, min: 0 },
    profileWidth: { type: Number, default: null, min: 0 },
    profileDepth: { type: Number, default: null, min: 0 }, // legacy: mitre width before the geometry fields
    sheetWidth: { type: Number, default: null, min: 0 }, // mm
    sheetHeight: { type: Number, default: null, min: 0 }, // mm
    // Base quantity contained in one stock unit (a 50 m roll → 50, a box of 100 → 100).
    packSize: { type: Number, default: null, min: 0 },
    weightPerMeter: { type: Number, default: null, min: 0 }, // kg/m (profiles)
    perimeter: { type: Number, default: null, min: 0 }, // painted perimeter (développé), mm
    paintSurface: { type: Number, default: null, min: 0 }, // m² painted per stock unit (overrides perimeter)
    powderPerUnit: { type: Number, default: null, min: 0 }, // kg of powder per stock unit (method per_unit)
    coverage: { type: Number, default: null, min: 0 }, // powder articles: kg per m²
    thickness: { type: Number, default: null, min: 0 }, // mm (glass, sheets)
    // Cost price (coût de revient) — weighted average, maintained when
    // the Laquage workshop produces lacquered variants. When empty, the
    // cheapest supplier price is used.
    standardCost: { type: Number, default: null, min: 0 },
    // Colour variant of a raw article ("Profilé 4020 — RAL 9016").
    baseProduct: { type: mongoose.Schema.Types.ObjectId, ref: "Product", default: null, index: true },
    finish: { type: mongoose.Schema.Types.ObjectId, ref: "Finish", default: null },
    // Last "stock at or below the threshold" alert — cleared when the
    // stock goes back above the threshold, so each drop alerts once.
    lowStockNotifiedAt: { type: Date, default: null },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

// Multilingual (fr/en/ar) content layer for `name` and `notes` — see
// plugins/translatable.js. Adds `translations.name` / `translations.notes`
// alongside the plain fields above, auto-populated on save; doesn't
// change `name`/`notes` themselves in any way.
productSchema.plugin(translatable, { fields: ["name", "notes"] });

// Hauteur totale = chambre + ailettes (kept in sync whenever a part is given).
productSchema.pre("save", function syncProfileHeight(next) {
  const parts = [this.profileChamber, this.profileOuterFin, this.profileInnerFin];
  if (parts.some((v) => v !== null && v !== undefined && v !== "")) this.profileHeight = parts.reduce((s, v) => s + (Number(v) || 0), 0);
  next();
});

// One internal reference per company.
// Partial, not plain: uniqueness only for articles that HAVE a
// reference — with a plain unique index, two articles without one
// would collide as (company, null), the same trap as the employee
// CIN/CNSS index (see models/Employee.js). Rebuilt on existing
// databases at startup by utils/syncEmployeeIndexes.js.
productSchema.index(
  { company: 1, internalReference: 1 },
  { unique: true, partialFilterExpression: { internalReference: { $gt: "" } } }
);
productSchema.index({ company: 1, category: 1 });
productSchema.index({ company: 1, name: 1 });

module.exports = mongoose.model("Product", productSchema);
