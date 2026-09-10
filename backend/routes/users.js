const express = require("express");
const router = express.Router();

const User = require("../models/User");
const auth = require("../middleware/auth");
const {
  ROLES,
  canCreateUser,
  canManageUser,
  canDeleteUser,
  userListFilter,
} = require("../permissions/permissions");

// ============================================================
// GET CURRENT USER
// GET /api/users/me
// ============================================================

router.get("/me", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error fetching user",
      error: error.message,
    });
  }
});

// ============================================================
// GET ALL USERS
// GET /api/users
// Admin/owner see everyone. Everyone else is scoped down by
// userListFilter (today: just themselves; once the "user can
// manage their own department" feature is switched on, this
// automatically becomes "everyone in my department").
//
// Supports the same query params as GET /api/employees so the
// frontend can keep card grids paginated (and therefore fast)
// instead of always fetching the entire user list:
//   - search: matches first/last name or email (case-insensitive)
//   - role / status / department: exact-match filters
//   - page / limit: pagination (defaults to page 1, 20 per page)
// ============================================================

router.get("/", auth, async (req, res) => {
  try {
    const {
      search,
      role,
      status,
      department,
      page = 1,
      limit = 20,
    } = req.query;

    const filter = {
      ...userListFilter(req.user),
    };

    if (role) {
      filter.role = role;
    }

    if (status) {
      filter.status = status;
    }

    if (department) {
      filter.department = department;
    }

    if (search) {
      filter.$or = [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const currentPage = Math.max(Number(page) || 1, 1);
    const currentLimit = Math.max(Number(limit) || 20, 1);
    const skip = (currentPage - 1) * currentLimit;

    const [users, total] = await Promise.all([
      User.find(filter)
        .select("-password")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(currentLimit),

      User.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: users,
      pagination: {
        total,
        page: currentPage,
        limit: currentLimit,
        pages: Math.ceil(total / currentLimit) || 1,
      },
    });
  } catch (error) {
    res.status(500).json({
      message: "Error fetching users",
      error: error.message,
    });
  }
});

// ============================================================
// CREATE USER
// POST /api/users
// Only admin/owner may create users today. canCreateUser()
// already encodes the future "department-scoped user" rule,
// so this handler doesn't need to change when that ships —
// only the ALLOW_DEPARTMENT_SCOPED_USER_MANAGEMENT flag in
// permissions/permissions.js does.
// ============================================================

router.post("/", auth, async (req, res) => {
  try {
    let {
      firstName,
      lastName,
      email,
      password,
      role,
      status,
      department,
    } = req.body;

    role = role || ROLES.USER;
    department = department || "administration";

    // --------------------------------------------------------
    // Authorization
    // --------------------------------------------------------

    if (!canCreateUser(req.user, role, department)) {
      return res.status(403).json({
        message:
          "You do not have permission to create a user with this role or department",
      });
    }

    // A department-scoped "user" creator (future) is always
    // pinned to their own department and can only ever create
    // role "user" accounts, no matter what the client sends.
    if (req.user.role === ROLES.USER) {
      role = ROLES.USER;
      department = req.user.department;
    }

    // --------------------------------------------------------
    // Validate required fields
    // --------------------------------------------------------

    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({
        message:
          "Please provide firstName, lastName, email, and password",
      });
    }

    // --------------------------------------------------------
    // Check if email already exists
    // --------------------------------------------------------

    const existingUser = await User.findOne({
      email: email.toLowerCase(),
    });

    if (existingUser) {
      return res.status(400).json({
        message: "A user with this email already exists",
      });
    }

    // --------------------------------------------------------
    // Create user
    // --------------------------------------------------------

    const user = await User.create({
      firstName,
      lastName,
      email: email.toLowerCase(),
      password,
      role,
      status: status || "active",
      department,
    });

    // --------------------------------------------------------
    // Remove password from response
    // --------------------------------------------------------

    const userResponse = user.toObject();

    delete userResponse.password;

    // --------------------------------------------------------
    // Response
    // --------------------------------------------------------

    res.status(201).json({
      success: true,
      data: userResponse,
      message: "User created successfully",
    });
  } catch (error) {
    console.error("Create user error:", error);

    res.status(500).json({
      message: "Error creating user",
      error: error.message,
    });
  }
});

// ============================================================
// GET USER BY ID
// GET /api/users/:id
// ============================================================

router.get("/:id", auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    if (!canManageUser(req.user, user)) {
      return res.status(403).json({
        message: "Not authorized to view this user",
      });
    }

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error fetching user",
      error: error.message,
    });
  }
});

