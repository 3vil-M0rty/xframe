const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: true,
      trim: true
    },

    lastName: {
      type: String,
      required: true,
      trim: true
    },

    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        "Invalid email",
      ],
    },

    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 6,
      select: false
    },

    role: {
      type: String,
      enum: ['admin', 'owner', 'user'],
      default: 'user'
    },

    status: {
      type: String,
      enum: ["active", "inactive", "suspended"],
      default: "active"
    },
    department: {
      type: String,
      enum: [
        "management",
        "administration",
        "hr",
        "finance",
        "accounting",
        "sales",
        "purchasing",
        "marketing",
        "production",
        "production_planning",
        "quality_control",
        "maintenance",
        "warehouse",
        "logistics",
        "procurement",
        "engineering",
        "design",
        "research_development",
        "it",
        "customer_service",
        "administration",
        "health_safety_environment",
        "security"
      ],
      default: "administration"
    }

  },
  { timestamps: true }
);

// Hash password before save
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Indexes for faster queries.
// `email` already gets a unique index from `unique: true` above,
// so no need to declare it again here (that used to create a
// duplicate index on the same field).
// These support the Users admin screen: filtering by role/status/
// department, and the default "most recent first" list sort.
userSchema.index({ role: 1 });
userSchema.index({ status: 1 });
userSchema.index({ department: 1 });
userSchema.index({ createdAt: -1 });
// Supports name search/sort ("lastName firstName" ordering).
userSchema.index({ lastName: 1, firstName: 1 });

module.exports = mongoose.model('User', userSchema);
