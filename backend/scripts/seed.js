/**
 * ============================================================
 * SEED SCRIPT
 * ============================================================
 * Populates the database with a realistic, interconnected set of
 * test data covering every module: users at every access tier
 * (admin, owner, full HR, hr_assistant-tier HR, manager, employee —
 * see the printed account list at the end), a company, departments
 * with real job positions, employees (including a manager -> report
 * relationship for testing manager-approval routing), salaries,
 * contracts, absences, advances, documents, attendance, a completed
 * payroll run, inventory (categories, products, purchase requests),
 * performance reviews, a disciplinary action, and notifications.
 *
 * Run with:  npm run seed      (from backend/)
 * or:        node scripts/seed.js
 *
 * This WIPES the collections it touches before reseeding, so don't
 * run it against a database you care about. When you're done
 * testing, `npm run unseed` removes everything this script created
 * WITHOUT touching any other data — see scripts/unseed.js for how
 * it identifies what's safe to delete.
 * ============================================================
 */

const mongoose = require("mongoose");
require("dotenv").config();
const { syncEmployeeIndexes } = require("../utils/syncEmployeeIndexes");

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
const { MOROCCO_FIXED_HOLIDAYS } = require("../config/moroccoFixedHolidays");

const { calculatePayslip } = require("../services/payrollCalculationService");

