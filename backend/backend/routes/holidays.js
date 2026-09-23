const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const ExcelJS = require("exceljs");

const router = express.Router();

const PublicHoliday = require("../models/PublicHoliday");
const Company = require("../models/Company");
const auth = require("../middleware/auth");
const { requireHRAccess } = require("../middleware/permissionMiddleware");
const { canAccessHRForCompany, canManageEmployeeRecords } = require("../permissions/permissions");
const { logAudit } = require("../services/auditLogger");
const { parseHolidayFile, toDayKey } = require("../services/holidayImportService");
const { MOROCCO_FIXED_HOLIDAYS } = require("../config/moroccoFixedHolidays");

/**
 * ============================================================
 * PUBLIC HOLIDAYS (jours fériés) — HR module
 * ============================================================
 * Reading: any HR access. Changing: Chargé RH and above
 * (canManageEmployeeRecords), same bar as editing employee records.
 * Each year HR downloads the template (fixed-date holidays already
 * filled in), adds the religious holidays with their announced
 * dates, and imports it: preview first, then commit.
 * ============================================================
 */

router.use(auth, requireHRAccess);

const uploadHolidayFile = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/\.(xlsx|csv)$/i.test(file.originalname)) cb(null, true);
    else cb(new Error("Please upload an Excel (.xlsx) or CSV file"));
  },
});

async function loadCompany(req, res, companyId) {
  if (!companyId || !mongoose.Types.ObjectId.isValid(companyId)) {
    res.status(400).json({ success: false, message: "A valid companyId is required" });
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
  return company;
}

function requireEditor(req, res) {
  if (!canManageEmployeeRecords(req.user)) {
    res.status(403).json({ success: false, message: "Managing public holidays requires Chargé RH authority or higher" });
    return false;
  }
  return true;
}

// ======================================================
// LIST  GET /api/holidays?companyId=&year=
// ======================================================
router.get("/", async (req, res) => {
  try {
    const company = await loadCompany(req, res, req.query.companyId);
    if (!company) return;
    const year = Number(req.query.year) || new Date().getFullYear();
    const holidays = await PublicHoliday.find({ company: company._id, year }).sort({ day: 1 });
    res.json({ success: true, data: holidays });
  } catch (error) {
    console.error("GET holidays error:", error);
    res.status(500).json({ success: false, message: "Error fetching public holidays", error: error.message });
  }
});

// ======================================================
// TEMPLATE  GET /api/holidays/template?year=
// An .xlsx with the fixed-date holidays for that year pre-filled,
// plus a second sheet explaining the columns.
// ======================================================
router.get("/template", async (req, res) => {
  try {
    const year = Number(req.query.year) || new Date().getFullYear();
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(`Jours fériés ${year}`);
    sheet.columns = [
      { header: "Date", key: "date", width: 14, style: { numFmt: "dd/mm/yyyy" } },
      { header: "Nom", key: "name", width: 36 },
      { header: "Entreprise ouverte (oui/non)", key: "open", width: 28 },
      { header: "Paiement si travaillé (double/normal)", key: "pay", width: 36 },
    ];
    sheet.getRow(1).font = { bold: true };
    for (const h of MOROCCO_FIXED_HOLIDAYS) {
      sheet.addRow({ date: new Date(Date.UTC(year, h.month - 1, h.day)), name: h.name, open: "non", pay: "double" });
    }

    const help = workbook.addWorksheet("Aide");
    [
      ["Comment remplir ce fichier"],
      [""],
      ["Les jours fériés à date fixe sont déjà remplis. Vérifiez-les."],
      ["Ajoutez les fêtes religieuses de l'année avec leurs dates officielles :"],
      ["  Aïd al-Fitr, Aïd al-Adha, 1er Moharram, Aïd al-Mawlid (une ligne par jour)."],
      [""],
      ["Date : JJ/MM/AAAA"],
      ["Entreprise ouverte : non = entreprise fermée ce jour-là ; oui = on travaille normalement."],
      ["Paiement si travaillé : double = les heures travaillées ce jour sont payées double ; normal = sans majoration."],
      [""],
      ["Seule la première feuille est importée."],
    ].forEach((r) => help.addRow(r));
    help.getColumn(1).width = 100;
    help.getRow(1).font = { bold: true };

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="jours-feries-${year}.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("GET holidays template error:", error);
    res.status(500).json({ success: false, message: "Error generating the template", error: error.message });
  }
});

// ======================================================
// IMPORT PREVIEW  POST /api/holidays/import/preview (multipart: file, companyId)
// Parses and validates only — saves nothing.
// ======================================================
router.post("/import/preview", (req, res, next) => {
  uploadHolidayFile.single("file")(req, res, (err) => {
    if (err) return res.status(400).json({ success: false, message: err.message });
    next();
  });
}, async (req, res) => {
  try {
    if (!requireEditor(req, res)) return;
    const company = await loadCompany(req, res, req.body.companyId);
    if (!company) return;
    if (!req.file) return res.status(400).json({ success: false, message: "No file uploaded" });

    const result = await parseHolidayFile(req.file.buffer, req.file.originalname);
    if (result.missingColumns.length) {
      return res.status(400).json({
        success: false,
        message: `Missing required column(s): ${result.missingColumns.join(", ")}. Download the template to see the expected format.`,
      });
    }

    // Flag rows that will UPDATE an existing holiday rather than add one.
    const days = result.rows.map((r) => r.day).filter(Boolean);
    const existing = new Set(
      (await PublicHoliday.find({ company: company._id, day: { $in: days } }).select("day").lean()).map((h) => h.day)
    );
    for (const row of result.rows) {
      if (row.day && existing.has(row.day)) row.warnings.push("Already exists — will be updated");
    }

    res.json({ success: true, data: result });
  } catch (error) {
    console.error("POST holidays import preview error:", error);
    res.status(400).json({ success: false, message: "Could not read this file. Is it a valid .xlsx or .csv?", error: error.message });
  }
});

// ======================================================
// IMPORT COMMIT  POST /api/holidays/import/commit  { companyId, rows }
// Upserts by date. Rows with errors are refused outright rather than
// silently skipped, so HR always knows exactly what was saved.
// ======================================================
router.post("/import/commit", async (req, res) => {
  try {
    if (!requireEditor(req, res)) return;
    const company = await loadCompany(req, res, req.body.companyId);
    if (!company) return;

    const rows = Array.isArray(req.body.rows) ? req.body.rows : [];
    if (rows.length === 0) return res.status(400).json({ success: false, message: "Nothing to import" });

    // Re-validate server-side: never trust rows coming back from the client.
    const clean = [];
    for (const row of rows) {
      const day = toDayKey(row.day);
      const name = String(row.name || "").trim();
      if (!day || !name) {
        return res.status(400).json({ success: false, message: `Row ${row.row ?? "?"} is invalid (date or name). Fix the file and preview again.` });
      }
      clean.push({
        day,
        name: name.slice(0, 150),
        isWorkingDay: typeof row.isWorkingDay === "boolean" ? row.isWorkingDay : undefined,
        payRate: row.payRate === 1 || row.payRate === 2 ? row.payRate : undefined,
      });
    }

    let created = 0;
    let updated = 0;
    for (const row of clean) {
      const set = { name: row.name, updatedBy: req.user.id, year: Number(row.day.slice(0, 4)) };
      // Only overwrite the open/pay choices when the file actually
      // specified them — re-importing a list must not reset settings
      // HR already adjusted in the app.
      if (row.isWorkingDay !== undefined) set.isWorkingDay = row.isWorkingDay;
      if (row.payRate !== undefined) set.payRate = row.payRate;
      // eslint-disable-next-line no-await-in-loop
      const result = await PublicHoliday.updateOne(
        { company: company._id, day: row.day },
        { $set: set, $setOnInsert: { company: company._id, day: row.day, createdBy: req.user.id } },
        { upsert: true, runValidators: true }
      );
      if (result.upsertedCount) created += 1;
      else updated += 1;
    }

    await logAudit(req, {
      company: company._id,
      action: "create",
      resourceType: "PublicHoliday",
      resourceId: company._id,
      resourceLabel: `Imported public holidays: ${created} added, ${updated} updated`,
    });

    res.json({ success: true, data: { created, updated } });
  } catch (error) {
    console.error("POST holidays import commit error:", error);
    res.status(500).json({ success: false, message: "Error importing public holidays", error: error.message });
  }
});

// ======================================================
// CREATE  POST /api/holidays  { companyId, day, name, isWorkingDay?, payRate? }
// ======================================================
router.post("/", async (req, res) => {
  try {
    if (!requireEditor(req, res)) return;
    const company = await loadCompany(req, res, req.body.companyId);
    if (!company) return;
    const day = toDayKey(req.body.day);
    const name = String(req.body.name || "").trim();
    if (!day || !name) return res.status(400).json({ success: false, message: "A valid date and a name are required" });

    const holiday = await PublicHoliday.create({
      company: company._id,
      day,
      name,
      isWorkingDay: !!req.body.isWorkingDay,
      payRate: req.body.payRate === 1 ? 1 : 2,
      createdBy: req.user.id,
      updatedBy: req.user.id,
    });
    res.status(201).json({ success: true, data: holiday });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: "There's already a public holiday on this date" });
    }
    console.error("POST holiday error:", error);
    res.status(500).json({ success: false, message: "Error creating public holiday", error: error.message });
  }
});

