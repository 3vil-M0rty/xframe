const express = require("express");
const mongoose = require("mongoose");
const auth = require("../middleware/auth");
const { runAsSystem } = require("../services/tenantScope");
const Tenant = require("../models/Tenant");
const Company = require("../models/Company");
const User = require("../models/User");
const Employee = require("../models/Employee");

/**
 * ============================================================
 * PLATFORM (operator) ROUTES — /api/platform
 * ============================================================
 * For the platform operator (role platform_admin) only: create
 * clients, give them their first admin account, suspend/reactivate
 * them, and attach records left without a client.
 *
 * Deliberately NOT here: any client business data (employees,
 * salaries, purchasing...). The operator sees counts and the
 * client's admin accounts — enough to support a client, not to read
 * its HR files. Every query below runs as "system" explicitly,
 * because the platform context itself sees no client data.
 * ============================================================
 */

const router = express.Router();

function requirePlatformAdmin(req, res, next) {
  if (req.user?.role !== "platform_admin") {
    return res.status(403).json({ success: false, message: "Platform administrators only" });
  }
  return next();
}

router.use(auth, requirePlatformAdmin);

const isId = (v) => mongoose.Types.ObjectId.isValid(String(v || ""));
const EMAIL_RX = /^\S+@\S+\.\S+$/;

function adminView(u) {
  return {
    _id: u._id,
    firstName: u.firstName,
    lastName: u.lastName,
    email: u.email,
    role: u.role,
    status: u.status,
    createdAt: u.createdAt,
  };
}

async function tenantSummary(tenant) {
  const companyIds = (await Company.find({ tenant: tenant._id }).select("_id").lean()).map((c) => c._id);
  const [users, employees, companies] = await Promise.all([
    User.countDocuments({ tenant: tenant._id }),
    companyIds.length ? Employee.countDocuments({ company: { $in: companyIds } }) : 0,
    Company.find({ tenant: tenant._id }).select("name").sort({ name: 1 }).lean(),
  ]);
  return {
    _id: tenant._id,
    name: tenant.name,
    status: tenant.status,
    notes: tenant.notes || "",
    createdAt: tenant.createdAt,
    counts: { companies: companies.length, users, employees },
    companies: companies.map((c) => ({ _id: c._id, name: c.name })),
  };
}

/** Validates and creates an admin account for a client. Returns { error } or { user }. */
async function createClientAdmin(tenantId, body) {
  const { firstName, lastName, email, password } = body || {};
  if (!firstName || !lastName || !email || !password) {
    return { error: "First name, last name, email and password are required for the admin account" };
  }
  if (!EMAIL_RX.test(email)) return { error: "Invalid email" };
  if (String(password).length < 8) return { error: "The password must be at least 8 characters" };
  const normalized = String(email).trim().toLowerCase();
  if (await User.exists({ email: normalized })) return { error: "A user with this email already exists" };
  const user = await User.create({
    firstName: String(firstName).trim(),
    lastName: String(lastName).trim(),
    email: normalized,
    password,
    role: "admin",
    status: "active",
    tenant: tenantId,
  });
  return { user };
}

// ------------------------------------------------------------
// GET /api/platform/tenants — every client with its counts
// ------------------------------------------------------------
router.get("/tenants", async (req, res) => {
  try {
    const data = await runAsSystem(async () => {
      const tenants = await Tenant.find().sort({ createdAt: -1 }).lean();
      return Promise.all(tenants.map(tenantSummary));
    });
    res.json({ success: true, data });
  } catch (error) {
    console.error("Platform list tenants error:", error);
    res.status(500).json({ success: false, message: "Error loading clients" });
  }
});

// ------------------------------------------------------------
// GET /api/platform/tenants/:id — one client + its admin accounts
// ------------------------------------------------------------
router.get("/tenants/:id", async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid client id" });
    const data = await runAsSystem(async () => {
      const tenant = await Tenant.findById(req.params.id).lean();
      if (!tenant) return null;
      const admins = await User.find({ tenant: tenant._id, role: { $in: ["admin", "owner"] } })
        .select("firstName lastName email role status createdAt")
        .sort({ createdAt: 1 })
        .lean();
      return { ...(await tenantSummary(tenant)), admins: admins.map(adminView) };
    });
    if (!data) return res.status(404).json({ success: false, message: "Client not found" });
    res.json({ success: true, data });
  } catch (error) {
    console.error("Platform get tenant error:", error);
    res.status(500).json({ success: false, message: "Error loading client" });
  }
});