// A real, publicly-hosted sample PDF — used for the seeded document
// records so "View" works out of the box without needing your own
// Cloudinary upload for every seeded document.
const SAMPLE_PDF_URL =
  "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf";

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(0, 0, 0, 0);
  return d;
}

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("✓ Connected to MongoDB");

  console.log("Clearing existing data...");
  await Promise.all([
    User.deleteMany({}),
    Company.deleteMany({}),
    Employee.deleteMany({}),
    Department.deleteMany({}),
    JobPosition.deleteMany({}),
    Salary.deleteMany({}),
    Contract.deleteMany({}),
    Absence.deleteMany({}),
    Advance.deleteMany({}),
    EmployeeDocument.deleteMany({}),
    Attendance.deleteMany({}),
    PayrollRun.deleteMany({}),
    Payslip.deleteMany({}),
    Notification.deleteMany({}),
    AuditLog.deleteMany({}),
    InventoryCategory.deleteMany({}),
    Product.deleteMany({}),
    PurchaseRequest.deleteMany({}),
    PerformanceReview.deleteMany({}),
    DisciplinaryAction.deleteMany({}),
    PublicHoliday.deleteMany({}),
  ]);

  // Rebuild the CIN/CNSS uniqueness indexes if this database still has
  // the old (broken) sparse versions — see utils/syncEmployeeIndexes.js.
  await syncEmployeeIndexes();

  // ==========================================================
  // USERS
  // ==========================================================
  // Passwords are plain text here — User's pre('save') hook
  // hashes them automatically.

  const admin = await User.create({
    firstName: "Amine",
    lastName: "Admin",
    email: "admin@frame.test",
    password: "Admin@123",
    role: "admin",
    department: "it",
  });

  const owner = await User.create({
    firstName: "Sara",
    lastName: "Owner",
    email: "owner@frame.test",
    password: "Owner@123",
    role: "owner",
    department: "management",
  });

  const hrUser = await User.create({
    firstName: "Yassine",
    lastName: "RH",
    email: "hr@frame.test",
    password: "Hr@12345",
    role: "user",
    department: "hr",
  });

  // These two get linked to Employee records further down, once
  // those employees exist — that's what unlocks their My Space
  // self-service pages.
  const managerUser = await User.create({
    firstName: "Nabil",
    lastName: "Manager",
    email: "manager@frame.test",
    password: "Manager@123",
    role: "user",
    department: "production",
  });

  const employeeUser = await User.create({
    firstName: "Imane",
    lastName: "Employee",
    email: "employee@frame.test",
    password: "Employee@123",
    role: "user",
    // No department: she's an Opérateur de Production, a position
    // that doesn't grant module access — so she gets My Space only,
    // exactly what computeInheritedPermissions would derive.
  });

  // A SECOND HR login, deliberately at the lowest tier (hr_assistant)
  // — hrUser above has no hrRole set at all, which defaults to full
  // manager-tier access (see permissions/permissions.js's
  // backward-compat guarantee), so it doesn't actually exercise the
  // tier restrictions. This one does: hrAssistantUser can view
  // records but canManageEmployeeRecords/canApproveHRRequests/etc.
  // should all come back false for it — useful for testing that the
  // tier gates are actually being enforced, not just present.
  // HR department manager: Directeur RH. Linked to EMP-007 below and
  // set as the HR department's manager — top HR tier, sees
  // My Space > My department for HR.
  const hrManagerUser = await User.create({
    firstName: "Karima",
    lastName: "Alaoui",
    email: "hr-manager@frame.test",
    password: "HrManager@123",
    role: "user",
    department: "hr",
    hrRole: "hr_director",
  });

  const hrAssistantUser = await User.create({
    firstName: "Salma",
    lastName: "Idrissi",
    email: "hr-assistant@frame.test",
    password: "HrAssist@123",
    role: "user",
    department: "hr",
    hrRole: "hr_assistant",
  });

  console.log("✓ Users created");

  // ==========================================================
  // COMPANY
  // ==========================================================

  const company = await Company.create({
    name: "Atlas Industries",
    legalForm: "SARL",
    industry: "Manufacturing",
    size: "medium",
    currency: "MAD",
    owner: owner._id,
    email: "contact@atlas-industries.test",
    phone: "+212522000000",
    address: {
      city: "Casablanca",
      region: "Casablanca-Settat",
      street: "Zone Industrielle Ain Sebaa",
    },
    employeeCount: 0,
  });

  console.log("✓ Company created:", company.name);

  // ==========================================================
  // DEPARTMENTS + JOB POSITIONS
  // ==========================================================
  // Replaces the old fixed enum — these are now real, company-
  // defined records (Organization -> Departments). Only the HR and
  // Production departments carry a permissionKey: that's what lets
  // an auto-created login for an employee in one of THOSE
  // departments get the matching module access (see
  // services/employeeAccountService.js) — every other department
  // is just organizational data with no special access implied.

  const departmentDefs = [
    { name: "Ressources Humaines", permissionKey: "hr", description: "Gestion du personnel et de la paie" },
    { name: "Production", permissionKey: "production", description: "Fabrication et gestion des stocks" },
    { name: "Finance", permissionKey: null },
    { name: "Ventes", permissionKey: null },
    { name: "Direction", permissionKey: null },
  ];

  const departmentsByName = {};
  for (const def of departmentDefs) {
    const department = await Department.create({
      company: company._id,
      name: def.name,
      description: def.description,
      permissionKey: def.permissionKey,
      createdBy: hrUser._id,
      updatedBy: hrUser._id,
    });
    departmentsByName[def.name] = department;
  }

  console.log(`✓ ${departmentDefs.length} departments created`);

  const productionDept = departmentsByName["Production"];
  const hrDept = departmentsByName["Ressources Humaines"];
  const financeDept = departmentsByName["Finance"];
  const salesDept = departmentsByName["Ventes"];
  const directionDept = departmentsByName["Direction"];

  const productionManagerPosition = await JobPosition.create({
    company: company._id,
    department: productionDept._id,
    title: "Responsable de Production",
    // Management unlocks the Production (inventory) module for the
    // holder's login; the operator position below does not.
    grantsModuleAccess: true,
    salaryBandMin: 12000,
    salaryBandMax: 18000,
    currency: "MAD",
    requiredSkills: ["Gestion d'équipe", "Lean manufacturing", "Excel avancé"],
    createdBy: hrUser._id,
    updatedBy: hrUser._id,
  });

  const productionOperatorPosition = await JobPosition.create({
    company: company._id,
    department: productionDept._id,
    title: "Opérateur de Production",
    salaryBandMin: 4000,
    salaryBandMax: 6500,
    currency: "MAD",
    requiredSkills: ["Sécurité industrielle"],
    reportsTo: productionManagerPosition._id,
    createdBy: hrUser._id,
    updatedBy: hrUser._id,
  });

  console.log("✓ 2 job positions created (with a reporting line between them)");

  // ==========================================================
  // EMPLOYEES
  // ==========================================================

  const managerEmployee = await Employee.create({
    company: company._id,
    employeeNumber: "EMP-001",
    firstName: "Nabil",
    lastName: "Manager",
    gender: "male",
    dateOfBirth: new Date("1985-03-14"),
    nationality: "Moroccan",
    maritalStatus: "married",
    numberOfDependents: 2,
    cin: "BE123456",
    phone: "+212600000001",
    workEmail: "manager@frame.test",
    hireDate: daysAgo(1200), // ~3+ years ago, for a real leave balance
    employmentStatus: "active",
    employmentType: "permanent",
    jobTitle: "Responsable de Production", // must match the JobPosition title exactly
    department: productionDept._id,
    jobPosition: productionManagerPosition._id,
    workLocation: "Casablanca Plant",
    cnssNumber: "CNSS-0001",
    createdBy: hrUser._id,
    updatedBy: hrUser._id,
  });

  const reportEmployee = await Employee.create({
    company: company._id,
    employeeNumber: "EMP-002",
    firstName: "Imane",
    lastName: "Employee",
    gender: "female",
    dateOfBirth: new Date("1994-07-22"),
    nationality: "Moroccan",
    maritalStatus: "single",
    numberOfDependents: 0,
    cin: "BE234567",
    phone: "+212600000002",
    workEmail: "employee@frame.test",
    hireDate: daysAgo(400),
    employmentStatus: "active",
    employmentType: "permanent",
    jobTitle: "Opérateur de Production", // must match the JobPosition title exactly
    department: productionDept._id,
    workLocation: "Casablanca Plant",
    manager: managerEmployee._id,
    cnssNumber: "CNSS-0002",
    createdBy: hrUser._id,
    updatedBy: hrUser._id,
  });

  const extraEmployeesData = [
    {
      employeeNumber: "EMP-003",
      firstName: "Khadija",
      lastName: "Alaoui",
      gender: "female",
      jobTitle: "Accountant",
      department: financeDept._id,
      employmentType: "permanent",
      manager: null,
      hireDate: daysAgo(900),
    },
    {
      employeeNumber: "EMP-004",
      firstName: "Youssef",
      lastName: "Benali",
      gender: "male",
      jobTitle: "Sales Representative",
      department: salesDept._id,
      employmentType: "fixed_term",
      manager: null,
      hireDate: daysAgo(150),
    },
    {
      employeeNumber: "EMP-005",
      firstName: "Salma",
      lastName: "Idrissi",
      gender: "female",
      jobTitle: "Assistant RH", // exact canonical title — see config match in services/employeeAccountService.js
      department: hrDept._id,
      employmentType: "permanent",
      manager: null,
      hireDate: daysAgo(600),
    },
    {
      employeeNumber: "EMP-006",
      firstName: "Omar",
      lastName: "Tahiri",
      gender: "male",
      jobTitle: "Opérateur de Production",
      department: productionDept._id,
      employmentType: "temporary",
      manager: managerEmployee._id,
      hireDate: daysAgo(60),
      jobPosition: productionOperatorPosition._id,
    },
    {
      employeeNumber: "EMP-007",
      firstName: "Karima",
      lastName: "Alaoui",
      gender: "female",
      jobTitle: "Directeur RH", // exact canonical HR title
      department: hrDept._id,
      employmentType: "permanent",
      manager: null,
      hireDate: daysAgo(1500),
    },
    {
      employeeNumber: "EMP-008",
      firstName: "Hassan",
      lastName: "Benjelloun",
      gender: "male",
      jobTitle: "Directeur Général",
      department: directionDept._id,
      employmentType: "permanent",
      manager: null,
      hireDate: daysAgo(3000),
    },
  ];

  const extraEmployees = [];
  for (const data of extraEmployeesData) {
    const emp = await Employee.create({
      company: company._id,
      gender: data.gender,
      maritalStatus: "single",
      numberOfDependents: 0,
      nationality: "Moroccan",
      employmentStatus: "active",
      workLocation: "Casablanca Plant",
      createdBy: hrUser._id,
      updatedBy: hrUser._id,
      ...data,
    });
    extraEmployees.push(emp);
  }

  const allEmployees = [managerEmployee, reportEmployee, ...extraEmployees];

  await Company.findByIdAndUpdate(company._id, {
    employeeCount: allEmployees.length,
  });

  console.log(`✓ ${allEmployees.length} employees created`);

  // Every department has a manager. Each one gets department-wide
  // approvals, full module access where the department unlocks one,
  // and the "My department" page to decide which job titles get
  // module access. (Admins oversee all departments on top of this.)
  const byNumber = Object.fromEntries(allEmployees.map((e) => [e.employeeNumber, e]));
  const departmentManagers = [
    [productionDept, byNumber["EMP-001"]], // Nabil — Responsable de Production
    [hrDept, byNumber["EMP-007"]],         // Karima — Directeur RH
    [financeDept, byNumber["EMP-003"]],
    [salesDept, byNumber["EMP-004"]],
    [directionDept, byNumber["EMP-008"]],  // Hassan — Directeur Général
  ];
  for (const [department, employee] of departmentManagers) {
    await Department.findByIdAndUpdate(department._id, { manager: employee._id });
  }
  console.log(`✓ A manager assigned to each of the ${departmentManagers.length} departments`);

  // Link the manager/employee test accounts to their Employee
  // records — this is exactly what Employees > (row) > "Link user
  // account" does in the UI.
  await User.findByIdAndUpdate(managerUser._id, { employee: managerEmployee._id });
  await User.findByIdAndUpdate(employeeUser._id, { employee: reportEmployee._id });
  // extraEmployees[2] is EMP-005 (Salma Idrissi) — see extraEmployeesData
  // above. hrRole/department were already set directly on
  // hrAssistantUser at creation, matching exactly what the real
  // inheritance route (PUT /users/:id) would derive from this
  // employee's department + "Assistant RH" job title — see
  // services/employeeAccountService.js's computeInheritedPermissions.
  await User.findByIdAndUpdate(hrAssistantUser._id, { employee: extraEmployees[2]._id });
  await User.findByIdAndUpdate(hrManagerUser._id, { employee: byNumber["EMP-007"]._id });

  console.log("✓ Linked manager@frame.test, employee@frame.test, and hr-assistant@frame.test to their employee records");

  // ==========================================================
  // SALARIES (current, for every employee)
  // ==========================================================

  const baseSalaries = {
    "EMP-001": 14000,
    "EMP-002": 6500,
    "EMP-003": 9000,
    "EMP-004": 7500,
    "EMP-005": 6000,
    "EMP-006": 4200,
    "EMP-007": 18000,
    "EMP-008": 30000,
  };

  const salaryByEmployee = {};

  for (const emp of allEmployees) {
    const base = baseSalaries[emp.employeeNumber] || 5000;
    const salary = await Salary.create({
      company: company._id,
      employee: emp._id,
      baseSalary: base,
      allowances: [{ label: "Transport", amount: 500 }],
      currency: "MAD",
      effectiveDate: emp.hireDate,
      endDate: null,
      createdBy: hrUser._id,
      updatedBy: hrUser._id,
    });
    salaryByEmployee[emp._id.toString()] = salary;
  }

  console.log("✓ Salaries created");

  // ==========================================================
  // CONTRACTS
  // ==========================================================

  for (const emp of allEmployees) {
    const isFixedTerm = emp.employmentType === "fixed_term" || emp.employmentType === "temporary";
    await Contract.create({
      company: company._id,
      employee: emp._id,
      type: emp.employmentType,
      startDate: emp.hireDate,
      // Youssef Benali's fixed-term contract expires soon, to
      // exercise the "expiring contracts" banner.
      endDate: emp.employeeNumber === "EMP-004" ? daysFromNow(20) : isFixedTerm ? daysFromNow(90) : null,
      jobTitle: emp.jobTitle,
      status: "active",
      createdBy: hrUser._id,
      updatedBy: hrUser._id,
    });
  }

  console.log("✓ Contracts created (one expiring in 20 days, for EMP-004)");

  // ==========================================================
  // ABSENCES
  // ==========================================================

  await Absence.create([
    {
      company: company._id,
      employee: reportEmployee._id,
      type: "paid_leave",
      startDate: daysAgo(30),
      endDate: daysAgo(26),
      daysCount: 5,
      justified: true,
      reason: "Family trip",
      status: "accepted",
      requestedBy: employeeUser._id,
      reviewedBy: hrUser._id,
      reviewedAt: daysAgo(32),
      createdBy: employeeUser._id,
      updatedBy: hrUser._id,
    },
    {
      company: company._id,
      employee: reportEmployee._id,
      type: "sick_leave",
      startDate: daysFromNow(2),
      endDate: daysFromNow(3),
      daysCount: 2,
      justified: true,
      reason: "Doctor's appointment and recovery",
      status: "pending",
      requestedBy: employeeUser._id,
      createdBy: employeeUser._id,
      updatedBy: employeeUser._id,
    },
    {
      company: company._id,
      employee: extraEmployees[3]._id, // Omar Tahiri
      type: "absence",
      startDate: daysAgo(5),
      endDate: daysAgo(5),
      daysCount: 1,
      justified: false,
      reason: "",
      status: "rejected",
      requestedBy: hrUser._id,
      reviewedBy: hrUser._id,
      reviewedAt: daysAgo(4),
      reviewComment: "No advance notice or justification provided.",
      createdBy: hrUser._id,
      updatedBy: hrUser._id,
    },
    {
      company: company._id,
      employee: extraEmployees[0]._id, // Khadija Alaoui
      type: "unpaid_leave",
      startDate: daysFromNow(10),
      endDate: daysFromNow(14),
      daysCount: 5,
      justified: true,
      reason: "Personal matters",
      status: "pending",
      requestedBy: hrUser._id,
      createdBy: hrUser._id,
      updatedBy: hrUser._id,
    },
  ]);

  console.log("✓ Absences created (pending / accepted / rejected)");

  // ==========================================================
  // ADVANCES
  // ==========================================================

  await Advance.create([
    {
      company: company._id,
      employee: reportEmployee._id,
      amount: 1500,
      currency: "MAD",
      requestDate: daysAgo(20),
      reason: "Car repair",
      status: "accepted",
      requestedBy: employeeUser._id,
      reviewedBy: hrUser._id,
      reviewedAt: daysAgo(19),
      repaidAmount: 500,
      repaid: false,
      createdBy: employeeUser._id,
      updatedBy: hrUser._id,
    },
    {
      company: company._id,
      employee: managerEmployee._id,
      amount: 2000,
      currency: "MAD",
      requestDate: daysAgo(2),
      reason: "Medical expenses",
      status: "pending",
      requestedBy: managerUser._id,
      createdBy: managerUser._id,
      updatedBy: managerUser._id,
    },
    {
      company: company._id,
      employee: extraEmployees[2]._id, // Salma Idrissi
      amount: 800,
      currency: "MAD",
      requestDate: daysAgo(45),
      reason: "Rent",
      status: "rejected",
      requestedBy: hrUser._id,
      reviewedBy: hrUser._id,
      reviewedAt: daysAgo(44),
      reviewComment: "Already has an unpaid advance from last quarter.",
      createdBy: hrUser._id,
      updatedBy: hrUser._id,
    },
  ]);

  console.log("✓ Advances created (pending / accepted with partial repayment / rejected)");

  // ==========================================================
  // DOCUMENTS
  // ==========================================================

  await EmployeeDocument.create([
    {
      company: company._id,
      employee: reportEmployee._id,
      type: "cin",
      label: "National ID card",
      file: { url: SAMPLE_PDF_URL, originalName: "cin-imane.pdf" },
      issueDate: daysAgo(1000),
      expiryDate: daysFromNow(15), // exercises the "expiring soon" banner
      uploadedBy: hrUser._id,
    },
    {
      company: company._id,
      employee: managerEmployee._id,
      type: "work_permit",
      label: "Work permit",
      file: { url: SAMPLE_PDF_URL, originalName: "work-permit-nabil.pdf" },
      issueDate: daysAgo(600),
      expiryDate: daysFromNow(400),
      uploadedBy: hrUser._id,
    },
    {
      company: company._id,
      employee: extraEmployees[0]._id,
      type: "diploma",
      label: "Accounting diploma",
      file: { url: SAMPLE_PDF_URL, originalName: "diploma-khadija.pdf" },
      uploadedBy: hrUser._id,
    },
  ]);

  console.log("✓ Documents created (one expiring in 15 days)");

  // ==========================================================
  // ATTENDANCE (last 5 working days, for the two linked employees)
  // ==========================================================

  for (const emp of [managerEmployee, reportEmployee]) {
    for (let i = 1; i <= 5; i += 1) {
      const date = daysAgo(i);
      const clockIn = new Date(date);
      clockIn.setHours(9, Math.floor(Math.random() * 15), 0, 0);
      const clockOut = new Date(date);
      clockOut.setHours(17, Math.floor(Math.random() * 30), 0, 0);

      await Attendance.create({
        company: company._id,
        employee: emp._id,
        date,
        clockIn,
        clockOut,
        status: clockIn.getMinutes() > 10 ? "late" : "present",
        hoursWorked: 8,
        lateMinutes: clockIn.getMinutes() > 10 ? clockIn.getMinutes() - 10 : 0,
        source: "self",
      });
    }
  }

  console.log("✓ Attendance history created (today intentionally left unclocked, to test Clock In)");

  // ==========================================================
  // PAYROLL — one completed run for last month
  // ==========================================================

  const now = new Date();
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonth = lastMonthDate.getMonth() + 1;
  const lastMonthYear = lastMonthDate.getFullYear();

  const payrollRun = await PayrollRun.create({
    company: company._id,
    month: lastMonth,
    year: lastMonthYear,
    status: "completed",
    completedAt: daysAgo(3),
    createdBy: hrUser._id,
    updatedBy: hrUser._id,
  });

  let totalGross = 0;
  let totalNet = 0;
  let totalEmployerCost = 0;

  for (const emp of allEmployees) {
    const salary = salaryByEmployee[emp._id.toString()];
    const calc = calculatePayslip({
      baseSalary: salary.baseSalary,
      allowances: salary.allowances,
      numberOfDependents: emp.numberOfDependents || 0,
    });

    await Payslip.create({
      company: company._id,
      employee: emp._id,
      payrollRun: payrollRun._id,
      month: lastMonth,
      year: lastMonthYear,
      currency: calc.currency,
      baseSalary: calc.baseSalary,
      allowances: calc.allowances,
      allowanceTotal: calc.allowanceTotal,
      grossSalary: calc.grossSalary,
      cnssEmployee: calc.cnssEmployee,
      amoEmployee: calc.amoEmployee,
      cimrEmployee: calc.cimrEmployee,
      professionalExpenses: calc.professionalExpenses,
      monthlyTaxableIncome: calc.monthlyTaxableIncome,
      incomeTax: calc.incomeTax,
      familyDeduction: calc.familyDeduction,
      totalEmployeeDeductions: calc.totalEmployeeDeductions,
      netSalary: calc.netSalary,
      employerCnss: calc.employer.cnssEmployer,
      employerVocationalTraining: calc.employer.vocationalTraining,
      employerAmo: calc.employer.amoEmployer,
      employerCimr: calc.employer.cimrEmployer,
      totalEmployerCost: calc.employer.totalEmployerCost,
      status: "paid",
      paidAt: daysAgo(1),
      createdBy: hrUser._id,
    });

    totalGross += calc.grossSalary;
    totalNet += calc.netSalary;
    totalEmployerCost += calc.employer.totalEmployerCost;
  }

  payrollRun.employeeCount = allEmployees.length;
  payrollRun.totalGross = Math.round(totalGross * 100) / 100;
  payrollRun.totalNet = Math.round(totalNet * 100) / 100;
  payrollRun.totalEmployerCost = Math.round(totalEmployerCost * 100) / 100;
  await payrollRun.save();

  console.log(`✓ Payroll run completed for ${lastMonth}/${lastMonthYear} with ${allEmployees.length} payslips`);

  // ==========================================================
  // INVENTORY (categories + products + a purchase request in each status)
  // ==========================================================

  const rawMaterialCategory = await InventoryCategory.create({
    company: company._id,
    name: "Matière première",
    icon: "Package",
    color: "#3b82f6",
    createdBy: hrUser._id,
    updatedBy: hrUser._id,
  });

  const finishedGoodsCategory = await InventoryCategory.create({
    company: company._id,
    name: "Produits finis",
    icon: "Boxes",
    color: "#22c55e",
    createdBy: hrUser._id,
    updatedBy: hrUser._id,
  });

  const steelSheet = await Product.create({
    company: company._id,
    category: rawMaterialCategory._id,
    name: "Tôle acier 2mm",
    internalReference: "RM-STEEL-2MM",
    quantity: 40, // below its own threshold, on purpose -> exercises the low-stock flag
    unit: "kg",
    threshold: 100,
    prices: [{ supplierName: "AcierPlus", price: 12.5, supplierReference: "AP-2MM" }],
    sellingPrice: null,
    createdBy: hrUser._id,
    updatedBy: hrUser._id,
  });

  const finishedPart = await Product.create({
    company: company._id,
    category: finishedGoodsCategory._id,
    name: "Support métallique XL",
    internalReference: "FG-SUPPORT-XL",
    quantity: 320,
    unit: "unit",
    threshold: 50,
    prices: [],
    sellingPrice: 145,
    createdBy: hrUser._id,
    updatedBy: hrUser._id,
  });

  console.log("✓ 2 inventory categories and 2 products created (one already below its low-stock threshold)");

  await PurchaseRequest.create([
    {
      company: company._id,
      product: steelSheet._id,
      requestedQuantity: 200,
      status: "pending",
      notes: "Stock is below threshold — needed for the next production run.",
      requestedBy: managerUser._id,
    },
    {
      company: company._id,
      product: finishedPart._id,
      requestedQuantity: 50,
      status: "approved",
      notes: "Restocking for an upcoming large order.",
      requestedBy: managerUser._id,
      reviewedBy: owner._id,
      reviewedAt: daysAgo(2),
    },
  ]);

  console.log("✓ Purchase requests created (pending + approved)");

  // ==========================================================
  // PERFORMANCE REVIEWS (one per workflow state)
  // ==========================================================

  await PerformanceReview.create([
    {
      company: company._id,
      employee: reportEmployee._id,
      reviewer: managerEmployee._id,
      periodLabel: "H1 2026",
      reviewDate: daysAgo(10),
      ratings: { jobKnowledge: 4, qualityOfWork: 4, communication: 3, teamwork: 5, initiative: 3, punctuality: 4 },
      goals: [
        { description: "Reduce line changeover time by 10%", status: "in_progress" },
        { description: "Complete the forklift safety certification", status: "completed" },
      ],
      strengths: "Reliable, strong team player, picks up new procedures quickly.",
      areasForImprovement: "Could take more initiative flagging quality issues early.",
      status: "submitted",
      createdBy: hrUser._id,
      updatedBy: hrUser._id,
    },
    {
      company: company._id,
      employee: extraEmployees[3]._id, // Omar Tahiri
      reviewer: managerEmployee._id,
      periodLabel: "Probation review — 60 days",
      reviewDate: daysAgo(1),
      ratings: { jobKnowledge: 3, qualityOfWork: 3, communication: 3, teamwork: 3, initiative: 2, punctuality: 3 },
      goals: [{ description: "Reach full independent competency on the packaging line", status: "in_progress" }],
      strengths: "Punctual, willing to learn.",
      areasForImprovement: "Still needs supervision on quality checks.",
      status: "draft", // deliberately left as a draft, to test the "Submit to employee" action
      createdBy: managerUser._id,
      updatedBy: managerUser._id,
    },
  ]);

  console.log("✓ Performance reviews created (one submitted, one still a draft)");

  // ==========================================================
  // DISCIPLINARY ACTIONS
  // ==========================================================

  await DisciplinaryAction.create({
    company: company._id,
    employee: extraEmployees[3]._id, // Omar Tahiri
    type: "verbal_warning",
    date: daysAgo(5),
    reason: "Repeated lateness",
    description: "Clocked in more than 15 minutes late on 3 occasions this month without prior notice.",
    issuedBy: managerEmployee._id,
    acknowledgedByEmployee: false, // deliberately unacknowledged, to test that flow
    createdBy: hrUser._id,
    updatedBy: hrUser._id,
  });

  console.log("✓ Disciplinary action created (unacknowledged, to test the employee acknowledgment flow)");

  // ==========================================================
  // PUBLIC HOLIDAYS — this year's fixed-date ones (closed, paid
  // double if worked). Religious holidays are left for HR to add via
  // HR > Public holidays > Import, exactly like in real use.
  // ==========================================================
  const holidayYear = new Date().getFullYear();
  await PublicHoliday.insertMany(MOROCCO_FIXED_HOLIDAYS.map((h) => ({
    company: company._id,
    day: `${holidayYear}-${String(h.month).padStart(2, "0")}-${String(h.day).padStart(2, "0")}`,
    year: holidayYear,
    name: h.name,
    isWorkingDay: false,
    payRate: 2,
    createdBy: hrUser._id,
  })));
  console.log(`✓ ${MOROCCO_FIXED_HOLIDAYS.length} fixed-date public holidays for ${holidayYear}`);

  // ==========================================================
  // NOTIFICATIONS
  // ==========================================================

  await Notification.create([
    {
      user: hrUser._id,
      type: "absence_pending",
      title: "New absence request",
      message: "Imane Employee requested sick leave.",
      link: "/hr/absences",
      read: false,
    },
    {
      user: hrUser._id,
      type: "advance_pending",
      title: "New advance request",
      message: "Nabil Manager requested an advance of 2000 MAD.",
      link: "/hr/advances",
      read: false,
    },
    {
      user: employeeUser._id,
      type: "payslip_available",
      title: "New payslip available",
      message: `Your payslip for ${lastMonth}/${lastMonthYear} is ready.`,
      link: "/me/payslips",
      read: false,
    },
  ]);

  console.log("✓ Sample notifications created");

  // ==========================================================
  // DONE
  // ==========================================================

  console.log("\n============================================================");
  console.log("SEED COMPLETE — test accounts (all passwords shown are real):");
  console.log("============================================================");
  console.log("  Admin          admin@frame.test        / Admin@123");
  console.log("  Owner          owner@frame.test        / Owner@123");
  console.log("  HR (full)      hr@frame.test           / Hr@12345       (no hrRole set -> full HR access)");
  console.log("  HR manager     hr-manager@frame.test   / HrManager@123  (Directeur RH — HR department manager)");
  console.log("  HR (assistant) hr-assistant@frame.test / HrAssist@123   (hr_assistant tier -> view-only, most actions blocked)");
  console.log("  Manager        manager@frame.test      / Manager@123    (Production department manager — see My Space > My department)");
  console.log("  Employee       employee@frame.test     / Employee@123   (Opérateur de Production — My Space only)");
  console.log("============================================================");
  console.log("Also seeded: 6 employees, departments + job positions, salaries,");
  console.log("contracts, absences, advances, documents, attendance, a completed");
  console.log("payroll run, inventory (2 categories, 2 products, one below its");
  console.log("low-stock threshold), 2 purchase requests, 2 performance reviews");
  console.log("(one draft, one submitted), 1 unacknowledged disciplinary action,");
  console.log("and a few notifications.");
  console.log("============================================================");
  console.log("To remove all of this later: npm run unseed");
  console.log("============================================================\n");

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
