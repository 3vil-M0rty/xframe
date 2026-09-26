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

    // The client (tenant) this account belongs to. null only for
    // platform_admin accounts (the platform operator), which belong
    // to no client. See services/tenantScope.js.
    tenant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      default: null,
      index: true
    },

    role: {
      type: String,
      enum: ['admin', 'owner', 'user', 'platform_admin'],
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
    },

    // =========================================================
    // HR JOB HIERARCHY (only meaningful when department === "hr")
    // =========================================================
    // The real, named hierarchy inside an HR department — not just
    // "has HR access or doesn't". Ordered lowest to highest
    // authority; see permissions/permissions.js (HR_ROLE_HIERARCHY,
    // hasHRRoleAtLeast) for what each tier can actually do:
    //   assistant -> officer -> manager -> director
    // Left unset for any account that isn't in the "hr" department
    // (admin, owner, and every other department's users). An "hr"
    // department account with no hrRole set (e.g. one created
    // before this field existed) is treated as "manager" by
    // permissions.js's hrRoleLevel() — full operational HR
    // authority — so introducing this tiering never silently locks
    // an existing HR user out of something they could already do.
    hrRole: {
      type: String,
      enum: ["hr_assistant", "hr_officer", "hr_manager", "hr_director"],
      default: undefined,
    },

    // =========================================================
    // TWO-FACTOR AUTHENTICATION (TOTP)
    // =========================================================
    // `secret` is the base32 TOTP seed — select: false so a normal
    // User.find()/findById() never accidentally includes it in an
    // API response; routes/twoFactor.js explicitly .select("+twoFactor.secret")
    // only where it actually needs to verify a code. `enabled`
    // stays false while `secret` is set but not yet confirmed (the
    // setup flow generates a secret first, then only flips this to
    // true once the user proves they can generate a matching code —
    // see routes/twoFactor.js's /verify-setup). Backup codes are
    // stored bcrypt-hashed, exactly like the password, and each is
    // single-use (`used` flips true the moment it's redeemed).
    twoFactor: {
      enabled: { type: Boolean, default: false },
      secret: { type: String, select: false },
      backupCodes: {
        type: [
          {
            codeHash: { type: String, required: true },
            used: { type: Boolean, default: false },
          },
        ],
        select: false,
        default: undefined,
      },
      enabledAt: { type: Date },
    },

    // =========================================================
    // EMPLOYEE SELF-SERVICE LINK
    // =========================================================
    // When set, this login "belongs to" that Employee record —
    // it's what powers the self-service space (My Payslips, My
    // Absences, My Advances, My Leave Balance) and manager-based
    // approval routing (an employee's manager, if that manager
    // also has a linked User account, can review that specific
    // employee's absence/advance requests — see
    // permissions/permissions.js: canReviewAbsence/canReviewAdvance).
    // Optional — plenty of accounts (admin, owner, HR-only staff
    // with no Employee record of their own) will leave this null.
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      default: null,
    },

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
// Supports self-service lookups ("find the User account linked to
// this Employee") and manager-approval routing.
userSchema.index({ employee: 1 });

// A client's admin can never create or promote a platform operator
// account — platform_admin only exists outside every client.
function refusePlatformRole(role) {
  const ctx = require('../services/tenantScope').current();
  if (role === 'platform_admin' && ctx && ctx.kind === 'tenant') {
    const err = new Error('Invalid role');
    err.status = 403;
    throw err;
  }
}
userSchema.pre('validate', function () {
  if (this.isModified('role')) refusePlatformRole(this.role);
});
userSchema.pre(['findOneAndUpdate', 'updateOne', 'updateMany'], function () {
  const u = this.getUpdate() || {};
  refusePlatformRole(u.role);
  refusePlatformRole(u.$set && u.$set.role);
});

module.exports = mongoose.model('User', userSchema);
