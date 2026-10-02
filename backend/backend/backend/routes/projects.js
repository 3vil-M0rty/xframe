const express = require("express");
const Project = require("../models/Project");
const ProjectTask = require("../models/ProjectTask");
const TimeEntry = require("../models/TimeEntry");
const Customer = require("../models/Customer");
const Company = require("../models/Company");
const Employee = require("../models/Employee");
const Product = require("../models/Product");
const InventoryMovement = require("../models/InventoryMovement");
const PurchaseOrder = require("../models/PurchaseOrder");
const SalesInvoice = require("../models/SalesInvoice");
const auth = require("../middleware/auth");
const { guard } = require("../middleware/permissionGuard");
const { ROUTE_PERMISSIONS } = require("../config/routePermissions");
const { requireProjectsView } = require("../middleware/permissionMiddleware");
const { canSeeFinancials } = require("../permissions/permissions");
const { hideMoney, dropMoneyInput } = require("../middleware/hideMoney");
const { isId, bad, validationMessage } = require("../utils/salesHelpers");
const { createWithNumber } = require("../services/documentNumberService");
const { projectFinancials, hourlyCostFor } = require("../services/projectCosts");
const { applyMovement } = require("../services/inventoryService");
const { logAudit } = require("../services/auditLogger");
const ChassisModel = require("../models/ChassisModel");
const Finish = require("../models/Finish");
const ProductionOrder = require("../models/ProductionOrder");
const { loadContext, computeProjectPlan, createOrdersForProject } = require("../services/productionPlanning");
const { describeChassis } = require("../services/chassisBom");
const notifications = require("../services/businessNotifications");
const tracking = require("../services/trackingService");
const { projectCutting } = require("../services/cuttingData");
const { missingGlass } = require("../services/glassCheck");
const { generateCuttingPdf, SECTIONS } = require("../services/cuttingPdfService");
const { fetchLogoBuffer } = require("../services/pdfHelpers");

/**
 * ============================================================
 * PROJECTS (affaires / chantiers) — /api/projects
 * ============================================================
 * View: production + sales. Change: production (and owners).
 *
 * GET    /?companyId=&status=&customer=&search=     list with progress & margin
 * GET    /planning?companyId=&from=&to=             every task in the period (timeline)
 * GET    /:id                                       project + costs + tasks + hours + materials…
 * POST   /  · PUT /:id · PATCH /:id/status · DELETE /:id (nothing recorded yet)
 * POST   /:id/tasks · PUT /tasks/:taskId · DELETE /tasks/:taskId
 * POST   /:id/time { employee, date, hours, task?, notes } · DELETE /time/:entryId
 * POST   /:id/materials { product, quantity, unitCost?, direction: "out"|"return" }
 * POST   /:id/expenses { date, label, amount } · DELETE /:id/expenses/:expenseId
 * Aluminium joinery (ouvrages → work orders):
 * POST   /:id/items { model, ref, L, H, quantity, finish, params, notes } · PUT|DELETE /:id/items/:itemId
 * GET    /:id/production        needs per workshop (preview) + existing work orders
 * POST   /:id/production/plan   (re)generates the work orders of the workshops
 * ============================================================
 */
const router = express.Router();
// Fine-grained permissions of every endpoint: config/routePermissions.js
router.use(auth, guard(ROUTE_PERMISSIONS.projects));
router.use(auth, requireProjectsView);

// People who don't see amounts (production, workshops, logistics — see
// canSeeFinancials) get projects without revenue, costs, margins,
// budget, expenses, invoices or cost prices, and can't change them.
const PROJECT_MONEY = [
  "budget", "revenue", "actualCost", "invoiced", "toInvoice", "actualMargin", "plannedMargin", "overBudget", "budgetUsedPercent",
  "unitCost", "consumedCost", "cost", "hourlyCost", "standardCost", "prices", "price", "unitPrice", "totalHT", "totalTTC", "amountPaid", "amount",
];
router.use(hideMoney(PROJECT_MONEY, (data) => {
  if (data && !Array.isArray(data) && data.financials) {
    data.financials = { progress: data.financials.progress, actual: { hours: data.financials.actual?.hours ?? 0 } };
    data.expenses = [];
    data.invoices = [];
  }
  return data;
}));
router.use(dropMoneyInput(["budget", "unitCost"]));

function canHandleMoney(req, res) {
  if (!canSeeFinancials(req.user)) {
    bad(res, "Only people who see amounts can record project expenses", 403);
    return false;
  }
  return true;
}

const STATUSES = ["planned", "in_progress", "on_hold", "completed", "cancelled"];

// Each change needs its own permission (projects.projects.edit,
// projects.items.manage, projects.tasks.manage… — config/routePermissions.js),
// checked by the guard before the handler runs.
function canEdit() {
  return true;
}

