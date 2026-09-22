const { parse } = require("csv-parse/sync");

const Employee = require("../models/Employee");
const Department = require("../models/Department");
const Salary = require("../models/Salary");

/**
 * ============================================================
 * BULK EMPLOYEE IMPORT
 * ============================================================
 * Two-step flow, mirroring how a spreadsheet import should feel:
 *
 *   1. previewImport(buffer, company) — parses the CSV and
 *      validates every row (required fields, duplicate employee
 *      numbers/CINs, unknown departments, bad dates...) WITHOUT
 *      writing anything to the database. Returns every row with
 *      its own errors/warnings so the frontend can show a
 *      row-by-row preview before anything is committed.
 *
 *   2. commitImport(rows, company, userId) — takes the (already
 *      previewed, already corrected) rows and actually creates the
 *      Employee records, one by one via Employee.create() rather
 *      than insertMany, so every model hook (translatable auto-
 *      translation, schema validation) still runs exactly like a
 *      normal single-employee creation would. Re-validates
 *      defensively first — the data set may have changed between
 *      preview and commit (e.g. someone else imported a colliding
 *      employee number in between) — and refuses to create ANYTHING
 *      if any row still has a hard error, rather than partially
 *      importing a batch and leaving the file's own bookkeeping
 *      out of sync with what actually landed in the database.
 * ============================================================
 */

const MAX_ROWS = 500;

const EMPLOYMENT_TYPES = ["permanent", "fixed_term", "temporary", "intern", "seasonal"];
const GENDERS = ["male", "female", "other"];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Accepts common spreadsheet date exports: ISO (2024-01-15),
// French/Moroccan dd/mm/yyyy, and dd-mm-yyyy.
function parseDate(value) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const d = new Date(trimmed);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const dmyMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmyMatch) {
    const [, day, month, year] = dmyMatch;
    const d = new Date(Number(year), Number(month) - 1, Number(day));
    return Number.isNaN(d.getTime()) ? null : d;
  }

  return null;
}