// ============================================================
// UPDATE USER
// PUT /api/users/:id
// ============================================================

router.put("/:id", auth, async (req, res) => {
  try {
    const target = await User.findById(req.params.id);

    if (!target) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    // User can update themselves. Admin/owner can update anyone.
    // (Future) a department-scoped "user" can update other
    // "user"-role accounts in their own department.
    if (!canManageUser(req.user, target)) {
      return res.status(403).json({
        message: "Not authorized to update this user",
      });
    }

    const {
      firstName,
      lastName,
      email,
    } = req.body;

    let { role, status, department } = req.body;

    // --------------------------------------------------------
    // Only admin/owner may change role/department/status.
    // Everyone else (including someone editing their own
    // profile) keeps their existing values — this prevents a
    // self-service privilege escalation to "admin".
    // --------------------------------------------------------

    if (req.user.role !== ROLES.ADMIN && req.user.role !== ROLES.OWNER) {
      role = target.role;
      status = target.status;
      department = target.department;
    }

    // --------------------------------------------------------
    // Validate required fields
    // --------------------------------------------------------

    if (!firstName || !lastName || !email) {
      return res.status(400).json({
        message:
          "Please provide firstName, lastName, and email",
      });
    }

    // --------------------------------------------------------
    // Update user
    // --------------------------------------------------------

    const user = await User.findByIdAndUpdate(
      req.params.id,
      {
        firstName,
        lastName,
        email: email.toLowerCase(),
        role,
        status,
        department,
        updatedAt: Date.now(),
      },
      {
        new: true,
        runValidators: true,
      }
    ).select("-password");

    res.json({
      success: true,
      data: user,
      message: "User updated successfully",
    });
  } catch (error) {
    console.error("Update user error:", error);

    res.status(500).json({
      message: "Error updating user",
      error: error.message,
    });
  }
});

// ============================================================
// CHANGE PASSWORD
// PUT /api/users/:id/password
// ============================================================

router.put("/:id/password", auth, async (req, res) => {
  try {
    // Only the user themselves can change their password

    if (req.user.id !== req.params.id) {
      return res.status(403).json({
        message: "Not authorized to change this password",
      });
    }

    const {
      currentPassword,
      newPassword,
    } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        message:
          "Please provide current and new password",
      });
    }

    const user = await User.findById(req.params.id)
      .select("+password");

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const isPasswordCorrect =
      await user.comparePassword(currentPassword);

    if (!isPasswordCorrect) {
      return res.status(401).json({
        message: "Current password is incorrect",
      });
    }

    user.password = newPassword;

    await user.save();

    res.json({
      success: true,
      message: "Password updated successfully",
    });
  } catch (error) {
    res.status(500).json({
      message: "Error changing password",
      error: error.message,
    });
  }
});

// ============================================================
// DELETE USER
// DELETE /api/users/:id
// Authorization is fully delegated to canDeleteUser() so this
// route doesn't need to change when department-scoped "user"
// deletion is switched on — see permissions/permissions.js.
// ============================================================

router.delete("/:id", auth, async (req, res) => {
  try {
    const target = await User.findById(req.params.id);

    if (!target) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    if (!canDeleteUser(req.user, target)) {
      return res.status(403).json({
        message: "Not authorized to delete this user",
      });
    }

    await User.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      message: "Error deleting user",
      error: error.message,
    });
  }
});

module.exports = router;
