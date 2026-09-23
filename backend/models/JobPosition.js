const mongoose = require("mongoose");
const translatable = require("../plugins/translatable");

/**
 * ============================================================
 * JOB POSITION (poste)
 * ============================================================
 * A defined role within a department — "Comptable Senior",
 * "Ingénieur Logiciel" — independent of who currently holds it.
 * This is what closes the gap the old setup had: previously
 * `jobTitle` was just free text typed per-employee, with no
 * registry, no salary band to check a new hire's offer against,
 * and no reporting structure that survived someone leaving.
 *
 * `reportsTo` is a self-reference to ANOTHER JobPosition, not to
 * an Employee — "this position reports to that position" is a
 * structural fact that doesn't change when the person in either
 * seat changes, unlike Employee.manager (which points at a
 * specific person and has to be manually reassigned on turnover).
 * The two are complementary: Employee.manager is still what
 * approval-routing (absences/advances) actually uses day to day;
 * JobPosition.reportsTo is the durable org-chart truth.
 * ============================================================
 */

const jobPositionSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },

    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      required: true,
      index: true,
    },

    title: {
      type: String,
      required: [true, "Position title is required"],
      trim: true,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 1000,
    },

    salaryBandMin: {
      type: Number,
      min: 0,
      default: null,
    },

    salaryBandMax: {
      type: Number,
      min: 0,
      default: null,
    },

    currency: {
      type: String,
      trim: true,
      default: "MAD",
    },

    requiredSkills: [{ type: String, trim: true }],

    // Another JobPosition this one reports to — may be in a
    // different department (e.g. a department head reporting to a
    // director in Management). Optional: top-level positions leave
    // this null.
    reportsTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "JobPosition",
      default: null,
    },

    // Whether holding this position unlocks its department's module
    // (Department.permissionKey — e.g. the HR or Production module)
    // for the employee's linked login. Being IN a department is not
    // enough on its own: a Machine Operator in Production shouldn't
    // manage inventory, while a Responsable de Production should.
    // Default false = the employee gets My Space only. Has no effect
    // in a department with no permissionKey. See
    // services/employeeAccountService.js's computeInheritedPermissions.
    grantsModuleAccess: {
      type: Boolean,
      default: false,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

// Multilingual (fr/en/ar) content layer for `title` and `description` —
// see plugins/translatable.js.
jobPositionSchema.plugin(translatable, { fields: ["title", "description"] });

jobPositionSchema.index({ company: 1, department: 1 });
jobPositionSchema.index({ company: 1, title: 1 });

module.exports = mongoose.model("JobPosition", jobPositionSchema);
