/**
 * ============================================================
 * UNSEED SCRIPT
 * ============================================================
 * Removes everything scripts/seed.js created, and nothing else.
 * Safe to run against a database that also has real data in it —
 * unlike seed.js (which wipes whole collections), this only
 * deletes records that actually belong to the seeded company.
 *
 * How it finds "the seeded company" safely: seed.js always creates
 * exactly one company named "Atlas Industries" whose owner account
 * is owner@frame.test. Both have to match for this to delete
 * anything — a real company that merely happens to share one of
 * those two details (an unrelated company also named "Atlas
 * Industries", or a real owner who separately chose the email
 * owner@frame.test) is NOT enough to match, and nothing is deleted.
 * If neither is found, the script exits immediately without
 * touching the database at all.
 *
 * Run with:  npm run unseed   (from backend/)
 * or:        node scripts/unseed.js
 * ============================================================
 */

const mongoose = require("mongoose");
require("dotenv").config();

const User = require("../models/User");
const Company = require("../models/Company");
const Employee = require("../models/Employee");
const Department = require("../models/Department");
const JobPosition = require("../models/JobPosition");
const Salary = require("../models/Salary");
const Contract = require("../models/Contract");
const Absence = require("../models/Absence");
const Advance = require("../models/Advance");
const EmployeeDocument = require("../models/EmployeeDocument");
const Attendance = require("../models/Attendance");
const PayrollRun = require("../models/PayrollRun");
const Payslip = require("../models/Payslip");
const Notification = require("../models/Notification");
const AuditLog = require("../models/AuditLog");
const InventoryCategory = require("../models/InventoryCategory");
const Product = require("../models/Product");
const PurchaseRequest = require("../models/PurchaseRequest");
const PerformanceReview = require("../models/PerformanceReview");
const DisciplinaryAction = require("../models/DisciplinaryAction");
const PublicHoliday = require("../models/PublicHoliday");

const SEED_COMPANY_NAME = "Atlas Industries";
const SEED_OWNER_EMAIL = "owner@frame.test";
// Every user account seed.js creates uses this email domain — used
// below to delete exactly those accounts and no others, even if an
// unrelated real user happens to share a first/last name with one
// of them.
const SEED_EMAIL_DOMAIN = "@frame.test";

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("✓ Connected to MongoDB");

  const owner = await User.findOne({ email: SEED_OWNER_EMAIL });
  const company = await Company.findOne({ name: SEED_COMPANY_NAME, owner: owner?._id });

  if (!owner || !company) {
    console.log("No seeded company found (looked for a company named " +
      `"${SEED_COMPANY_NAME}" owned by ${SEED_OWNER_EMAIL}) — nothing to remove.`);
    console.log("If you renamed things after seeding, delete manually instead of guessing.");
    await mongoose.disconnect();
    process.exit(0);
  }

  const companyId = company._id;
  console.log(`Found seeded company "${company.name}" (${companyId}) — removing its data...`);

  // Company-scoped collections: everything with a `company` field
  // pointing at this exact company. Deleting these first (before
  // the company/users themselves) means nothing here can end up
  // orphaned even if the script is interrupted partway through.
  const [
    { deletedCount: employeesDeleted },
    { deletedCount: departmentsDeleted },
    { deletedCount: positionsDeleted },
    { deletedCount: salariesDeleted },
    { deletedCount: contractsDeleted },
    { deletedCount: absencesDeleted },
    { deletedCount: advancesDeleted },
    { deletedCount: documentsDeleted },
    { deletedCount: attendanceDeleted },
    { deletedCount: payrollRunsDeleted },
    { deletedCount: payslipsDeleted },
    { deletedCount: categoriesDeleted },
    { deletedCount: productsDeleted },
    { deletedCount: purchaseRequestsDeleted },
    { deletedCount: reviewsDeleted },
    { deletedCount: disciplinaryDeleted },
    { deletedCount: auditLogsDeleted },
    { deletedCount: holidaysDeleted },
  ] = await Promise.all([
    Employee.deleteMany({ company: companyId }),
    Department.deleteMany({ company: companyId }),
    JobPosition.deleteMany({ company: companyId }),
    Salary.deleteMany({ company: companyId }),
    Contract.deleteMany({ company: companyId }),
    Absence.deleteMany({ company: companyId }),
    Advance.deleteMany({ company: companyId }),
    EmployeeDocument.deleteMany({ company: companyId }),
    Attendance.deleteMany({ company: companyId }),
    PayrollRun.deleteMany({ company: companyId }),
    Payslip.deleteMany({ company: companyId }),
    InventoryCategory.deleteMany({ company: companyId }),
    Product.deleteMany({ company: companyId }),
    PurchaseRequest.deleteMany({ company: companyId }),
    PerformanceReview.deleteMany({ company: companyId }),
    DisciplinaryAction.deleteMany({ company: companyId }),
    AuditLog.deleteMany({ company: companyId }),
    PublicHoliday.deleteMany({ company: companyId }),
  ]);

  // Users: matched by email domain, not by company — a User
  // document has no `company` field of its own (company membership
  // is expressed the other way around, via Company.owner and
  // Employee links), so the email domain is the only safe way to
  // identify exactly the accounts seed.js created.
  const seededUsers = await User.find({ email: { $regex: `${SEED_EMAIL_DOMAIN}$`, $options: "i" } }).select("_id");
  const seededUserIds = seededUsers.map((u) => u._id);

  // Notifications are keyed by `user`, not `company` — delete the
  // ones belonging to the seeded accounts specifically.
  const { deletedCount: notificationsDeleted } = await Notification.deleteMany({ user: { $in: seededUserIds } });

  const { deletedCount: usersDeleted } = await User.deleteMany({ email: { $regex: `${SEED_EMAIL_DOMAIN}$`, $options: "i" } });

  // The company itself, last — everything that referenced it is
  // already gone.
  await Company.findByIdAndDelete(companyId);

  console.log("\n============================================================");
  console.log("UNSEED COMPLETE:");
  console.log("============================================================");
  console.log(`  Company:              1 ("${company.name}")`);
  console.log(`  Users:                ${usersDeleted}`);
  console.log(`  Employees:            ${employeesDeleted}`);
  console.log(`  Departments:          ${departmentsDeleted}`);
  console.log(`  Job positions:        ${positionsDeleted}`);
  console.log(`  Salaries:             ${salariesDeleted}`);
  console.log(`  Contracts:            ${contractsDeleted}`);
  console.log(`  Absences:             ${absencesDeleted}`);
  console.log(`  Advances:             ${advancesDeleted}`);
  console.log(`  Documents:            ${documentsDeleted}`);
  console.log(`  Attendance records:   ${attendanceDeleted}`);
  console.log(`  Payroll runs:         ${payrollRunsDeleted}`);
  console.log(`  Payslips:             ${payslipsDeleted}`);
  console.log(`  Inventory categories: ${categoriesDeleted}`);
  console.log(`  Products:             ${productsDeleted}`);
  console.log(`  Purchase requests:    ${purchaseRequestsDeleted}`);
  console.log(`  Performance reviews:  ${reviewsDeleted}`);
  console.log(`  Disciplinary actions: ${disciplinaryDeleted}`);
  console.log(`  Notifications:        ${notificationsDeleted}`);
  console.log(`  Audit log entries:    ${auditLogsDeleted}`);
  console.log(`  Public holidays:      ${holidaysDeleted}`);
  console.log("============================================================");
  console.log("Everything else in the database was left untouched.");
  console.log("============================================================\n");

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((error) => {
  console.error("Unseed failed:", error);
  process.exit(1);
});
