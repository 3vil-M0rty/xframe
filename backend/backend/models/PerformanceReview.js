const mongoose = require("mongoose");
const translatable = require("../plugins/translatable");

/**
 * ============================================================
 * PERFORMANCE REVIEW
 * ============================================================
 * One review = one cycle for one employee, written by their
 * reviewer (usually their manager — see Employee.manager). Kept
 * deliberately simple: a handful of numeric ratings against fixed
 * criteria, a free-text goals list with individual status tracking,
 * and open comments — not a fully configurable review-template
 * builder, which would be a much bigger feature for questionable
 * added value at this stage.
 *
 * status:
 *   draft      → reviewer is still writing it, employee can't see it
 *   submitted  → visible to the employee, awaiting their acknowledgment
 *   acknowledged → employee has confirmed they've read it
 * This mirrors the same "don't show a half-finished HR document to
 * the employee" pattern as PurchaseRequest/Absence's own status
 * flows elsewhere in this app.
 * ============================================================
 */

const RATING_CRITERIA = [
  "jobKnowledge",
  "qualityOfWork",
  "communication",
  "teamwork",
  "initiative",
  "punctuality",
];

const goalSchema = new mongoose.Schema(
  {
    description: { type: String, trim: true, required: true, maxlength: 500 },
    status: {
      type: String,
      enum: ["not_started", "in_progress", "completed", "cancelled"],
      default: "not_started",
    },
  },
  { _id: true }
);

const performanceReviewSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: [true, "Company is required"],
      index: true,
    },

    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: [true, "Employee is required"],
      index: true,
    },

    reviewer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: [true, "Reviewer is required"],
    },

    // A label for the cycle this review covers, e.g. "H1 2026",
    // "Annual review 2026" — free text rather than a rigid
    // start/end date pair, since review cycles vary a lot by
    // company (annual, semi-annual, probation-end, ad-hoc).
    periodLabel: { type: String, trim: true, required: true, maxlength: 100 },
    reviewDate: { type: Date, required: true, default: Date.now },

    // One 1-5 rating per fixed criterion. Stored as a plain object
    // rather than an array of {criterion, score} pairs — the
    // criteria list is fixed code-side (RATING_CRITERIA above), not
    // per-company configurable, so a plain keyed object is simpler
    // to read and validate than an array would be.
    ratings: {
      jobKnowledge: { type: Number, min: 1, max: 5 },
      qualityOfWork: { type: Number, min: 1, max: 5 },
      communication: { type: Number, min: 1, max: 5 },
      teamwork: { type: Number, min: 1, max: 5 },
      initiative: { type: Number, min: 1, max: 5 },
      punctuality: { type: Number, min: 1, max: 5 },
    },

    goals: [goalSchema],

    strengths: { type: String, trim: true, maxlength: 2000 },
    areasForImprovement: { type: String, trim: true, maxlength: 2000 },
    comments: { type: String, trim: true, maxlength: 2000 },

    status: {
      type: String,
      enum: ["draft", "submitted", "acknowledged"],
      default: "draft",
      index: true,
    },

    acknowledgedAt: { type: Date, default: null },
    // The employee's own remarks, added when they acknowledge —
    // separate from the reviewer's `comments` above so neither
    // side's words get attributed to the other.
    employeeComments: { type: String, trim: true, maxlength: 2000 },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

performanceReviewSchema.index({ company: 1, employee: 1, reviewDate: -1 });

/** Average of whichever rating criteria were actually filled in — not every review needs every field scored. */
performanceReviewSchema.virtual("averageRating").get(function averageRating() {
  const scores = RATING_CRITERIA.map((key) => this.ratings?.[key]).filter((v) => typeof v === "number");
  if (scores.length === 0) return null;
  return Math.round((scores.reduce((sum, v) => sum + v, 0) / scores.length) * 10) / 10;
});
performanceReviewSchema.set("toJSON", { virtuals: true });
performanceReviewSchema.set("toObject", { virtuals: true });

// Multilingual content layer (see plugins/translatable.js) — these
// are the free-text fields a reviewer writes in their own language
// that should still read naturally for anyone viewing in another.
performanceReviewSchema.plugin(translatable, {
  fields: ["strengths", "areasForImprovement", "comments"],
});

const PerformanceReview = mongoose.model("PerformanceReview", performanceReviewSchema);
PerformanceReview.RATING_CRITERIA = RATING_CRITERIA;

module.exports = PerformanceReview;