// Case/whitespace-insensitive header lookup, since spreadsheet
// exports vary ("First Name", "firstname", "First_Name"...).
function normalizeHeader(header) {
  return header.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

const HEADER_ALIASES = {
  firstname: "firstName",
  lastname: "lastName",
  employeenumber: "employeeNumber",
  matricule: "employeeNumber",
  cin: "cin",
  email: "email",
  workemail: "email",
  phone: "phone",
  telephone: "phone",
  gender: "gender",
  sexe: "gender",
  dateofbirth: "dateOfBirth",
  datenaissance: "dateOfBirth",
  hiredate: "hireDate",
  datedembauche: "hireDate",
  jobtitle: "jobTitle",
  poste: "jobTitle",
  department: "department",
  departement: "department",
  employmenttype: "employmentType",
  typecontrat: "employmentType",
  basesalary: "baseSalary",
  salairedebase: "baseSalary",
  salaire: "baseSalary",
};

function mapRow(rawRow) {
  const mapped = {};
  Object.entries(rawRow).forEach(([header, value]) => {
    const key = HEADER_ALIASES[normalizeHeader(header)];
    if (key) mapped[key] = typeof value === "string" ? value.trim() : value;
  });
  return mapped;
}

/**
 * Parses `buffer` as CSV and validates every row against `company`
 * (existing employee numbers/CINs, existing departments). Never
 * touches the database for writes — safe to call as many times as
 * needed while someone is still fixing their file.
 */
async function previewImport(buffer, company) {
  let records;
  try {
    records = parse(buffer, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
    });
  } catch (error) {
    const parseError = new Error(`Could not parse the file as CSV: ${error.message}`);
    parseError.status = 400;
    throw parseError;
  }

  if (records.length === 0) {
    const emptyError = new Error("The file has no data rows.");
    emptyError.status = 400;
    throw emptyError;
  }

  if (records.length > MAX_ROWS) {
    const tooLargeError = new Error(`This file has ${records.length} rows — the maximum per import is ${MAX_ROWS}. Split it into smaller files.`);
    tooLargeError.status = 400;
    throw tooLargeError;
  }

  const [existingEmployees, departments] = await Promise.all([
    Employee.find({ company: company._id }).select("employeeNumber cin"),
    Department.find({ company: company._id }).select("name"),
  ]);

  const existingNumbers = new Set(existingEmployees.map((e) => e.employeeNumber).filter(Boolean));
  const existingCins = new Set(existingEmployees.map((e) => e.cin).filter(Boolean));
  const departmentByName = new Map(departments.map((d) => [d.name.trim().toLowerCase(), d]));

  // The highest existing "EMP-####" sequence number for this
  // company, so auto-generated numbers continue smoothly rather
  // than restarting at 1 and immediately colliding.
  let nextSequence = existingEmployees.reduce((max, e) => {
    const match = /^EMP-(\d+)$/i.exec(e.employeeNumber || "");
    return match ? Math.max(max, parseInt(match[1], 10)) : max;
  }, 0) + 1;

  const seenNumbersInFile = new Set();
  const seenCinsInFile = new Set();

  const rows = records.map((rawRow, index) => {
    const data = mapRow(rawRow);
    const errors = [];
    const warnings = [];

    if (!data.firstName) errors.push("First name is required.");
    if (!data.lastName) errors.push("Last name is required.");

    const hireDate = parseDate(data.hireDate);
    if (!data.hireDate) {
      errors.push("Hire date is required.");
    } else if (!hireDate) {
      errors.push(`Could not read hire date "${data.hireDate}" — use YYYY-MM-DD or DD/MM/YYYY.`);
    }

    let employeeNumber = data.employeeNumber || "";
    if (employeeNumber) {
      if (existingNumbers.has(employeeNumber) || seenNumbersInFile.has(employeeNumber)) {
        errors.push(`Employee number "${employeeNumber}" is already used.`);
      }
      seenNumbersInFile.add(employeeNumber);
    } else {
      // Auto-generate — assigned now so the preview shows exactly
      // what will be created, not just "(auto)".
      employeeNumber = `EMP-${String(nextSequence).padStart(4, "0")}`;
      nextSequence += 1;
      warnings.push(`No employee number given — will be assigned "${employeeNumber}".`);
    }

    if (data.cin) {
      if (existingCins.has(data.cin) || seenCinsInFile.has(data.cin)) {
        errors.push(`CIN "${data.cin}" is already used.`);
      }
      seenCinsInFile.add(data.cin);
    }

    if (data.email && !EMAIL_RE.test(data.email)) {
      warnings.push(`"${data.email}" doesn't look like a valid email — it will be left blank.`);
      data.email = "";
    }

    let departmentId = null;
    if (data.department) {
      const match = departmentByName.get(data.department.trim().toLowerCase());
      if (match) {
        departmentId = match._id;
      } else {
        warnings.push(`Department "${data.department}" doesn't exist yet — the employee will be created without one.`);
      }
    }

    let dateOfBirth = null;
    if (data.dateOfBirth) {
      dateOfBirth = parseDate(data.dateOfBirth);
      if (!dateOfBirth) warnings.push(`Could not read date of birth "${data.dateOfBirth}" — it will be left blank.`);
    }

    let employmentType = "permanent";
    if (data.employmentType) {
      const normalized = data.employmentType.trim().toLowerCase().replace(/[\s-]+/g, "_");
      if (EMPLOYMENT_TYPES.includes(normalized)) {
        employmentType = normalized;
      } else {
        warnings.push(`Unknown employment type "${data.employmentType}" — defaulting to "permanent".`);
      }
    }

    let gender = null;
    if (data.gender) {
      const normalized = data.gender.trim().toLowerCase();
      if (GENDERS.includes(normalized)) {
        gender = normalized;
      } else {
        warnings.push(`Unknown gender "${data.gender}" — it will be left blank.`);
      }
    }

    let baseSalary = null;
    if (data.baseSalary) {
      // Strip currency symbols/thousands separators but KEEP a
      // leading minus sign — stripping it too would silently turn
      // an invalid negative value into a valid positive one.
      const numeric = Number(String(data.baseSalary).replace(/[^\d.-]/g, ""));
      if (!Number.isNaN(numeric) && numeric >= 0) {
        baseSalary = numeric;
      } else {
        warnings.push(`Could not read base salary "${data.baseSalary}" — no salary record will be created.`);
      }
    }

    return {
      rowNumber: index + 2, // +1 for 0-index, +1 for the header row itself
      firstName: data.firstName || "",
      lastName: data.lastName || "",
      employeeNumber,
      cin: data.cin || "",
      email: data.email || "",
      phone: data.phone || "",
      gender,
      dateOfBirth,
      hireDate,
      jobTitle: data.jobTitle || "",
      department: data.department || "",
      departmentId,
      employmentType,
      baseSalary,
      errors,
      warnings,
    };
  });

  return {
    rows,
    validCount: rows.filter((r) => r.errors.length === 0).length,
    errorCount: rows.filter((r) => r.errors.length > 0).length,
    warningCount: rows.filter((r) => r.warnings.length > 0).length,
  };
}

