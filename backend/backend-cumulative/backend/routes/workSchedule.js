const express = require("express");
const mongoose = require("mongoose");

const router = express.Router();

const WorkSchedule = require("../models/WorkSchedule");
const Company = require("../models/Company");
const Department = require("../models/Department");

const auth = require("../middleware/auth");
const { guard } = require("../middleware/permissionGuard");
const { ROUTE_PERMISSIONS } = require("../config/routePermissions");
const { canManageCompany } = require("../permissions/permissions");
const { hasAny } = require("../services/permissionService");
const { logAudit } = require("../services/auditLogger");
const { defaultSchedule } = require("../services/scheduleResolver");

/**
 * ============================================================
 * WORK SCHEDULES — /api/work-schedule
 * ============================================================
 * A company has as many named schedules as it needs ("Bureaux —
 * journée continue", "Atelier — horaire coupé", "Samedi demi-journée",
 * "Ramadan"…). Each day of a schedule is continuous or split (midday
 * break), or a day off; a half day is simply a shorter day. Each
 * department follows one schedule (Department.workSchedule); the
 * default schedule applies to every department without one.
 *
 * GET    /list?companyId=           every schedule + the company's departments
 * GET    /?companyId=               the default schedule (older screens)
 * POST   /                          { companyId, name, copyFrom? } new schedule
 * PUT    /                          { companyId, days…, hoursManagement } update the default (older screens)
 * PUT    /:id                       { name?, days…, hoursManagement? }
 * PATCH  /:id/default               make it the default
 * PUT    /:id/departments           { departmentIds } the departments following it
 * DELETE /:id                       (not the default; its departments go back to the default)
 * ============================================================
 */
// Fine-grained permissions of every endpoint: config/routePermissions.js
router.use(auth, guard(ROUTE_PERMISSIONS.workSchedule));

const isId = (v) => mongoose.Types.ObjectId.isValid(String(v || ""));
const bad = (res, message, status = 400) => res.status(status).json({ success: false, message });
const canRead = (req, company) => canManageCompany(req.user, company) || hasAny(req.user, ["organization.schedule.edit", "hr.attendance.view", "organization.departments.view"]);
const canWrite = (req, company) => canManageCompany(req.user, company) || hasAny(req.user, ["organization.schedule.edit"]);
const DAY_KEYS = WorkSchedule.DAY_KEYS;

async function companyOf(req, res, id, write = false) {
  if (!isId(id)) { bad(res, "companyId is required"); return null; }
  const company = await Company.findById(id);
  if (!company) { bad(res, "Company not found", 404); return null; }
  if (!(write ? canWrite(req, company) : canRead(req, company))) { bad(res, "Not authorized", 403); return null; }
  return company;
}

/** The days / hours policy fields of a request body, cleaned. */
function cleanDays(body) {
  const num = (v, fallback = 0) => (v === undefined || v === null || v === "" || !Number.isFinite(Number(v)) ? fallback : Number(v));
  const update = {};
  // Every day field — including the split-shift ones (a day of a split
  // schedule can itself be continuous, e.g. a Saturday half day).
  for (const day of DAY_KEYS) {
    const d = body[day];
    if (!d) continue;
    update[day] = {
      isWorkingDay: !!d.isWorkingDay,
      startHour: num(d.startHour),
      startMinute: num(d.startMinute),
      endHour: d.endHour === undefined || d.endHour === null || d.endHour === "" ? null : num(d.endHour),
      endMinute: num(d.endMinute),
      workHours: num(d.workHours),
      graceMinutes: num(d.graceMinutes),
      splitShift: !!d.splitShift,
      breakStartHour: num(d.breakStartHour, 12),
      breakStartMinute: num(d.breakStartMinute),
      breakEndHour: num(d.breakEndHour, 14),
      breakEndMinute: num(d.breakEndMinute),
    };
  }
  const hm = body.hoursManagement;
  if (hm) {
    update.hoursManagement = {
      payOvertime: !!hm.payOvertime,
      overtimeRate: Number(hm.overtimeRate) || 1.25,
      deductLateArrival: !!hm.deductLateArrival,
      deductEarlyLeave: !!hm.deductEarlyLeave,
      deductionRate: Number(hm.deductionRate) || 1,
      monthlyStandardHours: Number(hm.monthlyStandardHours) || 191,
    };
  }
  return update;
}