// ------------------------------------------------------------
// POST /api/platform/tenants — create a client + its first admin
// body: { name, notes?, admin: { firstName, lastName, email, password } }
// ------------------------------------------------------------
router.post("/tenants", async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();
    if (!name) return res.status(400).json({ success: false, message: "Client name is required" });

    const result = await runAsSystem(async () => {
      const tenant = await Tenant.create({ name, notes: req.body.notes, createdBy: req.user.id });
      const { error, user } = await createClientAdmin(tenant._id, req.body.admin);
      if (error) {
        // No half-created client without anyone able to log in.
        await Tenant.deleteOne({ _id: tenant._id });
        return { error };
      }
      return { tenant, admin: user };
    });
    if (result.error) return res.status(400).json({ success: false, message: result.error });

    res.status(201).json({
      success: true,
      message: "Client created",
      data: { tenant: result.tenant, admin: adminView(result.admin) },
    });
  } catch (error) {
    console.error("Platform create tenant error:", error);
    res.status(error.name === "ValidationError" ? 400 : 500).json({ success: false, message: error.message || "Error creating client" });
  }
});

// ------------------------------------------------------------
// PATCH /api/platform/tenants/:id — rename, notes, suspend/reactivate
// ------------------------------------------------------------
router.patch("/tenants/:id", async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid client id" });
    const set = {};
    if (req.body.name !== undefined) set.name = String(req.body.name).trim();
    if (req.body.notes !== undefined) set.notes = String(req.body.notes);
    if (req.body.status !== undefined) {
      if (!["active", "suspended"].includes(req.body.status)) {
        return res.status(400).json({ success: false, message: "Invalid status" });
      }
      set.status = req.body.status;
    }
    if (set.name === "") return res.status(400).json({ success: false, message: "Client name is required" });

    const tenant = await runAsSystem(() =>
      Tenant.findByIdAndUpdate(req.params.id, { $set: set }, { new: true, runValidators: true })
    );
    if (!tenant) return res.status(404).json({ success: false, message: "Client not found" });
    res.json({ success: true, message: "Client updated", data: tenant });
  } catch (error) {
    console.error("Platform update tenant error:", error);
    res.status(500).json({ success: false, message: "Error updating client" });
  }
});

// ------------------------------------------------------------
// POST /api/platform/tenants/:id/admins — another admin account
// (e.g. the client's only admin left the company)
// ------------------------------------------------------------
router.post("/tenants/:id/admins", async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid client id" });
    const result = await runAsSystem(async () => {
      const tenant = await Tenant.findById(req.params.id).select("_id").lean();
      if (!tenant) return { notFound: true };
      return createClientAdmin(tenant._id, req.body);
    });
    if (result.notFound) return res.status(404).json({ success: false, message: "Client not found" });
    if (result.error) return res.status(400).json({ success: false, message: result.error });
    res.status(201).json({ success: true, message: "Admin account created", data: adminView(result.user) });
  } catch (error) {
    console.error("Platform create admin error:", error);
    res.status(500).json({ success: false, message: "Error creating admin account" });
  }
});

// ------------------------------------------------------------
// GET /api/platform/orphans — companies/accounts with no client
// POST /api/platform/orphans/assign — { tenantId, companyIds[], userIds[] }
// Only needed if data existed from before client isolation and could
// not be attached automatically (see services/tenantService.js).
// ------------------------------------------------------------
const ORPHAN = { $or: [{ tenant: null }, { tenant: { $exists: false } }] };

router.get("/orphans", async (req, res) => {
  try {
    const data = await runAsSystem(async () => {
      const [companies, users] = await Promise.all([
        Company.find(ORPHAN).select("name createdAt").lean(),
        User.find({ ...ORPHAN, role: { $ne: "platform_admin" } }).select("firstName lastName email role").lean(),
      ]);
      return { companies, users: users.map(adminView) };
    });
    res.json({ success: true, data });
  } catch (error) {
    console.error("Platform orphans error:", error);
    res.status(500).json({ success: false, message: "Error loading unattached records" });
  }
});

router.post("/orphans/assign", async (req, res) => {
  try {
    const { tenantId } = req.body || {};
    const companyIds = [].concat(req.body?.companyIds || []).filter(isId);
    const userIds = [].concat(req.body?.userIds || []).filter(isId);
    if (!isId(tenantId)) return res.status(400).json({ success: false, message: "Choose a client" });

    const result = await runAsSystem(async () => {
      if (!(await Tenant.exists({ _id: tenantId }))) return null;
      // Only records that are STILL unattached — this can never move a
      // company or account from one client to another.
      const c = await Company.updateMany({ _id: { $in: companyIds }, ...ORPHAN }, { $set: { tenant: tenantId } });
      const u = await User.updateMany(
        { _id: { $in: userIds }, role: { $ne: "platform_admin" }, ...ORPHAN },
        { $set: { tenant: tenantId } }
      );
      return { companies: c.modifiedCount, users: u.modifiedCount };
    });
    if (!result) return res.status(404).json({ success: false, message: "Client not found" });
    res.json({ success: true, message: "Records attached", data: result });
  } catch (error) {
    console.error("Platform assign orphans error:", error);
    res.status(500).json({ success: false, message: "Error attaching records" });
  }
});

module.exports = router;
