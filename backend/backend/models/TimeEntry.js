// Must load before the schema is compiled — registers the client-isolation plugin.
require("../services/tenantScope");
const mongoose = require("mongoose");

/**
 * Hours an employee spent on a project (feuille de temps). The cost
 * is frozen when entered: hours × the employee's hourly cost at that
 * time (services/projectCosts.js → hourlyCost), so a later raise
 * doesn't rewrite past project costs.
 */
const timeEntrySchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    project: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    task: { type: mongoose.Schema.Types.ObjectId, ref: "ProjectTask", default: null },
    employee: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", required: true, index: true },
    date: { type: Date, required: true },
    hours: { type: Number, required: true, min: 0.25, max: 24 },
    hourlyCost: { type: Number, required: true, min: 0 },
    cost: { type: Number, required: true, min: 0 },
    notes: { type: String, trim: true, maxlength: 500 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

timeEntrySchema.index({ project: 1, date: -1 });

module.exports = mongoose.model("TimeEntry", timeEntrySchema);