/** save() (not an update query) so the model's validate hook checks the times. */
async function saveSchedule(res, schedule) {
  try {
    await schedule.save();
    return true;
  } catch (error) {
    if (error.name === "ValidationError") { bad(res, Object.values(error.errors)[0].message); return false; }
    if (error.code === 11000) { bad(res, "A schedule with this name already exists", 409); return false; }
    throw error;
  }
}

/** Names are unique per company (case-insensitive). */
async function nameTaken(companyId, name, selfId = null) {
  const rx = new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
  const filter = { company: companyId, name: rx };
  if (selfId) filter._id = { $ne: selfId };
  return !!(await WorkSchedule.exists(filter));
}

async function listPayload(companyId) {
  await defaultSchedule(companyId); // makes sure there's one (and that it's flagged)
  const [schedules, departments] = await Promise.all([
    WorkSchedule.find({ company: companyId }).sort({ isDefault: -1, name: 1 }),
    Department.find({ company: companyId }).select("name workSchedule").sort({ name: 1 }).lean(),
  ]);
  return { schedules, departments };
}

// ---------------- list ----------------
router.get("/list", async (req, res) => {
  try {
    const company = await companyOf(req, res, req.query.companyId);
    if (!company) return;
    res.json({ success: true, data: await listPayload(company._id) });
  } catch (error) {
    console.error("GET work schedules error:", error);
    res.status(500).json({ success: false, message: "Error fetching work schedules", error: error.message });
  }
});

// ---------------- the default one (older screens) ----------------
router.get("/", async (req, res) => {
  try {
    const company = await companyOf(req, res, req.query.companyId);
    if (!company) return;
    res.json({ success: true, data: await defaultSchedule(company._id) });
  } catch (error) {
    console.error("GET work schedule error:", error);
    res.status(500).json({ success: false, message: "Error fetching work schedule", error: error.message });
  }
});

router.put("/", async (req, res) => {
  try {
    const company = await companyOf(req, res, req.body.companyId, true);
    if (!company) return;
    const schedule = await defaultSchedule(company._id);
    schedule.set({ ...cleanDays(req.body), updatedBy: req.user.id });
    if (!(await saveSchedule(res, schedule))) return;
    await logAudit(req, { company: company._id, action: "update", resourceType: "WorkSchedule", resourceId: schedule._id, resourceLabel: schedule.name });
    res.json({ success: true, data: schedule, message: "Work schedule updated successfully" });
  } catch (error) {
    console.error("PUT work schedule error:", error);
    res.status(500).json({ success: false, message: "Error updating work schedule", error: error.message });
  }
});

// ---------------- create ----------------
router.post("/", async (req, res) => {
  try {
    const company = await companyOf(req, res, req.body.companyId, true);
    if (!company) return;
    const name = String(req.body.name || "").trim();
    if (!name) return bad(res, "Give the schedule a name");
    await defaultSchedule(company._id);
    if (await nameTaken(company._id, name)) return bad(res, "A schedule with this name already exists", 409);
    let base = {};
    if (req.body.copyFrom && isId(req.body.copyFrom)) {
      const src = await WorkSchedule.findOne({ _id: req.body.copyFrom, company: company._id }).lean();
      if (src) {
        for (const day of DAY_KEYS) base[day] = src[day];
        base.hoursManagement = src.hoursManagement;
      }
    }
    const schedule = new WorkSchedule({ ...base, ...cleanDays(req.body), company: company._id, name, isDefault: false, updatedBy: req.user.id });
    if (!(await saveSchedule(res, schedule))) return;
    await logAudit(req, { company: company._id, action: "create", resourceType: "WorkSchedule", resourceId: schedule._id, resourceLabel: name });
    res.status(201).json({ success: true, data: schedule, message: "Schedule created" });
  } catch (error) {
    console.error("POST work schedule error:", error);
    res.status(500).json({ success: false, message: "Error creating the schedule", error: error.message });
  }
});

