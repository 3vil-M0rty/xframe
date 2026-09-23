const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Department = require('../models/Department');

/**
 * ============================================================
 * AUTH MIDDLEWARE
 * ============================================================
 * The token only proves WHO is calling (its `id`). Everything that
 * decides WHAT they may do — role, department, hrRole, linked
 * employee, account status — is read fresh from the database on
 * every request.
 *
 * Why not just trust the token's own claims (as this used to):
 *
 * 1. Stale permissions. A login token lives 7 days. If an admin
 *    changed someone's department to "hr", or linked them to an HR
 *    employee (which re-derives department/hrRole — see
 *    services/employeeAccountService.js), the frontend showed HR
 *    menus immediately (it reloads the user from /users/me) while
 *    the backend kept treating them as non-HR until they logged out
 *    and back in. Visible symptom: an HR account opening Employees
 *    and seeing an EMPTY company dropdown, because GET /companies
 *    fell back to "only companies you own".
 *
 * 2. hrRole was never in the token at all, so on the backend every
 *    HR user's tier was undefined — which permissions.js treats as
 *    full Responsable-RH authority for backward compatibility. The
 *    HR tier hierarchy (assistant/officer/manager/director) wasn't
 *    actually being enforced server-side.
 *
 * 3. Suspended/deactivated accounts kept full access until their
 *    token expired.
 *
 * Cost: one indexed findById per request, projecting only the few
 * fields below and using .lean() — negligible next to the route's
 * own queries.
 *
 * req.user keeps the exact shape routes already rely on (id as a
 * string, plus email/role/department/employee), with hrRole added.
 * ============================================================
 */

const BLOCKED_STATUSES = new Set(['inactive', 'suspended']);

const auth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      return res.status(401).json({ message: 'Invalid token', error: error.message });
    }

    // The short-lived 2FA challenge token (see controllers/
    // authController.js) is signed with the same secret but only
    // proves the PASSWORD step — it must never work as a session
    // token, or anyone with a password could skip the 2FA code by
    // calling the API directly with it.
    if (decoded.purpose) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    const user = await User.findById(decoded.id)
      .select('email role department hrRole employee status')
      .lean();

    if (!user) {
      return res.status(401).json({ message: 'Account no longer exists' });
    }

    if (BLOCKED_STATUSES.has(user.status)) {
      return res.status(401).json({ message: 'This account has been deactivated' });
    }

    // Departments this person runs (Department.manager) — powers the
    // department-wide approval rights in permissions/permissions.js
    // and the "My department" page. Only looked up for accounts
    // linked to an employee, since only employees can manage one.
    const managedDepartments = user.employee
      ? (await Department.find({ manager: user.employee }).select('_id').lean()).map((d) => String(d._id))
      : [];

    req.user = {
      id: String(user._id),
      email: user.email,
      role: user.role,
      department: user.department,
      hrRole: user.hrRole,
      employee: user.employee ? String(user.employee) : null,
      managedDepartments,
    };

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ message: 'Authentication check failed' });
  }
};

module.exports = auth;
