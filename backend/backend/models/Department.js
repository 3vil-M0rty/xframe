const mongoose = require("mongoose");
const translatable = require("../plugins/translatable");

/**
 * ============================================================
 * DEPARTMENT
 * ============================================================
 * Replaces the old fixed enum that used to live directly on
 * Employee.department and User.department — companies now define
 * their own departments here (Organization -> Departments), with
 * whatever names/structure fits them.
 *
 * `permissionKey` is the bridge back to the app's PERMISSION
 * system, which is intentionally NOT company-customizable: module
 * access (canAccessHR, canAccessProduction — see
 * permissions/permissions.js) is checked against a small fixed set
 * of codes ("hr", "production", ...), because those gate which
 * FEATURES of this app a login can use, not how the company
 * organizes itself. A company might call their HR team "Ressources
 * Humaines", "People Ops", anything — setting permissionKey: "hr"
 * on THAT department is what tells the system "employees here, and
 * any login auto-created for them, should get HR module access".
 * Leaving it unset (most departments) means employees there get no
 * special module access beyond self-service, which is the normal
 * case. See services/employeeAccountService.js for where this
 * actually gets applied to a newly-created login.
 * ============================================================
 */

const departmentSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },

    name: {
      type: String,
      required: [true, "Department name is required"],
      trim: true,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },

    // Bridges this company-defined department to the app's fixed
    // permission codes — see the big comment above. null/omitted
    // is the normal case; only set this on the ONE department that
    // should unlock a given module.
    permissionKey: {
      type: String,
      enum: ["hr", "production", null],
      default: null,
    },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

// Multilingual (fr/en/ar) content layer for `name` and `description` —
// see plugins/translatable.js.
departmentSchema.plugin(translatable, { fields: ["name", "description"] });

departmentSchema.index({ company: 1, name: 1 }, { unique: true });
// At most one department per company can carry a given permission
// key — otherwise "which department's login gets HR access" would
// be ambiguous. Partial index so companies with no permissionKey
// set on anything aren't affected.
departmentSchema.index(
  { company: 1, permissionKey: 1 },
  { unique: true, partialFilterExpression: { permissionKey: { $type: "string" } } }
);

module.exports = mongoose.model("Department", departmentSchema);