/**
 * Creates one Employee (and, if a baseSalary was given, one Salary
 * record) per row. Refuses to create ANYTHING if any row still has
 * a hard error — re-run previewImport if the data may be stale.
 */
async function commitImport(rows, company, userId) {
  if (!Array.isArray(rows) || rows.length === 0) {
    const error = new Error("No rows to import.");
    error.status = 400;
    throw error;
  }
  if (rows.length > MAX_ROWS) {
    const error = new Error(`Too many rows — the maximum per import is ${MAX_ROWS}.`);
    error.status = 400;
    throw error;
  }

  // Defensive re-validation against the CURRENT state of the
  // database — the preview could be minutes old.
  const [existingEmployees] = await Promise.all([
    Employee.find({ company: company._id }).select("employeeNumber cin"),
  ]);
  const existingNumbers = new Set(existingEmployees.map((e) => e.employeeNumber).filter(Boolean));
  const existingCins = new Set(existingEmployees.map((e) => e.cin).filter(Boolean));

  const seenNumbers = new Set();
  const seenCins = new Set();
  const revalidationErrors = [];

  rows.forEach((row) => {
    if (!row.firstName || !row.lastName || !row.hireDate) {
      revalidationErrors.push(`Row ${row.rowNumber}: missing a required field.`);
      return;
    }
    if (!row.employeeNumber || existingNumbers.has(row.employeeNumber) || seenNumbers.has(row.employeeNumber)) {
      revalidationErrors.push(`Row ${row.rowNumber}: employee number "${row.employeeNumber}" is missing or already used.`);
    }
    seenNumbers.add(row.employeeNumber);
    if (row.cin && (existingCins.has(row.cin) || seenCins.has(row.cin))) {
      revalidationErrors.push(`Row ${row.rowNumber}: CIN "${row.cin}" is already used.`);
    }
    if (row.cin) seenCins.add(row.cin);
  });

  if (revalidationErrors.length > 0) {
    const error = new Error(
      `The data has changed since it was last checked — please re-run the preview. ${revalidationErrors.slice(0, 5).join(" ")}`
    );
    error.status = 409;
    throw error;
  }

  const created = [];
  for (const row of rows) {
    // eslint-disable-next-line no-await-in-loop
    const employee = await Employee.create({
      company: company._id,
      employeeNumber: row.employeeNumber,
      firstName: row.firstName,
      lastName: row.lastName,
      cin: row.cin || undefined,
      workEmail: row.email || undefined,
      phone: row.phone || undefined,
      gender: row.gender || undefined,
      dateOfBirth: row.dateOfBirth || undefined,
      hireDate: row.hireDate,
      jobTitle: row.jobTitle || undefined,
      department: row.departmentId || undefined,
      employmentType: row.employmentType,
      createdBy: userId,
    });

    if (row.baseSalary !== null && row.baseSalary !== undefined) {
      // eslint-disable-next-line no-await-in-loop
      await Salary.create({
        company: company._id,
        employee: employee._id,
        baseSalary: row.baseSalary,
        effectiveDate: row.hireDate,
        createdBy: userId,
      });
    }

    created.push(employee);
  }

  return { createdCount: created.length, employees: created };
}

module.exports = { previewImport, commitImport, MAX_ROWS };
