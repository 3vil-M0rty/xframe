// Must load before the schema is compiled — registers the client-isolation plugin.
require("../services/tenantScope");
const mongoose = require("mongoose");

/**
 * PROJECT (affaire / chantier) — a client job, usually born from an
 * accepted devis. Numbered PRJ-YYYY-NNNN.
 *
 * Budget (planned) vs real costs:
 *   materials  inventory movements "out" tagged with this project
 *   purchases  purchase orders linked to this project (HT)
 *   labour     time entries × each employee's hourly cost
 *   other      `expenses` below (transport, subcontracting…)
 * Revenue = the devis HT (or what's been invoiced). See services/projectCosts.js.
 */
const expenseSchema = new mongoose.Schema({
  date: { type: Date, required: true, default: Date.now },
  label: { type: String, required: true, trim: true, maxlength: 200 },
  amount: { type: Number, required: true, min: 0 },
  by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
});

// An "ouvrage": one chassis line to manufacture (from the devis, or
// added / corrected after the site survey — prise de cotes).
const projectItemSchema = new mongoose.Schema({
  ref: { type: String, trim: true, maxlength: 30, default: "" },
  model: { type: mongoose.Schema.Types.ObjectId, ref: "ChassisModel", required: true },
  label: { type: String, trim: true, maxlength: 300, default: "" },
  L: { type: Number, required: true, min: 1 },
  H: { type: Number, required: true, min: 1 },
  quantity: { type: Number, required: true, min: 1, default: 1 },
  finish: { type: mongoose.Schema.Types.ObjectId, ref: "Finish", default: null },
  params: { type: mongoose.Schema.Types.Mixed, default: {} },
  notes: { type: String, trim: true, maxlength: 500 },
});

const projectSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    number: { type: String, required: true, trim: true },
    name: { type: String, required: [true, "Project name is required"], trim: true, maxlength: 200 },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", default: null, index: true },
    quote: { type: mongoose.Schema.Types.ObjectId, ref: "Quote", default: null },
    status: {
      type: String,
      enum: ["planned", "in_progress", "on_hold", "completed", "cancelled"],
      default: "planned",
      index: true,
    },
    startDate: { type: Date, default: null },
    dueDate: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    manager: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", default: null },
    team: [{ type: mongoose.Schema.Types.ObjectId, ref: "Employee" }],
    location: { type: String, trim: true, maxlength: 300 },
    description: { type: String, trim: true, maxlength: 3000 },
    // Planned costs (HT). Revenue defaults to the devis HT.
    budget: {
      revenue: { type: Number, default: 0, min: 0 },
      materials: { type: Number, default: 0, min: 0 },
      labour: { type: Number, default: 0, min: 0 },
      purchases: { type: Number, default: 0, min: 0 },
      other: { type: Number, default: 0, min: 0 },
    },
    expenses: [expenseSchema],
    items: [projectItemSchema],
    // Default colour of the project's chassis (each ouvrage may override it).
    finish: { type: mongoose.Schema.Types.ObjectId, ref: "Finish", default: null },
    dueSoonNotifiedAt: { type: Date, default: null }, // "deadline near, production not finished" (reset when dueDate changes)
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

projectSchema.index({ company: 1, number: 1 }, { unique: true });

module.exports = mongoose.model("Project", projectSchema);