async function loadSchedule(req, res, write = true) {
  if (!isId(req.params.id)) { bad(res, "Invalid schedule"); return null; }
  const schedule = await WorkSchedule.findById(req.params.id);
  if (!schedule) { bad(res, "Schedule not found", 404); return null; }
  const company = await companyOf(req, res, schedule.company, write);
  return company ? schedule : null;
}

// ---------------- update ----------------
router.put("/:id", async (req, res) => {
  try {
    const schedule = await loadSchedule(req, res);
    if (!schedule) return;
    const update = cleanDays(req.body);
    if (req.body.name !== undefined) {
      const name = String(req.body.name || "").trim();
      if (!name) return bad(res, "Give the schedule a name");
      if (await nameTaken(schedule.company, name, schedule._id)) return bad(res, "A schedule with this name already exists", 409);
      update.name = name;
    }
    schedule.set({ ...update, updatedBy: req.user.id });
    if (!(await saveSchedule(res, schedule))) return;
    await logAudit(req, { company: schedule.company, action: "update", resourceType: "WorkSchedule", resourceId: schedule._id, resourceLabel: schedule.name });
    res.json({ success: true, data: schedule, message: "Work schedule updated successfully" });
  } catch (error) {
    console.error("PUT work schedule error:", error);
    res.status(500).json({ success: false, message: "Error updating work schedule", error: error.message });
  }
});

// ---------------- make default ----------------
router.patch("/:id/default", async (req, res) => {
  try {
    const schedule = await loadSchedule(req, res);
    if (!schedule) return;
    await WorkSchedule.updateMany({ company: schedule.company, _id: { $ne: schedule._id } }, { $set: { isDefault: false } });
    schedule.isDefault = true;
    await schedule.save();
    await logAudit(req, { company: schedule.company, action: "update", resourceType: "WorkSchedule", resourceId: schedule._id, resourceLabel: `${schedule.name} → par défaut` });
    res.json({ success: true, data: await listPayload(schedule.company) });
  } catch (error) {
    console.error("PATCH default schedule error:", error);
    res.status(500).json({ success: false, message: "Error updating the schedule", error: error.message });
  }
});

// ---------------- departments following it ----------------
router.put("/:id/departments", async (req, res) => {
  try {
    const schedule = await loadSchedule(req, res);
    if (!schedule) return;
    const ids = (Array.isArray(req.body.departmentIds) ? req.body.departmentIds : []).filter(isId).map(String);
    const found = await Department.find({ _id: { $in: ids }, company: schedule.company }).select("_id").lean();
    if (found.length !== ids.length) return bad(res, "Unknown department");
    // Departments no longer ticked go back to the default schedule.
    await Department.updateMany({ company: schedule.company, workSchedule: schedule._id, _id: { $nin: ids } }, { $set: { workSchedule: null } });
    // The default schedule applies without being assigned: ticking it just clears their own.
    await Department.updateMany({ _id: { $in: ids }, company: schedule.company }, { $set: { workSchedule: schedule.isDefault ? null : schedule._id } });
    await logAudit(req, { company: schedule.company, action: "update", resourceType: "WorkSchedule", resourceId: schedule._id, resourceLabel: `${schedule.name} → ${ids.length} département(s)` });
    res.json({ success: true, data: await listPayload(schedule.company) });
  } catch (error) {
    console.error("PUT schedule departments error:", error);
    res.status(500).json({ success: false, message: "Error assigning the schedule", error: error.message });
  }
});

// ---------------- delete ----------------
router.delete("/:id", async (req, res) => {
  try {
    const schedule = await loadSchedule(req, res);
    if (!schedule) return;
    if (schedule.isDefault) return bad(res, "The default schedule can't be deleted — make another one the default first");
    await Department.updateMany({ company: schedule.company, workSchedule: schedule._id }, { $set: { workSchedule: null } });
    await schedule.deleteOne();
    await logAudit(req, { company: schedule.company, action: "delete", resourceType: "WorkSchedule", resourceId: schedule._id, resourceLabel: schedule.name });
    res.json({ success: true, data: await listPayload(schedule.company) });
  } catch (error) {
    console.error("DELETE work schedule error:", error);
    res.status(500).json({ success: false, message: "Error deleting the schedule", error: error.message });
  }
});

module.exports = router;