// ======================================================
// UPDATE  PUT /api/holidays/:id  { name?, isWorkingDay?, payRate? }
// ======================================================
router.put("/:id", async (req, res) => {
  try {
    if (!requireEditor(req, res)) return;
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid holiday ID" });
    }
    const holiday = await PublicHoliday.findById(req.params.id);
    if (!holiday) return res.status(404).json({ success: false, message: "Public holiday not found" });
    if (!(await loadCompany(req, res, String(holiday.company)))) return;

    const { name, isWorkingDay, payRate } = req.body;
    if (name !== undefined) holiday.name = String(name).trim();
    if (typeof isWorkingDay === "boolean") holiday.isWorkingDay = isWorkingDay;
    if (payRate === 1 || payRate === 2) holiday.payRate = payRate;
    holiday.updatedBy = req.user.id;
    await holiday.save();

    res.json({ success: true, data: holiday });
  } catch (error) {
    console.error("PUT holiday error:", error);
    res.status(500).json({ success: false, message: "Error updating public holiday", error: error.message });
  }
});

// ======================================================
// DELETE  DELETE /api/holidays/:id
// ======================================================
router.delete("/:id", async (req, res) => {
  try {
    if (!requireEditor(req, res)) return;
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid holiday ID" });
    }
    const holiday = await PublicHoliday.findById(req.params.id);
    if (!holiday) return res.status(404).json({ success: false, message: "Public holiday not found" });
    if (!(await loadCompany(req, res, String(holiday.company)))) return;

    await holiday.deleteOne();
    res.json({ success: true, message: "Public holiday deleted" });
  } catch (error) {
    console.error("DELETE holiday error:", error);
    res.status(500).json({ success: false, message: "Error deleting public holiday", error: error.message });
  }
});

module.exports = router;
