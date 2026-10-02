const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");

const PayrollRun = require("../models/PayrollRun");
const Payslip = require("../models/Payslip");
const Company = require("../models/Company");
const auth = require("../middleware/auth");
const { guard } = require("../middleware/permissionGuard");
const { ROUTE_PERMISSIONS } = require("../config/routePermissions");
const { requireHRAccess } = require("../middleware/permissionMiddleware");
const { canAccessHRForCompany } = require("../permissions/permissions");
const { parsePreetabli, buildDeclarationPlan, buildDeclarationFile, SITUATIONS } = require("../services/damancomService");
const { buildTransferPlan, buildTransferCsv, buildTransferXlsx } = require("../services/bankTransferService");
const { monthlySummary, buildAnnualDeclaration, buildAnnualXml, buildAnnualXlsx } = require("../services/simplIrService");
const { logAudit } = require("../services/auditLogger");

/**
 * ============================================================
 * PAYROLL DECLARATIONS — /api/declarations
 * ============================================================
 * DAMANCOM (CNSS)
 *   POST /runs/:id/damancom/preview   multipart: preetabli (file), situations (JSON)
 *   POST /runs/:id/damancom/file      same → the declaration file (.txt)
 * Bank transfer
 *   GET  /runs/:id/bank-transfer              checks + list
 *   GET  /runs/:id/bank-transfer/file?format=xlsx|csv&executionDate=
 * Simpl-IR (DGI)
 *   GET  /runs/:id/ir                         monthly IR to pay
 *   GET  /ir-annual?companyId=&year=          annual declaration (état 9421) preview
 *   GET  /ir-annual/file?companyId=&year=&format=xml|xlsx
 * ============================================================
 */

const router = express.Router();
// Fine-grained permissions of every endpoint: config/routePermissions.js
router.use(auth, guard(ROUTE_PERMISSIONS.declarations));
router.use(auth, requireHRAccess);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
const isId = (v) => mongoose.Types.ObjectId.isValid(String(v || ""));

async function loadRun(req, res) {
  if (!isId(req.params.id)) {
    res.status(400).json({ success: false, message: "Invalid payroll run ID" });
    return null;
  }
  const run = await PayrollRun.findById(req.params.id).populate("company");
  if (!run) {
    res.status(404).json({ success: false, message: "Payroll run not found" });
    return null;
  }
  if (!canAccessHRForCompany(req.user, run.company)) {
    res.status(403).json({ success: false, message: "Not authorized" });
    return null;
  }
  const payslips = await Payslip.find({ payrollRun: run._id }).populate("employee");
  return { run, payslips, company: run.company };
}

const period = (run) => `${run.year}-${String(run.month).padStart(2, "0")}`;

// ------------------------------------------------------------
// DAMANCOM
// ------------------------------------------------------------
function readDamancomInput(req) {
  if (!req.file) throw Object.assign(new Error("Attach the préétabli file downloaded from Damancom"), { status: 400 });
  // Préétablis are plain ASCII/Latin-1 text.
  const text = req.file.buffer.toString("latin1");
  let situations = {};
  if (req.body.situations) {
    try {
      situations = JSON.parse(req.body.situations);
    } catch {
      throw Object.assign(new Error("Invalid situations"), { status: 400 });
    }
  }
  return { preetabli: parsePreetabli(text), situations };
}

router.post("/runs/:id/damancom/preview", upload.single("preetabli"), async (req, res) => {
  try {
    const loaded = await loadRun(req, res);
    if (!loaded) return;
    const { preetabli, situations } = readDamancomInput(req);
    const plan = buildDeclarationPlan({ ...loaded, preetabli, situations });
    if (loaded.run.status !== "completed") {
      plan.warnings.unshift({ code: "run_draft", message: "This payroll is still a draft: complete it before declaring." });
    }
    res.json({ success: true, data: plan, situations: Object.entries(SITUATIONS).map(([code, s]) => ({ code, label: s.label })) });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ success: false, message: error.message });
    console.error("POST damancom preview error:", error);
    res.status(500).json({ success: false, message: "Error reading the préétabli", error: error.message });
  }
});

router.post("/runs/:id/damancom/file", upload.single("preetabli"), async (req, res) => {
  try {
    const loaded = await loadRun(req, res);
    if (!loaded) return;
    const { preetabli, situations } = readDamancomInput(req);
    const plan = buildDeclarationPlan({ ...loaded, preetabli, situations });
    if (!plan.ready) return res.status(400).json({ success: false, message: "Fix the problems first", problems: plan.problems });
    const text = buildDeclarationFile(plan);

    await logAudit(req, {
      company: loaded.company._id,
      action: "review",
      resourceType: "PayrollRun",
      resourceId: loaded.run._id,
      resourceLabel: `Fichier Damancom ${period(loaded.run)} (${plan.totals.employees} salariés)`,
    });

    res.setHeader("Content-Type", "text/plain; charset=latin1");
    res.setHeader("Content-Disposition", `attachment; filename="DS_${plan.affiliate}_${plan.period}.txt"`);
    res.send(Buffer.from(text, "latin1"));
  } catch (error) {
    if (error.status) return res.status(error.status).json({ success: false, message: error.message, problems: error.problems });
    console.error("POST damancom file error:", error);
    res.status(500).json({ success: false, message: "Error generating the declaration", error: error.message });
  }
});