async function employeesOf(companyId, ids) {
  const list = (Array.isArray(ids) ? ids : []).filter(isId);
  if (!list.length) return [];
  const found = await Employee.find({ _id: { $in: list }, company: companyId }).select("_id").lean();
  return found.map((e) => e._id);
}

/** Everything that makes up a project's costs, for many projects at once. */
async function loadCostData(projectIds) {
  const [movements, purchaseOrders, timeEntries, invoices, tasks] = await Promise.all([
    InventoryMovement.find({ project: { $in: projectIds } }).lean(),
    PurchaseOrder.find({ project: { $in: projectIds } }).select("project number status lines supplier date totalHT").populate("supplier", "name").lean(),
    TimeEntry.find({ project: { $in: projectIds } }).lean(),
    SalesInvoice.find({ project: { $in: projectIds }, status: { $ne: "cancelled" } }).select("project number type status totalHT totalTTC amountPaid date").lean(),
    ProjectTask.find({ project: { $in: projectIds } }).lean(),
  ]);
  const group = (rows) => {
    const m = new Map();
    for (const r of rows) {
      const k = String(r.project);
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(r);
    }
    return m;
  };
  return { movements: group(movements), purchaseOrders: group(purchaseOrders), timeEntries: group(timeEntries), invoices: group(invoices), tasks: group(tasks) };
}

function financialsFor(project, data) {
  const k = String(project._id);
  return projectFinancials({
    project,
    movements: data.movements.get(k) || [],
    purchaseOrders: data.purchaseOrders.get(k) || [],
    timeEntries: data.timeEntries.get(k) || [],
    invoices: data.invoices.get(k) || [],
    tasks: data.tasks.get(k) || [],
  });
}

