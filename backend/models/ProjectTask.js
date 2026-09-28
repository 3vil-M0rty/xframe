// Must load before the schema is compiled — registers the client-isolation plugin.
require("../services/tenantScope");
const mongoose = require("mongoose");

/**
 * A step of a project (planning): who, when, status. A project's
 * progress = done tasks weighted by their estimated hours (or count).
 */
const projectTaskSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    project: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    title: { type: String, required: [true, "Task title is required"], trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 2000 },
    assignees: [{ type: mongoose.Schema.Types.ObjectId, ref: "Employee" }],
    startDate: { type: Date, default: null },
    dueDate: { type: Date, default: null },
    estimatedHours: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: ["todo", "in_progress", "done", "blocked"], default: "todo", index: true },
    order: { type: Number, default: 0 },
    completedAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

projectTaskSchema.index({ project: 1, order: 1 });

module.exports = mongoose.model("ProjectTask", projectTaskSchema);