// ------------------------------------------------------------
// BANK TRANSFER
// ------------------------------------------------------------
router.get("/runs/:id/bank-transfer", async (req, res) => {
  try {
    const loaded = await loadRun(req, res);
    if (!loaded) return;
    res.json({ success: true, data: buildTransferPlan(loaded) });
  } catch (error) {
    console.error("GET bank transfer error:", error);
    res.status(500).json({ success: false, message: "Error preparing the transfers", error: error.message });
  }
});

router.get("/runs/:id/bank-transfer/file", async (req, res) => {
  try {
    const loaded = await loadRun(req, res);
    if (!loaded) return;
    const plan = buildTransferPlan(loaded);
    if (!plan.ready) {
      return res.status(400).json({ success: false, message: "Fix the RIB problems first", problems: plan.problems });
    }
    await logAudit(req, {
      company: loaded.company._id,
      action: "review",
      resourceType: "PayrollRun",
      resourceId: loaded.run._id,
      resourceLabel: `Fichier de virement ${period(loaded.run)} (${plan.count} virements, ${plan.total} MAD)`,
    });
    const name = `virements-salaires-${period(loaded.run)}`;
    if (req.query.format === "csv") {
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${name}.csv"`);
      return res.send(buildTransferCsv(plan));
    }
    const buffer = await buildTransferXlsx(plan, { executionDate: req.query.executionDate });
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${name}.xlsx"`);
    res.send(Buffer.from(buffer));
  } catch (error) {
    console.error("GET bank transfer file error:", error);
    res.status(500).json({ success: false, message: "Error generating the transfer file", error: error.message });
  }
});

// ------------------------------------------------------------
// SIMPL-IR
// ------------------------------------------------------------
router.get("/runs/:id/ir", async (req, res) => {
  try {
    const loaded = await loadRun(req, res);
    if (!loaded) return;
    res.json({ success: true, data: monthlySummary(loaded) });
  } catch (error) {
    console.error("GET monthly IR error:", error);
    res.status(500).json({ success: false, message: "Error computing the IR summary", error: error.message });
  }
});

async function loadAnnual(req, res) {
  const { companyId } = req.query;
  const year = Number(req.query.year);
  if (!isId(companyId) || !Number.isInteger(year) || year < 2000 || year > 2100) {
    res.status(400).json({ success: false, message: "A valid companyId and year are required" });
    return null;
  }
  const company = await Company.findById(companyId);
  if (!company) {
    res.status(404).json({ success: false, message: "Company not found" });
    return null;
  }
  if (!canAccessHRForCompany(req.user, company)) {
    res.status(403).json({ success: false, message: "Not authorized" });
    return null;
  }
  const runs = await PayrollRun.find({ company: company._id, year, status: "completed" }).select("_id month").lean();
  const payslips = runs.length
    ? await Payslip.find({ payrollRun: { $in: runs.map((r) => r._id) } }).populate("employee")
    : [];
  return buildAnnualDeclaration({ company, year, payslips, monthsCompleted: runs.map((r) => r.month) });
}

router.get("/ir-annual", async (req, res) => {
  try {
    const decl = await loadAnnual(req, res);
    if (!decl) return;
    res.json({ success: true, data: decl });
  } catch (error) {
    console.error("GET annual IR error:", error);
    res.status(500).json({ success: false, message: "Error computing the annual declaration", error: error.message });
  }
});

router.get("/ir-annual/file", async (req, res) => {
  try {
    const decl = await loadAnnual(req, res);
    if (!decl) return;
    if (req.query.format === "xlsx") {
      const buffer = await buildAnnualXlsx(decl);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="etat-9421-${decl.year}.xlsx"`);
      return res.send(Buffer.from(buffer));
    }
    if (!decl.ready) return res.status(400).json({ success: false, message: "Fix the problems first", problems: decl.problems });
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="traitements-salaires-${decl.year}.xml"`);
    res.send(buildAnnualXml(decl));
  } catch (error) {
    if (error.status) return res.status(error.status).json({ success: false, message: error.message, problems: error.problems });
    console.error("GET annual IR file error:", error);
    res.status(500).json({ success: false, message: "Error generating the annual declaration", error: error.message });
  }
});

module.exports = router;