// ---------------- list ----------------
router.get("/", async (req, res) => {
  try {
    const { companyId, status, customer, search } = req.query;
    if (!isId(companyId)) return bad(res, "A valid companyId is required");
    const filter = { company: companyId };
    if (status === "active") filter.status = { $in: ["planned", "in_progress", "on_hold"] };
    else if (status) filter.status = status;
    if (customer && isId(customer)) filter.customer = customer;
    if (search) {
      const rx = new RegExp(String(search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [{ number: rx }, { name: rx }, { location: rx }];
    }
    const projects = await Project.find(filter)
      .populate("customer", "name").populate("manager", "firstName lastName")
      .sort({ createdAt: -1 }).limit(200).lean();
    const data = await loadCostData(projects.map((p) => p._id));
    const now = new Date();
    res.json({
      success: true,
      data: projects.map((p) => {
        const f = financialsFor(p, data);
        return {
          ...p,
          expenses: undefined,
          progress: f.progress,
          actualCost: f.actual.total,
          revenue: f.revenue,
          invoiced: f.invoiced,
          actualMargin: f.actualMargin,
          overBudget: f.overBudget,
          late: !!p.dueDate && new Date(p.dueDate) < now && !["completed", "cancelled"].includes(p.status),
        };
      }),
    });
  } catch (error) {
    console.error("GET projects error:", error);
    res.status(500).json({ success: false, message: "Error loading projects", error: error.message });
  }
});

// ---------------- planning ----------------
router.get("/planning", async (req, res) => {
  try {
    const { companyId } = req.query;
    if (!isId(companyId)) return bad(res, "A valid companyId is required");
    const from = req.query.from ? new Date(req.query.from) : new Date(new Date().setDate(new Date().getDate() - 7));
    const to = req.query.to ? new Date(req.query.to) : new Date(new Date().setDate(new Date().getDate() + 56));
    const projects = await Project.find({ company: companyId, status: { $in: ["planned", "in_progress", "on_hold"] } })
      .select("number name status startDate dueDate customer").populate("customer", "name").lean();
    const tasks = await ProjectTask.find({
      project: { $in: projects.map((p) => p._id) },
      $or: [
        { startDate: { $lte: to }, dueDate: { $gte: from } },
        { startDate: null },
        { dueDate: null },
      ],
    }).populate("assignees", "firstName lastName").sort({ startDate: 1, order: 1 }).lean();
    res.json({ success: true, data: { from, to, projects, tasks } });
  } catch (error) {
    console.error("GET planning error:", error);
    res.status(500).json({ success: false, message: "Error loading the planning", error: error.message });
  }
});

// ---------------- people (for assigning) ----------------
// Names and job titles only — production assigns people to projects
// without needing access to HR files.
router.get("/people", async (req, res) => {
  try {
    const { companyId } = req.query;
    if (!isId(companyId)) return bad(res, "A valid companyId is required");
    const people = await Employee.find({ company: companyId, employmentStatus: { $ne: "terminated" } })
      .select("firstName lastName jobTitle").sort({ lastName: 1, firstName: 1 }).lean();
    res.json({ success: true, data: people });
  } catch (error) {
    console.error("GET project people error:", error);
    res.status(500).json({ success: false, message: "Error loading employees", error: error.message });
  }
});

// ---------------- detail ----------------
router.get("/:id", async (req, res) => {
  try {
    if (!isId(req.params.id)) return bad(res, "Invalid project ID");
    const project = await Project.findById(req.params.id)
      .populate("customer", "name phone email city")
      .populate("quote", "number totalHT totalTTC status")
      .populate("manager", "firstName lastName jobTitle")
      .populate("team", "firstName lastName jobTitle")
      .populate("expenses.by", "firstName lastName")
      .populate("items.model", "name family drawing image series")
      .populate("items.finish", "code name color")
      .populate("finish", "code name color")
      .lean();
    if (!project) return bad(res, "Project not found", 404);
    const data = await loadCostData([project._id]);
    const k = String(project._id);
    const [tasks, timeEntries, movements] = await Promise.all([
      ProjectTask.find({ project: project._id }).populate("assignees", "firstName lastName").sort({ order: 1, startDate: 1 }).lean(),
      TimeEntry.find({ project: project._id }).populate("employee", "firstName lastName").populate("task", "title").sort({ date: -1 }).limit(300).lean(),
      InventoryMovement.find({ project: project._id }).populate("product", "name unit internalReference").populate("performedBy", "firstName lastName").sort({ createdAt: -1 }).lean(),
    ]);
    res.json({
      success: true,
      data: {
        ...project,
        financials: financialsFor(project, data),
        tasks,
        timeEntries,
        materials: movements,
        purchaseOrders: data.purchaseOrders.get(k) || [],
        invoices: data.invoices.get(k) || [],
        productionOrders: (await ProductionOrder.find({ project: project._id })
          .select("number status workshop kind dueDate startedAt completedAt items needs dependsOn")
          .populate("workshop", "code name kind color")
          .sort({ createdAt: 1 })
          .lean()).map(({ needs, items, ...o }) => ({
          ...o,
          progress: { total: (items || []).reduce((a, i) => a + (i.quantity || 0), 0), done: (items || []).reduce((a, i) => a + (i.done || 0), 0) },
          consumedCost: Math.round((needs || []).reduce((a, n) => a + (n.consumed || 0) * (n.unitCost || 0), 0) * 100) / 100,
        })),
      },
    });
  } catch (error) {
    console.error("GET project error:", error);
    res.status(500).json({ success: false, message: "Error loading the project", error: error.message });
  }
});

// ---------------- create / edit ----------------
const BUDGET_KEYS = ["revenue", "materials", "labour", "purchases", "other"];
function cleanBudget(input = {}, current = {}) {
  const out = { ...current };
  for (const k of BUDGET_KEYS) {
    if (input[k] !== undefined && input[k] !== "") {
      const v = Number(input[k]);
      if (!(v >= 0)) throw Object.assign(new Error(`Invalid budget amount (${k})`), { status: 400 });
      out[k] = v;
    }
  }
  return out;
}

router.post("/", async (req, res) => {
  try {
    if (!canEdit(req, res)) return;
    const { company } = req.body;
    if (!isId(company) || !(await Company.exists({ _id: company }))) return bad(res, "A valid company is required");
    if (!String(req.body.name || "").trim()) return bad(res, "Enter the project name");
    let customer = null;
    if (req.body.customer) {
      if (!isId(req.body.customer) || !(await Customer.exists({ _id: req.body.customer, company }))) return bad(res, "Customer not found");
      customer = req.body.customer;
    }
    let finish = null;
    if (req.body.finish) {
      if (!isId(req.body.finish) || !(await Finish.exists({ _id: req.body.finish, company }))) return bad(res, "Colour not found");
      finish = req.body.finish;
    }
    const [manager] = await employeesOf(company, [req.body.manager]);
    const project = await createWithNumber(Project, {
      company,
      name: String(req.body.name).trim(),
      customer,
      startDate: req.body.startDate || null,
      dueDate: req.body.dueDate || null,
      manager: manager || null,
      team: await employeesOf(company, req.body.team),
      location: req.body.location,
      description: req.body.description,
      budget: cleanBudget(req.body.budget),
      finish,
      createdBy: req.user.id,
      updatedBy: req.user.id,
    }, "PRJ");
    await logAudit(req, { company, action: "create", resourceType: "Project", resourceId: project._id, resourceLabel: `${project.number} — ${project.name}` });
    res.status(201).json({ success: true, data: project });
  } catch (error) {
    if (error.status) return bad(res, error.message, error.status);
    console.error("POST project error:", error);
    res.status(error.name === "ValidationError" ? 400 : 500).json({ success: false, message: validationMessage(error, "Error creating the project") });
  }
});

router.put("/:id", async (req, res) => {
  try {
    if (!canEdit(req, res)) return;
    if (!isId(req.params.id)) return bad(res, "Invalid project ID");
    const project = await Project.findById(req.params.id);
    if (!project) return bad(res, "Project not found", 404);
    for (const f of ["name", "location", "description"]) if (req.body[f] !== undefined) project[f] = req.body[f];
    for (const f of ["startDate", "dueDate"]) if (req.body[f] !== undefined) project[f] = req.body[f] || null;
    if (req.body.dueDate !== undefined) project.dueSoonNotifiedAt = null;
    if (req.body.customer !== undefined) {
      if (req.body.customer && (!isId(req.body.customer) || !(await Customer.exists({ _id: req.body.customer, company: project.company })))) return bad(res, "Customer not found");
      project.customer = req.body.customer || null;
    }
    if (req.body.manager !== undefined) {
      const [manager] = await employeesOf(project.company, [req.body.manager]);
      project.manager = manager || null;
    }
    if (req.body.team !== undefined) project.team = await employeesOf(project.company, req.body.team);
    if (req.body.finish !== undefined) {
      if (req.body.finish && (!isId(req.body.finish) || !(await Finish.exists({ _id: req.body.finish, company: project.company })))) return bad(res, "Colour not found");
      project.finish = req.body.finish || null;
      project.$locals.resync = true;
    }
    if (req.body.budget !== undefined) project.budget = cleanBudget(req.body.budget, project.budget?.toObject?.() || project.budget);
    project.updatedBy = req.user.id;
    await project.save();
    if (project.$locals.resync) await tracking.syncProjectUnits(project, req.user.id);
    res.json({ success: true, data: project });
  } catch (error) {
    if (error.status) return bad(res, error.message, error.status);
    console.error("PUT project error:", error);
    res.status(error.name === "ValidationError" ? 400 : 500).json({ success: false, message: validationMessage(error, "Error updating the project") });
  }
});

router.patch("/:id/status", async (req, res) => {
  try {
    if (!canEdit(req, res)) return;
    if (!isId(req.params.id)) return bad(res, "Invalid project ID");
    if (!STATUSES.includes(req.body.status)) return bad(res, "Invalid status");
    const project = await Project.findById(req.params.id);
    if (!project) return bad(res, "Project not found", 404);
    project.status = req.body.status;
    if (req.body.status === "in_progress" && !project.startDate) project.startDate = new Date();
    project.completedAt = req.body.status === "completed" ? new Date() : null;
    project.updatedBy = req.user.id;
    await project.save();
    await logAudit(req, { company: project.company, action: "update", resourceType: "Project", resourceId: project._id, resourceLabel: `${project.number} → ${project.status}` });
    res.json({ success: true, data: project });
  } catch (error) {
    console.error("PATCH project status error:", error);
    res.status(500).json({ success: false, message: "Error updating the project", error: error.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    if (!canEdit(req, res)) return;
    if (!isId(req.params.id)) return bad(res, "Invalid project ID");
    const project = await Project.findById(req.params.id);
    if (!project) return bad(res, "Project not found", 404);
    const used = (await TimeEntry.exists({ project: project._id }))
      || (await InventoryMovement.exists({ project: project._id }))
      || (await PurchaseOrder.exists({ project: project._id }))
      || (await SalesInvoice.exists({ project: project._id }))
      || project.expenses.length > 0;
    if (used) return bad(res, "This project has hours, materials, purchases or invoices: cancel it instead");
    await ProjectTask.deleteMany({ project: project._id });
    const Quote = require("../models/Quote");
    await Quote.updateMany({ project: project._id }, { $set: { project: null } });
    await project.deleteOne();
    res.json({ success: true });
  } catch (error) {
    console.error("DELETE project error:", error);
    res.status(500).json({ success: false, message: "Error deleting the project", error: error.message });
  }
});

// ---------------- tasks ----------------
async function taskPayload(body, companyId) {
  const out = {};
  if (body.title !== undefined) out.title = String(body.title).trim();
  for (const f of ["description"]) if (body[f] !== undefined) out[f] = body[f];
  for (const f of ["startDate", "dueDate"]) if (body[f] !== undefined) out[f] = body[f] || null;
  if (body.estimatedHours !== undefined) out.estimatedHours = Math.max(Number(body.estimatedHours) || 0, 0);
  if (body.status !== undefined) {
    if (!["todo", "in_progress", "done", "blocked"].includes(body.status)) throw Object.assign(new Error("Invalid task status"), { status: 400 });
    out.status = body.status;
    out.completedAt = body.status === "done" ? new Date() : null;
  }
  if (body.order !== undefined) out.order = Number(body.order) || 0;
  if (body.assignees !== undefined) out.assignees = await employeesOf(companyId, body.assignees);
  if (out.startDate && out.dueDate && new Date(out.dueDate) < new Date(out.startDate)) {
    throw Object.assign(new Error("The end date is before the start date"), { status: 400 });
  }
  return out;
}

router.post("/:id/tasks", async (req, res) => {
  try {
    if (!canEdit(req, res)) return;
    if (!isId(req.params.id)) return bad(res, "Invalid project ID");
    const project = await Project.findById(req.params.id).select("company");
    if (!project) return bad(res, "Project not found", 404);
    const payload = await taskPayload(req.body, project.company);
    if (!payload.title) return bad(res, "Enter the task title");
    const count = await ProjectTask.countDocuments({ project: project._id });
    const task = await ProjectTask.create({ order: count, ...payload, company: project.company, project: project._id, createdBy: req.user.id });
    res.status(201).json({ success: true, data: await ProjectTask.findById(task._id).populate("assignees", "firstName lastName") });
  } catch (error) {
    if (error.status) return bad(res, error.message, error.status);
    console.error("POST task error:", error);
    res.status(error.name === "ValidationError" ? 400 : 500).json({ success: false, message: validationMessage(error, "Error creating the task") });
  }
});

router.put("/tasks/:taskId", async (req, res) => {
  try {
    if (!canEdit(req, res)) return;
    if (!isId(req.params.taskId)) return bad(res, "Invalid task ID");
    const task = await ProjectTask.findById(req.params.taskId);
    if (!task) return bad(res, "Task not found", 404);
    const payload = await taskPayload(req.body, task.company);
    if (payload.title === "") return bad(res, "Enter the task title");
    Object.assign(task, payload);
    if (task.startDate && task.dueDate && task.dueDate < task.startDate) return bad(res, "The end date is before the start date");
    await task.save();
    // First task started → the project is in progress.
    if (task.status === "in_progress" || task.status === "done") {
      await Project.updateOne({ _id: task.project, status: "planned" }, { $set: { status: "in_progress", startDate: new Date() } });
    }
    res.json({ success: true, data: await ProjectTask.findById(task._id).populate("assignees", "firstName lastName") });
  } catch (error) {
    if (error.status) return bad(res, error.message, error.status);
    console.error("PUT task error:", error);
    res.status(500).json({ success: false, message: "Error updating the task", error: error.message });
  }
});

router.delete("/tasks/:taskId", async (req, res) => {
  try {
    if (!canEdit(req, res)) return;
    if (!isId(req.params.taskId)) return bad(res, "Invalid task ID");
    const task = await ProjectTask.findById(req.params.taskId);
    if (!task) return bad(res, "Task not found", 404);
    await TimeEntry.updateMany({ task: task._id }, { $set: { task: null } });
    await task.deleteOne();
    res.json({ success: true });
  } catch (error) {
    console.error("DELETE task error:", error);
    res.status(500).json({ success: false, message: "Error deleting the task", error: error.message });
  }
});

// ---------------- hours ----------------
router.post("/:id/time", async (req, res) => {
  try {
    if (!canEdit(req, res)) return;
    if (!isId(req.params.id)) return bad(res, "Invalid project ID");
    const project = await Project.findById(req.params.id).select("company status");
    if (!project) return bad(res, "Project not found", 404);
    if (project.status === "cancelled") return bad(res, "This project is cancelled");
    const [employee] = await employeesOf(project.company, [req.body.employee]);
    if (!employee) return bad(res, "Choose an employee of this company");
    const hours = Number(req.body.hours);
    if (!(hours >= 0.25 && hours <= 24)) return bad(res, "Hours must be between 0.25 and 24");
    const date = req.body.date ? new Date(req.body.date) : new Date();
    if (date > new Date()) return bad(res, "Hours can't be entered in the future");
    let task = null;
    if (req.body.task) {
      const t = isId(req.body.task) && (await ProjectTask.findOne({ _id: req.body.task, project: project._id }).select("_id"));
      if (!t) return bad(res, "Task not found in this project");
      task = t._id;
    }
    const hourlyCost = await hourlyCostFor(employee, project.company);
    const entry = await TimeEntry.create({
      company: project.company,
      project: project._id,
      task,
      employee,
      date,
      hours,
      hourlyCost,
      cost: Math.round(hours * hourlyCost * 100) / 100,
      notes: req.body.notes,
      createdBy: req.user.id,
    });
    await Project.updateOne({ _id: project._id, status: "planned" }, { $set: { status: "in_progress", startDate: date } });
    res.status(201).json({
      success: true,
      data: await TimeEntry.findById(entry._id).populate("employee", "firstName lastName").populate("task", "title"),
      warning: hourlyCost === 0 ? "This employee has no current salary on file: the hours cost 0." : undefined,
    });
  } catch (error) {
    console.error("POST time entry error:", error);
    res.status(500).json({ success: false, message: "Error recording the hours", error: error.message });
  }
});

router.delete("/time/:entryId", async (req, res) => {
  try {
    if (!canEdit(req, res)) return;
    if (!isId(req.params.entryId)) return bad(res, "Invalid ID");
    const entry = await TimeEntry.findById(req.params.entryId);
    if (!entry) return bad(res, "Entry not found", 404);
    await entry.deleteOne();
    res.json({ success: true });
  } catch (error) {
    console.error("DELETE time entry error:", error);
    res.status(500).json({ success: false, message: "Error deleting the entry", error: error.message });
  }
});

// ---------------- materials (from inventory) ----------------
/** Default unit cost: the cheapest supplier price recorded on the article. */
function defaultUnitCost(product) {
  const prices = (product.prices || []).map((p) => p.price).filter((p) => p > 0);
  return prices.length ? Math.min(...prices) : 0;
}

router.post("/:id/materials", async (req, res) => {
  try {
    if (!canEdit(req, res)) return;
    if (!isId(req.params.id) || !isId(req.body.product)) return bad(res, "Invalid ID");
    const project = await Project.findById(req.params.id).select("company number status");
    if (!project) return bad(res, "Project not found", 404);
    if (project.status === "cancelled") return bad(res, "This project is cancelled");
    const product = await Product.findOne({ _id: req.body.product, company: project.company });
    if (!product) return bad(res, "Article not found in this company");
    const quantity = Number(req.body.quantity);
    if (!(quantity > 0)) return bad(res, "Enter a quantity");
    const direction = req.body.direction === "return" ? "return" : "out";
    if (direction === "return") {
      const taken = await InventoryMovement.find({ project: project._id, product: product._id }).select("type quantity").lean();
      const net = taken.reduce((s, m) => s + (m.type === "out" ? m.quantity : m.type === "in" ? -m.quantity : 0), 0);
      if (quantity > net + 1e-9) return bad(res, `Only ${net} ${product.unit || ""} of this article were taken for the project`);
    }
    const unitCost = req.body.unitCost !== undefined && req.body.unitCost !== "" ? Number(req.body.unitCost) : defaultUnitCost(product);
    if (!(unitCost >= 0)) return bad(res, "Invalid unit cost");
    await applyMovement({
      product,
      type: direction === "return" ? "in" : "out",
      quantity,
      reason: `${direction === "return" ? "Retour de chantier" : "Sortie pour projet"} ${project.number}`,
      actorId: req.user.id,
      project: project._id,
      unitCost,
    });
    res.status(201).json({ success: true, data: { product: product._id, quantity, unitCost, remainingStock: product.quantity } });
  } catch (error) {
    if (error.status) return bad(res, error.message, error.status);
    console.error("POST project materials error:", error);
    res.status(500).json({ success: false, message: "Error recording the material", error: error.message });
  }
});

// ---------------- other expenses ----------------
router.post("/:id/expenses", async (req, res) => {
  try {
    if (!canEdit(req, res) || !canHandleMoney(req, res)) return;
    if (!isId(req.params.id)) return bad(res, "Invalid project ID");
    const project = await Project.findById(req.params.id);
    if (!project) return bad(res, "Project not found", 404);
    const amount = Number(req.body.amount);
    const label = String(req.body.label || "").trim();
    if (!label) return bad(res, "Describe the expense");
    if (!(amount > 0)) return bad(res, "Enter the amount (HT)");
    project.expenses.push({ date: req.body.date || new Date(), label, amount, by: req.user.id });
    project.updatedBy = req.user.id;
    await project.save();
    res.status(201).json({ success: true, data: project.expenses[project.expenses.length - 1] });
  } catch (error) {
    console.error("POST project expense error:", error);
    res.status(500).json({ success: false, message: "Error recording the expense", error: error.message });
  }
});

router.delete("/:id/expenses/:expenseId", async (req, res) => {
  try {
    if (!canEdit(req, res) || !canHandleMoney(req, res)) return;
    if (!isId(req.params.id) || !isId(req.params.expenseId)) return bad(res, "Invalid ID");
    const project = await Project.findById(req.params.id);
    if (!project) return bad(res, "Project not found", 404);
    const expense = project.expenses.id(req.params.expenseId);
    if (!expense) return bad(res, "Expense not found", 404);
    expense.deleteOne();
    await project.save();
    res.json({ success: true });
  } catch (error) {
    console.error("DELETE project expense error:", error);
    res.status(500).json({ success: false, message: "Error deleting the expense", error: error.message });
  }
});

// ---------------- ouvrages (chassis to manufacture) ----------------
async function cleanItem(body, companyId) {
  if (!isId(body.model)) throw Object.assign(new Error("Choose a chassis model"), { status: 400 });
  const model = await ChassisModel.findOne({ _id: body.model, company: companyId }).select("parameters name").lean();
  if (!model) throw Object.assign(new Error("Chassis model not found"), { status: 400 });
  const L = Number(body.L);
  const H = Number(body.H);
  const quantity = Number(body.quantity ?? 1);
  if (!(L > 0 && H > 0)) throw Object.assign(new Error("Enter the width and height (mm)"), { status: 400 });
  if (!(quantity >= 1)) throw Object.assign(new Error("The quantity must be at least 1"), { status: 400 });
  let finish = null;
  if (body.finish) {
    if (!isId(body.finish) || !(await Finish.exists({ _id: body.finish, company: companyId }))) throw Object.assign(new Error("Colour not found"), { status: 400 });
    finish = body.finish;
  }
  const params = {};
  for (const p of model.parameters || []) {
    const v = body.params?.[p.key];
    if (v === undefined || v === null || v === "") continue;
    params[p.key] = p.type === "product" || p.type === "model" ? (isId(v) ? String(v) : null) : Number(v) || 0;
  }
  return {
    model: body.model, ref: String(body.ref || "").trim().slice(0, 30), label: String(body.label || "").trim().slice(0, 300),
    L, H, quantity: Math.round(quantity), finish, params, notes: String(body.notes || "").slice(0, 500),
  };
}

router.post("/:id/items", async (req, res) => {
  try {
    if (!canEdit(req, res)) return;
    if (!isId(req.params.id)) return bad(res, "Invalid project ID");
    const project = await Project.findById(req.params.id);
    if (!project) return bad(res, "Project not found", 404);
    const item = await cleanItem(req.body, project.company);
    if (!item.ref) item.ref = `R${project.items.length + 1}`;
    project.items.push(item);
    project.updatedBy = req.user.id;
    await project.save();
    await tracking.syncProjectUnits(project, req.user.id);
    res.status(201).json({ success: true, data: project.items[project.items.length - 1] });
  } catch (error) {
    if (error.status) return bad(res, error.message, error.status);
    console.error("POST project item error:", error);
    res.status(500).json({ success: false, message: "Error adding the chassis", error: error.message });
  }
});

router.put("/:id/items/:itemId", async (req, res) => {
  try {
    if (!canEdit(req, res)) return;
    if (!isId(req.params.id) || !isId(req.params.itemId)) return bad(res, "Invalid ID");
    const project = await Project.findById(req.params.id);
    if (!project) return bad(res, "Project not found", 404);
    const item = project.items.id(req.params.itemId);
    if (!item) return bad(res, "Chassis not found", 404);
    const current = item.toObject();
    Object.assign(item, await cleanItem({ ...current, ...req.body, params: req.body.params ?? current.params }, project.company));
    project.markModified("items");
    project.updatedBy = req.user.id;
    await project.save();
    await tracking.syncProjectUnits(project, req.user.id);
    res.json({ success: true, data: item });
  } catch (error) {
    if (error.status) return bad(res, error.message, error.status);
    console.error("PUT project item error:", error);
    res.status(500).json({ success: false, message: "Error saving the chassis", error: error.message });
  }
});

router.delete("/:id/items/:itemId", async (req, res) => {
  try {
    if (!canEdit(req, res)) return;
    if (!isId(req.params.id) || !isId(req.params.itemId)) return bad(res, "Invalid ID");
    const project = await Project.findById(req.params.id);
    if (!project) return bad(res, "Project not found", 404);
    const item = project.items.id(req.params.itemId);
    if (!item) return bad(res, "Chassis not found", 404);
    item.deleteOne();
    project.updatedBy = req.user.id;
    await project.save();
    await tracking.syncProjectUnits(project, req.user.id);
    res.json({ success: true, message: "Chassis removed" });
  } catch (error) {
    console.error("DELETE project item error:", error);
    res.status(500).json({ success: false, message: "Error removing the chassis", error: error.message });
  }
});

/** Needs per workshop (not saved) + the existing work orders. */
router.get("/:id/production", async (req, res) => {
  try {
    if (!isId(req.params.id)) return bad(res, "Invalid project ID");
    const project = await Project.findById(req.params.id).lean();
    if (!project) return bad(res, "Project not found", 404);
    const ctx = await loadContext(project.company);
    const plan = await computeProjectPlan(project, ctx);
    const items = (project.items || []).map((it) => ({ _id: it._id, ref: it.ref, description: describeChassis({ ...it, finish: it.finish || project.finish }, ctx) }));
    const orders = (await ProductionOrder.find({ project: project._id })
      .select("number status workshop kind dueDate startedAt completedAt dependsOn needs")
      .populate("workshop", "code name kind color")
      .populate("needs.product", "name")
      .sort({ createdAt: 1 })
      .lean()).map((o) => ({ ...o, needs: (o.needs || []).map(({ cuts, cutPlan, pieceList, ...n }) => n) }));
    res.json({
      success: true,
      data: {
        items,
        missingGlass: missingGlass(project, ctx),
        plan: {
          ...plan,
          workshops: plan.workshops.map((w) => ({
            ...w,
            workshop: { _id: w.workshop._id, code: w.workshop.code, name: w.workshop.name, kind: w.workshop.kind, color: w.workshop.color },
            needs: w.needs.map(({ cutPlan, cuts, pieceList, ...n }) => ({ ...n, barLength: cutPlan?.barLength })),
          })),
        },
        orders,
      },
    });
  } catch (error) {
    console.error("GET project production error:", error);
    res.status(500).json({ success: false, message: "Error computing the production needs", error: error.message });
  }
});

/**
 * Débit of the project: bar cutting plans, glass plateau layouts,
 * accessories and powder — from the work orders once manufacturing has
 * started (else from the live plan). Query: kerf, trim, endTrim, spacing,
 * edgeTrim, gap, allowRotation override the settings for this view.
 */
router.get("/:id/production/cutting", async (req, res) => {
  try {
    if (!isId(req.params.id)) return bad(res, "Invalid project ID");
    const project = await Project.findById(req.params.id).lean();
    if (!project) return bad(res, "Project not found", 404);
    res.json({ success: true, data: await projectCutting(project, req.query) });
  } catch (error) {
    console.error("GET project cutting error:", error);
    res.status(500).json({ success: false, message: "Error computing the cutting plans", error: error.message });
  }
});

/** One paper per material: ?section=bars | accessories | powder | glass */
router.get("/:id/production/pdf", async (req, res) => {
  try {
    if (!isId(req.params.id)) return bad(res, "Invalid project ID");
    const section = String(req.query.section || "");
    if (!SECTIONS[section]) return bad(res, "Unknown section (bars, accessories, powder, glass)");
    const project = await Project.findById(req.params.id).populate("customer", "name").lean();
    if (!project) return bad(res, "Project not found", 404);
    const { report, orders } = await projectCutting(project, req.query);
    const company = await Company.findById(project.company).lean();
    const logoBuffer = await fetchLogoBuffer(company).catch(() => null);
    const doc = generateCuttingPdf({
      section, report, company, logoBuffer,
      header: {
        ref: project.number, partyLabel: "PROJET", partyName: `${project.number} — ${project.name}`, address: project.location,
        contact: project.customer?.name ? `Client : ${project.customer.name}` : undefined,
        rows: [["Échéance", project.dueDate ? new Date(project.dueDate).toLocaleDateString("fr-FR") : null], ["Ordres", orders.map((o) => o.number).join(", ") || "non lancés (prévision)"]],
      },
    });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${project.number}-${section}.pdf"`);
    doc.pipe(res);
    doc.end();
  } catch (error) {
    console.error("GET project cutting PDF error:", error);
    res.status(500).json({ success: false, message: "Error generating the PDF", error: error.message });
  }
});

router.post("/:id/production/plan", async (req, res) => {
  try {
    if (!canEdit(req, res)) return;
    if (!isId(req.params.id)) return bad(res, "Invalid project ID");
    const project = await Project.findById(req.params.id);
    if (!project) return bad(res, "Project not found", 404);
    if (project.status === "cancelled") return bad(res, "This project is cancelled");
    const { orders, plan } = await createOrdersForProject(project, req.user.id, { onlyMissing: !!req.body?.onlyMissing });
    if (req.body?.onlyMissing && !orders.length) return bad(res, "Chaque atelier a déjà son ordre : rien à compléter");
    await tracking.syncProjectUnits(project, req.user.id);
    if (project.status === "planned") {
      project.status = "in_progress";
      project.startDate = project.startDate || new Date();
      await project.save();
    }
    await logAudit(req, { company: project.company, action: "create", resourceType: "ProductionOrder", resourceId: project._id, resourceLabel: `${project.number} : ${orders.map((o) => o.number).join(", ")}` });
    await notifications.onOrdersPlanned(project, orders, req.user.id);
    res.status(201).json({ success: true, data: { orders, warnings: plan.warnings, shortages: plan.shortages } });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ success: false, message: error.message, details: error.details });
    console.error("POST project plan error:", error);
    res.status(500).json({ success: false, message: "Error creating the work orders", error: error.message });
  }
});

module.exports = router;
