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

// First: the client-isolation plugin must be registered before models load.
const { runInTenant } = require("../services/tenantScope");
const mongoose = require("mongoose");
require("dotenv").config();
const { syncEmployeeIndexes } = require("../utils/syncEmployeeIndexes");

const Tenant = require("../models/Tenant");
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
const Supplier = require("../models/Supplier");
const PurchaseOrder = require("../models/PurchaseOrder");
const PriceRequest = require("../models/PriceRequest");
const Customer = require("../models/Customer");
const Quote = require("../models/Quote");
const SalesInvoice = require("../models/SalesInvoice");
const Project = require("../models/Project");
const ProjectTask = require("../models/ProjectTask");
const Workshop = require("../models/Workshop");
const Finish = require("../models/Finish");
const ProductionSettings = require("../models/ProductionSettings");
const ProfileSeries = require("../models/ProfileSeries");
const ChassisModel = require("../models/ChassisModel");
const ProductionOrder = require("../models/ProductionOrder");
const TrackingUnit = require("../models/TrackingUnit");
const DeliveryNote = require("../models/DeliveryNote");
const TimeEntry = require("../models/TimeEntry");
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
    Tenant.deleteMany({}),
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
    Supplier.deleteMany({}),
    PurchaseOrder.deleteMany({}),
    PriceRequest.deleteMany({}),
    Customer.deleteMany({}),
    Quote.deleteMany({}),
    SalesInvoice.deleteMany({}),
    Project.deleteMany({}),
    ProjectTask.deleteMany({}),
    TimeEntry.deleteMany({}),
    Workshop.deleteMany({}),
    Finish.deleteMany({}),
    ProductionSettings.deleteMany({}),
    ProfileSeries.deleteMany({}),
    ChassisModel.deleteMany({}),
    ProductionOrder.deleteMany({}),
    TrackingUnit.deleteMany({}),
    DeliveryNote.deleteMany({}),
  ]);

  // Rebuild the CIN/CNSS uniqueness indexes if this database still has
  // the old (broken) sparse versions — see utils/syncEmployeeIndexes.js.
  await syncEmployeeIndexes();
  // Sub-categories: category names are unique per parent now (drops the old { company, name } index).
  await InventoryCategory.syncIndexes().catch((e) => console.warn("  (category indexes not synced:", e.message, ")"));

  // ==========================================================
  // CLIENTS (tenants)
  // ==========================================================
  // The main demo client gets everything below. Everything is created
  // INSIDE that client's context, so users/companies/records are
  // attached to it automatically (services/tenantScope.js). A second,
  // tiny client proves isolation: log in as admin-b@frame.test and
  // none of Atlas Industries' data is visible.
  const tenant = await Tenant.create({ name: "Atlas Group (démo)" });
  await runInTenant({ tenantId: tenant._id, companyIds: [] }, () => seedMainClient());

  const tenantB = await Tenant.create({ name: "Beta Trading (démo client B)" });
  await runInTenant({ tenantId: tenantB._id, companyIds: [] }, () => seedSecondClient());

  console.log("  Logistics      logistique@frame.test   / Logistique@123 (Responsable logistique — hands out permissions to his team)");
  console.log("  Driver         chauffeur@frame.test    / Chauffeur@123  (Said — only delivery notes: view / ship / deliver; can pass some on to Omar)");
  console.log("  Driver helper  aide-livreur@frame.test / AideLivreur@123 (Omar — sees delivery notes only)");
  console.log("  HR assistant   assistant-rh@frame.test / AssistantRh@123 (Nadia — reports to the Directeur RH, who sets her permissions)");
  console.log("  Sales          ventes@frame.test       / Ventes@123     (Ventes: clients, devis, factures, encaissements; sees projects)");
  console.log("  Client B admin admin-b@frame.test      / AdminB@123     (another client — must see NONE of the above)");
  console.log("============================================================\n");

  await mongoose.disconnect();
  process.exit(0);
}

/** Second demo client: one admin, one company, one supplier. */
async function seedSecondClient() {
  const adminB = await User.create({
    firstName: "Badr",
    lastName: "Beta",
    email: "admin-b@frame.test",
    password: "AdminB@123",
    role: "admin",
    department: "management",
  });
  const companyB = await Company.create({
    name: "Beta Trading",
    legalForm: "SARL",
    industry: "Trading",
    size: "small",
    currency: "MAD",
    owner: adminB._id,
    email: "contact@beta-trading.test",
    address: { city: "Rabat", region: "Rabat-Salé-Kénitra" },
    employeeCount: 0,
  });
  await Supplier.create({ company: companyB._id, name: "Fournisseur Beta (client B)", paymentDays: 30 });
  console.log("✓ Second client created: Beta Trading");
}

async function seedMainClient() {
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

  // Purchasing (service achats) login — sees Achats: requests,
  // orders, suppliers, price requests, and the inventory read-only.
  await User.create({
    firstName: "Rachid",
    lastName: "Acheteur",
    email: "achats@frame.test",
    password: "Achats@123",
    role: "user",
    department: "purchasing",
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
    { name: "Ventes", permissionKey: "sales" },
    { name: "Logistique", permissionKey: "logistics", description: "Livraisons, transport, suivi chantier" },
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
  // HR hierarchy: an assistant reporting to the Directeur RH, who adjusts
  // her permissions (Droits de mon équipe) on top of the "Assistant(e) RH" profile.
  const nadia = await Employee.create({
    company: company._id, employeeNumber: "EMP-030", firstName: "Nadia", lastName: "Chraibi", gender: "female", maritalStatus: "single",
    numberOfDependents: 0, nationality: "Moroccan", employmentStatus: "active", employmentType: "permanent", workLocation: "Casablanca Plant",
    jobTitle: "Assistante RH", department: hrDept._id, manager: byNumber["EMP-007"]._id, hireDate: daysAgo(200), createdBy: hrUser._id, updatedBy: hrUser._id,
  });
  await User.create({ firstName: "Nadia", lastName: "Chraibi", email: "assistant-rh@frame.test", password: "AssistantRh@123", role: "user", department: "hr", hrRole: "hr_assistant", employee: nadia._id });

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
  // DECLARATIONS DEMO (HR → Declarations)
  // ==========================================================
  // Real-looking identifiers so the Damancom file, bank transfer and
  // Simpl-IR screens can be tried end to end: company IF / CNSS /
  // RIB, 9-digit CNSS numbers and valid RIBs for every employee (one
  // paid in cash), and a demo PRÉÉTABLI file for last month's payroll
  // written next to this script. It leaves out the newest employee
  // (declared as a new entrant) and includes a former employee with no
  // payslip (HR picks the situation "SO — left").
  const { ribWithKey } = require("../services/bankTransferService");
  const { makePreetabli } = require("../test/preetabliFixture");
  const fs = require("fs");
  const path = require("path");
  company.taxId = "40123456";
  company.cnssNumber = "7654321";
  company.professionalTaxNumber = "34567890";
  company.bank = { ...(company.bank || {}), bankName: "Attijariwafa bank", rib: ribWithKey("0077800001112223334445") };
  await company.save();

  const sortedEmployees = [...allEmployees].sort((a, b) => a.employeeNumber.localeCompare(b.employeeNumber));
  for (const [i, emp] of sortedEmployees.entries()) {
    emp.cnssNumber = String(120000100 + i);
    if (!emp.cin) emp.cin = `BK${String(700000 + i)}`;
    emp.bank = { ...(emp.bank || {}), rib: ribWithKey(`0117800000${String(1000000000 + i * 7919)}00`.slice(0, 22)) };
    emp.paymentMethod = emp.employeeNumber === "EMP-008" ? "cash" : "bank_transfer";
    await emp.save();
  }
  await Payslip.updateMany({ payrollRun: payrollRun._id }, { $set: { declaredDays: 26, unpaidDays: 0 } });

  const newest = [...sortedEmployees].sort((a, b) => new Date(b.hireDate) - new Date(a.hireDate))[0];
  const period = `${lastMonthYear}${String(lastMonth).padStart(2, "0")}`;
  const preetabliText = makePreetabli({
    affiliate: company.cnssNumber,
    period,
    employees: [
      ...sortedEmployees.filter((e) => e !== newest).map((e) => ({
        cnss: e.cnssNumber,
        name: `${e.lastName} ${e.firstName}`,
        children: e.familyStatus?.numberOfChildren || 0,
      })),
      { cnss: "120000999", name: "EL IDRISSI RACHID" }, // left the company: no payslip
    ],
  });
  const preetabliPath = path.join(__dirname, `demo-preetabli-${period}.txt`);
  fs.writeFileSync(preetabliPath, preetabliText, "latin1");
  console.log(`✓ Declarations demo: company IF/CNSS/RIB, employee CNSS numbers and RIBs, demo préétabli → ${preetabliPath}`);

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

  await Supplier.create([
    { company: company._id, name: "AcierPlus", contactName: "M. Tazi", phone: "0522 00 11 22", city: "Casablanca", paymentTerms: "30 jours fin de mois", createdBy: hrUser._id },
    { company: company._id, name: "Emballages du Nord", contactName: "Mme Idrissi", phone: "0539 00 33 44", city: "Tanger", paymentTerms: "Comptant", createdBy: hrUser._id },
  ]);
  console.log("✓ 2 suppliers created");

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
  // SALES (Ventes) + PROJECTS (Production)
  // ==========================================================
  // A sales login, 3 customers, devis in every state, one accepted
  // devis turned into a project with tasks, hours, material taken
  // from stock and an expense, a 30% deposit invoice issued and paid,
  // the final invoice still a draft, and an older unpaid invoice now
  // overdue — so Ventes → Encaissements shows something to chase.
  const { createWithNumber } = require("../services/documentNumberService");
  const { depositLines, sumDeposits } = require("../services/salesCalc");
  const { hourlyCostFor } = require("../services/projectCosts");
  const { applyMovement } = require("../services/inventoryService");

  const salesUser = await User.create({
    firstName: "Hind",
    lastName: "Commerciale",
    email: "ventes@frame.test",
    password: "Ventes@123",
    role: "user",
    department: "sales",
  });

  const [hotel, clinic, particulier] = await Customer.create([
    { company: company._id, name: "Hôtel Atlas Marrakech", kind: "company", ice: "001526374000012", identifiantFiscal: "45123789", rc: "RC 98765",
      email: "achats@hotel-atlas.test", phone: "+212524000000", address: "Avenue Mohammed VI", city: "Marrakech", paymentDays: 60,
      contacts: [{ name: "M. Berrada", role: "Directeur technique", phone: "+212661000000", email: "berrada@hotel-atlas.test" }], createdBy: salesUser._id },
    { company: company._id, name: "Clinique Al Amal", kind: "company", ice: "002837465000023", city: "Casablanca", paymentDays: 30,
      email: "compta@alamal.test", createdBy: salesUser._id },
    { company: company._id, name: "M. Youssef Tazi", kind: "individual", city: "Rabat", paymentDays: 0, phone: "+212600000001", createdBy: salesUser._id },
  ]);

  const dayOffset = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d; };
  const accepted = await createWithNumber(Quote, {
    company: company._id, customer: hotel._id, date: daysAgo(40), validUntil: daysAgo(10), subject: "Garde-corps et escaliers métalliques — aile B",
    lines: [
      { product: finishedPart._id, description: "Support métallique XL", quantity: 40, unit: "unit", unitPrice: 145, vatRate: 20 },
      { description: "Garde-corps acier galvanisé (ml)", quantity: 60, unit: "ml", unitPrice: 850, discount: 5, vatRate: 20 },
      { description: "Pose et fixation sur site", quantity: 1, unit: "forfait", unitPrice: 18000, vatRate: 20 },
    ],
    paymentTerms: "30% à la commande, solde à la réception des travaux",
    status: "accepted", sentAt: daysAgo(39), decidedAt: daysAgo(30), createdBy: salesUser._id, updatedBy: salesUser._id,
  }, "DV");
  await createWithNumber(Quote, {
    company: company._id, customer: clinic._id, date: daysAgo(5), validUntil: dayOffset(25), subject: "Portail coulissant et clôture",
    lines: [
      { description: "Portail coulissant motorisé 5 m", quantity: 1, unit: "unité", unitPrice: 24000, vatRate: 20 },
      { description: "Clôture barreaudage (ml)", quantity: 35, unit: "ml", unitPrice: 620, vatRate: 20 },
    ],
    status: "sent", sentAt: daysAgo(5), createdBy: salesUser._id, updatedBy: salesUser._id,
  }, "DV");
  await createWithNumber(Quote, {
    company: company._id, customer: particulier._id, date: new Date(), subject: "Pergola métallique",
    lines: [{ description: "Pergola 4 × 3 m, peinture époxy", quantity: 1, unit: "unité", unitPrice: 15500, vatRate: 20 }],
    status: "draft", createdBy: salesUser._id, updatedBy: salesUser._id,
  }, "DV");

  const project = await createWithNumber(Project, {
    company: company._id, name: "Hôtel Atlas — garde-corps aile B", customer: hotel._id, quote: accepted._id,
    status: "in_progress", startDate: daysAgo(25), dueDate: dayOffset(20), manager: managerEmployee._id,
    team: [managerEmployee._id, reportEmployee._id], location: "Marrakech — Hôtel Atlas, aile B",
    budget: { revenue: accepted.totalHT, materials: 22000, labour: 9000, purchases: 8000, other: 1500 },
    expenses: [{ date: daysAgo(12), label: "Transport matériel Casablanca → Marrakech", amount: 1800 }],
    createdBy: managerUser._id, updatedBy: managerUser._id,
  }, "PRJ");
  accepted.project = project._id;
  await accepted.save();

  const tasks = await ProjectTask.create([
    { company: company._id, project: project._id, title: "Relevé de cotes sur site", assignees: [managerEmployee._id], startDate: daysAgo(25), dueDate: daysAgo(23), estimatedHours: 8, status: "done", order: 0, completedAt: daysAgo(23) },
    { company: company._id, project: project._id, title: "Fabrication des garde-corps", assignees: [reportEmployee._id], startDate: daysAgo(20), dueDate: dayOffset(2), estimatedHours: 60, status: "in_progress", order: 1 },
    { company: company._id, project: project._id, title: "Galvanisation (sous-traitance)", startDate: dayOffset(3), dueDate: dayOffset(8), estimatedHours: 0, status: "todo", order: 2 },
    { company: company._id, project: project._id, title: "Pose sur site", assignees: [managerEmployee._id, reportEmployee._id], startDate: dayOffset(10), dueDate: dayOffset(18), estimatedHours: 40, status: "todo", order: 3 },
  ]);
  for (const [employee, task, days, hours] of [
    [managerEmployee._id, tasks[0]._id, 24, 8],
    [reportEmployee._id, tasks[1]._id, 15, 8],
    [reportEmployee._id, tasks[1]._id, 14, 8],
    [reportEmployee._id, tasks[1]._id, 13, 6],
  ]) {
    const hourlyCost = await hourlyCostFor(employee, company._id);
    await TimeEntry.create({ company: company._id, project: project._id, task, employee, date: daysAgo(days), hours, hourlyCost, cost: Math.round(hours * hourlyCost * 100) / 100, createdBy: managerUser._id });
  }
  await applyMovement({ product: steelSheet, type: "out", quantity: 25, reason: `Sortie pour projet ${project.number}`, actorId: managerUser._id, project: project._id, unitCost: 12.5 });

  const deposit = await SalesInvoice.create({
    company: company._id, type: "deposit", customer: hotel._id, quote: accepted._id, project: project._id,
    date: daysAgo(28), dueDate: daysAgo(-2), lines: depositLines(accepted, 30), number: `AC-${daysAgo(28).getFullYear()}-0001`,
    status: "issued", issuedAt: daysAgo(28), createdBy: salesUser._id, updatedBy: salesUser._id,
  });
  deposit.payments.push({ date: daysAgo(20), amount: deposit.totalTTC, method: "virement", reference: "VIR-HOTEL-0921", by: salesUser._id });
  await deposit.save();
  await SalesInvoice.create({
    company: company._id, type: "invoice", customer: hotel._id, quote: accepted._id, project: project._id, date: new Date(),
    lines: accepted.lines.map((l) => { const { _id, ...rest } = l.toObject(); return rest; }),
    depositBreakdown: sumDeposits([deposit]), depositInvoices: [deposit._id], paymentTerms: accepted.paymentTerms,
    createdBy: salesUser._id, updatedBy: salesUser._id,
  });
  const older = await SalesInvoice.create({
    company: company._id, type: "invoice", customer: clinic._id, date: daysAgo(75), dueDate: daysAgo(45), subject: "Réparation rampe d'accès",
    lines: [{ description: "Réparation et renforcement rampe d'accès", quantity: 1, unit: "forfait", unitPrice: 6500, vatRate: 20 }],
    number: `FA-${daysAgo(75).getFullYear()}-0001`, status: "issued", issuedAt: daysAgo(75), createdBy: salesUser._id, updatedBy: salesUser._id,
  });
  older.payments.push({ date: daysAgo(40), amount: 3000, method: "cheque", reference: "CHQ 445566", by: salesUser._id });
  await older.save();

  console.log(`✓ Sales & projects: 3 customers, 3 devis, project ${project.number} (tasks, hours, material, expense), deposit paid, final invoice draft, 1 overdue invoice`);

  // ==========================================================
  // ALUMINIUM JOINERY (menuiserie aluminium): workshops, colours,
  // articles with technical data, series, chassis models imported from
  // the catalogue, a devis with chassis lines → project → work orders.
  // ==========================================================
  {
    const { findTemplate } = require("../config/chassisCatalog");
    const { mergeTemplateVariables, modelFromTemplate } = require("../services/chassisCatalogService");
    const { ensureProductionDefaults, createOrdersForProject, completeOrder, consume } = require("../services/productionPlanning");
    const bom = require("../services/chassisBom");

    await ensureProductionDefaults(company._id);
    const [laq, alu, vit] = await Promise.all(["LAQ", "ALU", "VIT"].map((code) => Workshop.findOne({ company: company._id, code })));
    laq.manager = managerEmployee._id; laq.hourlyRate = 55; await laq.save();
    alu.manager = managerEmployee._id; alu.members = [managerEmployee._id]; alu.hourlyRate = 60; await alu.save();
    // Imane (employee@frame.test, no department) runs the glazing workshop:
    // she only sees the Vitrage work orders.
    vit.manager = reportEmployee._id; vit.members = [reportEmployee._id]; vit.hourlyRate = 50; await vit.save();

    const aluCat = await InventoryCategory.create({ company: company._id, name: "Profilés aluminium", icon: "Ruler", color: "#8aa4c8", accountingAccount: "6121", createdBy: admin._id });
    const accCat = await InventoryCategory.create({ company: company._id, name: "Accessoires & joints", icon: "Wrench", color: "#c8a48a", accountingAccount: "6122", createdBy: admin._id });
    const glassCat = await InventoryCategory.create({ company: company._id, name: "Verre & panneaux", icon: "Square", color: "#7cc8d4", accountingAccount: "6121", createdBy: admin._id });
    const powderCat = await InventoryCategory.create({ company: company._id, name: "Poudres de laquage", icon: "Paintbrush", color: "#e8793f", accountingAccount: "6122", createdBy: admin._id });
    // Sub-categories: one per profile series, accessories by family… (they inherit the account)
    const sub = (parent, name, icon) => InventoryCategory.create({ company: company._id, parent: parent._id, name, icon: icon || parent.icon, color: parent.color, createdBy: admin._id });
    const c67Cat = await sub(aluCat, "Série 67 — coulissants");
    const o50Cat = await sub(aluCat, "Série 50 — fenêtres & portes");
    const msCat = await sub(aluCat, "Moustiquaires");
    await sub(aluCat, "Série garde-corps");
    const jointCat = await sub(accCat, "Joints", "Paperclip");
    const accSlideCat = await sub(accCat, "Quincaillerie coulissants", "Wrench");
    const accOpenCat = await sub(accCat, "Quincaillerie fenêtres & portes", "Wrench");
    const fixCat = await sub(accCat, "Visserie, fixations & consommables", "Bolt");
    const verreCat = await sub(glassCat, "Verres", "Square");
    const dvCat = await sub(glassCat, "Composants double vitrage", "Square");
    const panelCat = await sub(glassCat, "Tôles, panneaux & toiles", "Square");
    const art = {};
    const mk = async (key, category, name, ref, quantity, price, tech) => {
      art[key] = await Product.create({ company: company._id, category: category._id, name, internalReference: ref, quantity, unit: tech.unit || "u", threshold: tech.threshold || 0,
        prices: [{ supplierName: tech.supplier || "Profilés du Maroc", price }], createdBy: admin._id, ...tech, supplier: undefined, unit: tech.unit || "u" });
    };
    const bar = (perimeter, weight) => ({ materialType: "profile", stockMode: "bar", barLength: 6500, perimeter, weightPerMeter: weight, unit: "barre", threshold: 10 });
    // Profiles (raw) — series Coulissant 67
    await mk("railHaut", c67Cat, "Dormant haut coulissant 67", "C67-DH", 60, 238, bar(260, 0.95));
    await mk("railBas", c67Cat, "Dormant bas coulissant 67", "C67-DB", 60, 245, bar(270, 1.0));
    await mk("montantDormant", c67Cat, "Montant dormant coulissant 67", "C67-MD", 60, 210, bar(230, 0.82));
    await mk("montantLateral", c67Cat, "Montant latéral vantail 67", "C67-ML", 80, 198, bar(220, 0.78));
    await mk("chicane", c67Cat, "Montant de chicane 67", "C67-MC", 80, 205, bar(230, 0.8));
    await mk("traverse", c67Cat, "Traverse vantail 67", "C67-TV", 80, 176, bar(200, 0.7));
    await mk("profilMs", msCat, "Profil cadre moustiquaire", "MS-CAD", 30, 62, bar(90, 0.25));
    // Profiles (raw) — series Ouvrant 50
    await mk("dormant50", o50Cat, "Dormant ouvrant 50", "O50-DO", 60, 228, bar(250, 0.9));
    await mk("ouvrant50", o50Cat, "Ouvrant 50", "O50-OU", 60, 236, bar(260, 0.92));
    await mk("parclose50", o50Cat, "Parclose 50", "O50-PC", 80, 64, bar(80, 0.22));
    await mk("battement50", o50Cat, "Profil de battement 50", "O50-BA", 30, 142, bar(160, 0.5));
    await mk("seuil", o50Cat, "Seuil aluminium", "SEUIL", 20, 188, bar(180, 0.7));
    await mk("traverseInter", o50Cat, "Traverse intermédiaire porte", "P60-TI", 20, 182, bar(200, 0.66));
    await mk("intercalaire", dvCat, "Intercalaire alu 16 mm", "INT-16", 50, 32, { materialType: "profile", stockMode: "bar", barLength: 6000, unit: "barre", supplier: "Verrerie Atlas" });
    // Gaskets (per metre)
    const m = (extra = {}) => ({ materialType: "gasket", stockMode: "meter", unit: "m", ...extra });
    await mk("jointVitrage", jointCat, "Joint EPDM de vitrage", "J-EPDM", 1500, 3.2, m());
    await mk("jointBrosse", jointCat, "Joint brosse 7 mm", "J-BR7", 1200, 2.4, m());
    await mk("jointFrappe", jointCat, "Joint de frappe", "J-FR", 800, 3.8, m());
    await mk("butyl", dvCat, "Butyl", "BUTYL", 2000, 0.9, m({ supplier: "Verrerie Atlas" }));
    // Accessories (units)
    const u = (extra = {}) => ({ materialType: "accessory", stockMode: "unit", unit: "u", threshold: 20, ...extra });
    await mk("roulette", accSlideCat, "Roulette coulissant (paire)", "ACC-ROU", 300, 28, u());
    await mk("fermeture", accSlideCat, "Fermeture à crochet coulissant", "ACC-FER", 120, 45, u());
    await mk("poignee", accSlideCat, "Poignée cuvette", "ACC-POI", 150, 18, u());
    await mk("equerre", fixCat, "Équerre d'assemblage", "ACC-EQ", 1500, 4.5, u());
    await mk("embout", accSlideCat, "Kit étanchéité de chicane", "ACC-EMB", 400, 6, u());
    await mk("butee", accSlideCat, "Butée amortisseur", "ACC-BUT", 300, 3, u());
    await mk("busette", fixCat, "Busette d'évacuation", "ACC-BUS", 500, 1.2, u());
    await mk("cale", fixCat, "Cale de vitrage", "ACC-CAL", 3000, 0.4, u());
    await mk("visserie", fixCat, "Vis inox (boîte de 100)", "VIS-100", 60, 38, u({ packSize: 100, unit: "boîte" }));
    await mk("kitMs", msCat, "Kit roulettes moustiquaire", "MS-KIT", 60, 22, u());
    await mk("paumelle", accOpenCat, "Paumelle", "ACC-PAU", 400, 16, u());
    await mk("cremone", accOpenCat, "Crémone + poignée", "ACC-CRE", 100, 85, u());
    await mk("gache", accOpenCat, "Gâche", "ACC-GAC", 400, 5, u());
    await mk("verrou", accOpenCat, "Verrou semi-fixe", "ACC-VER", 150, 24, u());
    await mk("serrure", accOpenCat, "Serrure de porte", "ACC-SER", 40, 160, u());
    await mk("cylindre", accOpenCat, "Cylindre européen", "ACC-CYL", 40, 95, u());
    await mk("bequille", accOpenCat, "Jeu de béquilles", "ACC-BEQ", 40, 120, u());
    await mk("fermePorte", accOpenCat, "Ferme-porte", "ACC-FP", 20, 380, u());
    await mk("plinthe", accOpenCat, "Plinthe / balai bas de porte", "ACC-PLI", 30, 55, u());
    await mk("angleInt", dvCat, "Angle d'intercalaire", "INT-ANG", 2000, 0.6, u({ supplier: "Verrerie Atlas" }));
    // Consumables
    await mk("silicone", fixCat, "Silicone neutre (cartouche)", "SIL-310", 200, 32, { materialType: "consumable", stockMode: "unit", unit: "cartouche" });
    await mk("dessicant", dvCat, "Tamis moléculaire (dessicant)", "DESS", 80, 28, { materialType: "consumable", stockMode: "kg", unit: "kg", supplier: "Verrerie Atlas" });
    await mk("mastic", dvCat, "Mastic polysulfure", "MAST-PS", 120, 45, { materialType: "consumable", stockMode: "kg", unit: "kg", supplier: "Verrerie Atlas" });
    // Glass & panels
    await mk("float4", verreCat, "Verre float clair 4 mm", "VF-4", 180, 78, { materialType: "glass", stockMode: "m2", unit: "m²", thickness: 4, supplier: "Verrerie Atlas" });
    await mk("float6", verreCat, "Verre float clair 6 mm", "VF-6", 90, 118, { materialType: "glass", stockMode: "m2", unit: "m²", thickness: 6, supplier: "Verrerie Atlas" });
    await mk("feuillete", verreCat, "Verre feuilleté 44.2", "VFE-442", 60, 265, { materialType: "glass", stockMode: "m2", unit: "m²", thickness: 8.8, supplier: "Verrerie Atlas" });
    await mk("toile", panelCat, "Toile moustiquaire", "MS-TOI", 80, 24, { materialType: "panel", stockMode: "m2", unit: "m²" });
    await mk("tole", panelCat, "Tôle aluminium 15/10", "TOLE-15", 20, 420, { materialType: "panel", stockMode: "sheet", sheetWidth: 1250, sheetHeight: 2500, perimeter: 0, paintSurface: 3.125, unit: "plaque" });
    await mk("mdf", panelCat, "MDF hydrofuge 19 mm", "MDF-19", 15, 310, { materialType: "panel", stockMode: "sheet", sheetWidth: 1220, sheetHeight: 2440, unit: "plaque", supplier: "Bois & Panneaux" });
    // Powders
    const pw = (price) => ({ materialType: "powder", stockMode: "kg", unit: "kg", coverage: 0.12, threshold: 15, supplier: "Akzo Maroc" });
    await mk("ral9016", powderCat, "Poudre polyester RAL 9016 blanc", "PDR-9016", 120, 58, pw());
    await mk("ral7016", powderCat, "Poudre polyester RAL 7016 anthracite", "PDR-7016", 60, 66, pw());
    await mk("ral9005", powderCat, "Poudre polyester RAL 9005 noir", "PDR-9005", 40, 66, pw());

    const white = await Finish.create({ company: company._id, code: "RAL 9016", name: "Blanc", kind: "lacquer", processWorkshop: laq._id, powderProduct: art.ral9016._id, color: "#f4f6f3", isDefault: true });
    await Finish.create({ company: company._id, code: "RAL 7016", name: "Gris anthracite", kind: "lacquer", processWorkshop: laq._id, powderProduct: art.ral7016._id, color: "#383e42", surchargePercent: 6 });
    await Finish.create({ company: company._id, code: "RAL 9005", name: "Noir", kind: "lacquer", processWorkshop: laq._id, powderProduct: art.ral9005._id, color: "#0a0a0a", surchargePercent: 6 });
    await Finish.create({ company: company._id, code: "ANO ARGENT", name: "Anodisé argent", kind: "anodized", color: "#c0c4c8", surchargePercent: 12 });

    const s67 = await ProfileSeries.create({ company: company._id, name: "Coulissant 67", supplier: "Profilés du Maroc", families: ["coulissant"], variables: [] });
    const s50 = await ProfileSeries.create({ company: company._id, name: "Ouvrant 50", supplier: "Profilés du Maroc", families: ["ouvrant", "fixe", "porte"], variables: [] });
    const common = {
      joint_vitrage: art.jointVitrage._id, joint_vitrage_ext: art.jointVitrage._id, joint_vitrage_int: art.jointVitrage._id, joint_brosse: art.jointBrosse._id,
      joint_frappe: art.jointFrappe._id, joint_central: art.jointFrappe._id, cales: art.cale._id, visserie: art.visserie._id, silicone: art.silicone._id,
      equerres_dormant: art.equerre._id, equerres_ouvrant: art.equerre._id, equerres: art.equerre._id, busettes: art.busette._id,
    };
    const slidingArticles = {
      ...common, rail_haut: art.railHaut._id, rail_bas: art.railBas._id, dormant_v: art.montantDormant._id, montant_lateral: art.montantLateral._id,
      montant_chicane: art.chicane._id, traverse_haute: art.traverse._id, traverse_basse: art.traverse._id, roulettes: art.roulette._id,
      fermeture: art.fermeture._id, poignee: art.poignee._id, embouts: art.embout._id, butees: art.butee._id,
      ms_profil: art.profilMs._id, ms_toile: art.toile._id, ms_kit: art.kitMs._id,
    };
    const casementArticles = {
      ...common, dormant_haut: art.dormant50._id, dormant_bas: art.dormant50._id, dormant_v: art.dormant50._id, dormant_h: art.dormant50._id,
      ouvrant_h: art.ouvrant50._id, ouvrant_v: art.ouvrant50._id, battement: art.battement50._id, parclose_h: art.parclose50._id, parclose_v: art.parclose50._id,
      paumelles: art.paumelle._id, cremone: art.cremone._id, gaches: art.gache._id, verrous: art.verrou._id, ferrure_ob: art.cremone._id, poignee_ob: art.poignee._id,
      seuil: art.seuil._id, traverse_inter: art.traverseInter._id, serrure: art.serrure._id, cylindre: art.cylindre._id, bequille: art.bequille._id,
      ferme_porte: art.fermePorte._id, plinthe_auto: art.plinthe._id,
    };
    const importModel = async (key, series, articles, extra = {}) => {
      const t = findTemplate(key);
      if (series) { mergeTemplateVariables(series, t); await series.save(); }
      return ChassisModel.create({ ...modelFromTemplate(t, { company: company._id, series, articles, actorId: managerUser._id }), ...extra });
    };
    const simple = await importModel("simple_vitrage", null, {}, { name: "Simple vitrage 6 mm", code: "SV6" });
    simple.parameters[0].default = String(art.float6._id); simple.markModified("parameters"); await simple.save();
    const dv = await importModel("double_vitrage", null, { intercalaire: art.intercalaire._id, intercalaire_v: art.intercalaire._id, angles: art.angleInt._id, butyl: art.butyl._id, dessicant: art.dessicant._id, mastic: art.mastic._id }, { name: "Double vitrage 4/16/4", code: "DV4164" });
    dv.parameters.forEach((p) => { p.default = String(art.float4._id); }); dv.markModified("parameters"); await dv.save();
    const panneau = await importModel("panneau_simple", null, {}, { name: "Panneau tôle laquée", code: "PAN-TOLE" });
    panneau.parameters[0].default = String(art.tole._id); panneau.markModified("parameters"); await panneau.save();
    const withGlass = async (model) => { const p = model.parameters.find((x) => x.key === "vitrage"); if (p) { p.default = String(dv._id); model.markModified("parameters"); await model.save(); } return model; };
    const c2 = await withGlass(await importModel("coulissant_2v", s67, slidingArticles, { name: "Coulissant 2 vantaux — série 67", code: "C67-2V" }));
    await withGlass(await importModel("coulissant_4v", s67, slidingArticles, { name: "Coulissant 4 vantaux — série 67", code: "C67-4V" }));
    await withGlass(await importModel("baie_coulissante_2v", s67, slidingArticles, { name: "Baie coulissante 2 vantaux — série 67", code: "C67-B2V" }));
    const f2 = await withGlass(await importModel("francaise_2v", s50, casementArticles, { name: "Fenêtre 2 vantaux — série 50", code: "O50-F2" }));
    await withGlass(await importModel("francaise_1v", s50, casementArticles, { name: "Fenêtre 1 vantail — série 50", code: "O50-F1" }));
    await withGlass(await importModel("ob_1v", s50, casementArticles, { name: "Oscillo-battant 1 vantail — série 50", code: "O50-OB1" }));
    const fixe = await withGlass(await importModel("fixe", s50, casementArticles, { name: "Châssis fixe — série 50", code: "O50-FX" }));
    const porte = await withGlass(await importModel("porte_1v", s50, casementArticles, { name: "Porte 1 vantail — série 50", code: "O50-P1" }));
    const pp = porte.parameters.find((x) => x.key === "panneau"); pp.default = String(panneau._id); porte.markModified("parameters"); await porte.save();
    const imposte = await importModel("ouvrant_imposte", null, { accouplement: art.traverseInter._id, silicone: art.silicone._id }, { name: "Fenêtre + imposte fixe — série 50", code: "O50-IMP" });
    imposte.parameters.find((x) => x.key === "bas").default = String(f2._id);
    imposte.parameters.find((x) => x.key === "haut").default = String(fixe._id);
    imposte.markModified("parameters"); await imposte.save();

    // A devis with chassis lines, priced from the catalogue.
    const villa = await Customer.create({ company: company._id, name: "Villa Anfa — M. Alami", kind: "individual", city: "Casablanca", phone: "+212661223344", paymentDays: 0, createdBy: salesUser._id });
    const { loadContext } = require("../services/productionPlanning");
    const ctx = await loadContext(company._id);
    const specs = [
      { model: c2._id, ref: "F1", L: 1800, H: 1250, quantity: 4, finish: white._id, params: { vitrage: String(dv._id), ms: 1 } },
      { model: f2._id, ref: "F2", L: 1100, H: 1350, quantity: 3, finish: white._id, params: { vitrage: String(dv._id) } },
      { model: porte._id, ref: "P1", L: 950, H: 2200, quantity: 1, finish: white._id, params: { rempl: 2, hs: 900, vitrage: String(dv._id), panneau: String(panneau._id), seuil: 1, fp: 0 } },
      { model: fixe._id, ref: "FX1", L: 700, H: 1350, quantity: 2, finish: white._id, params: { vitrage: String(dv._id) } },
    ];
    const lines = specs.map((sp) => {
      const price = bom.priceChassis({ ...sp, model: String(sp.model), finish: String(sp.finish) }, ctx);
      return {
        description: bom.describeChassis({ ...sp, model: String(sp.model), finish: String(sp.finish) }, ctx), quantity: sp.quantity, unit: "u",
        unitPrice: Math.round(price.unitPrice), vatRate: 20,
        chassis: { model: sp.model, ref: sp.ref, L: sp.L, H: sp.H, finish: sp.finish, params: sp.params },
      };
    });
    lines.push({ description: "Pose et étanchéité sur chantier", quantity: 1, unit: "forfait", unitPrice: 6500, vatRate: 20 });
    const aluQuote = await createWithNumber(Quote, {
      company: company._id, customer: villa._id, date: daysAgo(12), validUntil: dayOffset(18), subject: "Menuiserie aluminium — villa Anfa (RAL 9016)",
      lines, paymentTerms: "40% à la commande, 50% à la livraison, 10% à la réception", status: "accepted", sentAt: daysAgo(12), decidedAt: daysAgo(6),
      createdBy: salesUser._id, updatedBy: salesUser._id,
    }, "DV");
    const aluProject = await createWithNumber(Project, {
      company: company._id, name: "Villa Anfa — menuiserie aluminium", customer: villa._id, quote: aluQuote._id, status: "in_progress",
      startDate: daysAgo(5), dueDate: dayOffset(21), manager: managerEmployee._id, team: [managerEmployee._id, reportEmployee._id], location: "Casablanca — Anfa",
      budget: { revenue: aluQuote.totalHT, materials: Math.round(aluQuote.totalHT * 0.45), labour: Math.round(aluQuote.totalHT * 0.12), other: 1500 },
      finish: white._id,
      items: specs.map((sp) => ({ ...sp, label: "" })),
      createdBy: managerUser._id, updatedBy: managerUser._id,
    }, "PRJ");
    aluQuote.project = aluProject._id;
    await aluQuote.save();

    // Colour-matched accessories (white handles, hinges…) are bought ready-made.
    {
      const { ensureVariant: mkVariant } = require("../services/productionPlanning");
      const vctx = await loadContext(company._id);
      for (const key of ["poignee", "busette", "paumelle", "cremone", "bequille"]) {
        const v = await mkVariant(vctx, art[key].toObject(), white.toObject(), managerUser._id);
        await Product.updateOne({ _id: v._id }, { quantity: 80, prices: [{ supplierName: "Profilés du Maroc", price: Math.round(art[key].prices[0].price * 1.1 * 100) / 100 }] });
      }
    }

    // Work orders: laquage done (lacquered bars in stock), vitrage in progress, aluminium waiting.
    const { orders } = await createOrdersForProject(aluProject, managerUser._id);
    const byKind = Object.fromEntries(orders.map((o) => [o.kind, o]));
    const businessNotifications = require("../services/businessNotifications");
    await businessNotifications.onOrdersPlanned(aluProject, orders, managerUser._id);
    if (byKind.laquage) {
      const settings = await ensureProductionDefaults(company._id);
      await completeOrder(byKind.laquage, { consumeRemaining: true }, managerUser._id, settings);
      await businessNotifications.onOrderCompleted(byKind.laquage, managerUser._id);
    }
    if (byKind.vitrage) {
      const glassNeeds = byKind.vitrage.needs.filter((n) => n.kind === "glass" && n.product).map((n) => ({ need: n._id, quantity: Math.round(n.theoretical * 0.6 * 100) / 100 }));
      await consume(byKind.vitrage, { lines: glassNeeds }, employeeUser._id);
    }
    // ---------- Chassis tracking + logistics ----------
    // F1 (4 sliding windows): frames and sashes made & ready; glass still in
    // the glazing workshop. BL-…-0001 delivered the 4 FRAMES only (no glass),
    // BL-…-0002 is planned tomorrow for the sashes + fly screens of F1-1/F1-2.
    const tracking = require("../services/trackingService");
    // Logistique: its own department and manager (Karim), who hands out
    // permissions to his team — Said the driver (only what a driver needs),
    // who can himself give a subset to his helper Omar.
    const logisticsDept = await Department.findOne({ company: company._id, permissionKey: "logistics" });
    const logEmp = (data) => Employee.create({
      company: company._id, gender: "male", maritalStatus: "single", numberOfDependents: 0, nationality: "Moroccan",
      employmentStatus: "active", employmentType: "permanent", workLocation: "Casablanca Plant", hireDate: new Date(Date.now() - 400 * 86400000),
      department: logisticsDept._id, createdBy: admin._id, updatedBy: admin._id, ...data,
    });
    const karimEmp = await logEmp({ employeeNumber: "EMP-020", firstName: "Karim", lastName: "Benali", jobTitle: "Responsable logistique" });
    await Department.updateOne({ _id: logisticsDept._id }, { manager: karimEmp._id });
    const saidEmp = await logEmp({ employeeNumber: "EMP-021", firstName: "Said", lastName: "Amrani", jobTitle: "Chauffeur-livreur", manager: karimEmp._id });
    const omarEmp = await logEmp({ employeeNumber: "EMP-022", firstName: "Omar", lastName: "Tazi", jobTitle: "Aide-livreur", manager: saidEmp._id });
    const logisticsUser = await User.create({ firstName: "Karim", lastName: "Benali", email: "logistique@frame.test", password: "Logistique@123", role: "user", department: "logistics", employee: karimEmp._id });
    const { PRESETS } = require("../config/permissionCatalog");
    const driverKeys = PRESETS.find((pr) => pr.key === "driver").keys();
    await User.create({ firstName: "Said", lastName: "Amrani", email: "chauffeur@frame.test", password: "Chauffeur@123", role: "user", employee: saidEmp._id,
      permissionsMode: "custom", permissions: [...driverKeys, "team.permissions.manage"] });
    await User.create({ firstName: "Omar", lastName: "Tazi", email: "aide-livreur@frame.test", password: "AideLivreur@123", role: "user", employee: omarEmp._id,
      permissionsMode: "custom", permissions: ["logistics.notes.view", "logistics.tracking.view"] });
    await tracking.syncProjectUnits(aluProject, managerUser._id);
    const f1Units = await TrackingUnit.find({ project: aluProject._id, ref: /^F1/ }).sort({ index: 1 });
    await tracking.applyAction(aluProject._id, "ready", f1Units.flatMap((u) => u.parts.filter((pt) => ["frame", "sash", "screen"].includes(pt.kind)).map((pt) => ({ unit: u._id, part: pt._id }))), managerUser._id);
    const fresh = await TrackingUnit.find({ project: aluProject._id, ref: /^F1/ }).populate("finish", "code").sort({ index: 1 });
    const sizeOf = (u, pt) => (pt.width && pt.height ? `${pt.width} × ${pt.height}` : `${u.L} × ${u.H}`);
    const lineOf = (u, kind) => { const pt = u.parts.find((x) => x.kind === kind); return { unit: u._id, part: pt._id, ref: u.ref, label: u.label, partLabel: pt.label, partKind: pt.kind, size: sizeOf(u, pt), finish: u.finish?.code || "", quantity: pt.quantity }; };
    // F2-1 (casement): chassis made & ready, glass 1 in progress, glass 2 not started.
    const f21 = await TrackingUnit.findOne({ project: aluProject._id, ref: "F2-1" });
    if (f21) {
      const chassisPart = f21.parts.find((x) => x.kind === "complete");
      const glass1 = f21.parts.find((x) => x.label === "Vitrage 1");
      await tracking.applyAction(aluProject._id, "ready", [{ unit: f21._id, part: chassisPart._id }], managerUser._id);
      if (glass1) await tracking.applyAction(aluProject._id, "started", [{ unit: f21._id, part: glass1._id }], employeeUser._id);
    }
    const bl1 = await createWithNumber(DeliveryNote, {
      company: company._id, project: aluProject._id, customer: villa._id, status: "delivered", date: daysAgo(1), deliveredAt: daysAgo(1), shippedAt: daysAgo(1), timeSlot: "9h–11h",
      address: "Casablanca — Anfa", siteContact: "M. Alami", sitePhone: "+212661223344",
      transport: { mode: "own", vehicle: "Camion 12345-A-6", driver: "Said", driverPhone: "+212600112233", cost: 0 },
      packages: 2, lines: fresh.map((u) => lineOf(u, "frame")), extraLines: [{ label: "Pattes de fixation + chevilles", quantity: 1, unit: "lot" }],
      notes: "Dormants seuls : vitrages et vantaux à la prochaine livraison.", receivedBy: "M. Alami",
      history: [{ status: "delivered", note: "", by: logisticsUser._id }], createdBy: logisticsUser._id,
    }, "BL");
    for (const u of fresh) {
      const pt = u.parts.find((x) => x.kind === "frame");
      pt.deliveredQty = pt.quantity;
      u.history.push({ by: logisticsUser._id, action: "delivered", note: `${bl1.number} : ${pt.label}` });
      u.markModified("parts");
      await u.save();
    }
    const bl2 = await createWithNumber(DeliveryNote, {
      company: company._id, project: aluProject._id, customer: villa._id, status: "planned", date: dayOffset(1), timeSlot: "14h–16h",
      address: "Casablanca — Anfa", siteContact: "M. Alami", sitePhone: "+212661223344",
      transport: { mode: "carrier", carrier: "Transports Atlas", vehicle: "Plateau 9876-B-6", driver: "Hassan", driverPhone: "+212600445566", cost: 900 },
      packages: 4, lines: fresh.slice(0, 2).flatMap((u) => u.parts.filter((x) => ["sash", "screen"].includes(x.kind)).map((pt) => ({ unit: u._id, part: pt._id, ref: u.ref, label: u.label, partLabel: pt.label, partKind: pt.kind, size: sizeOf(u, pt), chassisSize: `${u.L} × ${u.H}`, finish: u.finish?.code || "", quantity: pt.quantity }))),
      notes: "Vantaux + moustiquaires F1-1 et F1-2. Prévoir chevalets.", history: [{ status: "planned", note: "", by: logisticsUser._id }], createdBy: logisticsUser._id,
    }, "BL");
    console.log(`✓ Aluminium joinery: 3 workshops, ${Object.keys(art).length} articles, 5 colours, 2 series, ${await ChassisModel.countDocuments({ company: company._id })} chassis models, devis ${aluQuote.number} → project ${aluProject.number} → ${orders.map((o) => `${o.number} (${o.kind})`).join(", ")}; tracking + ${bl1.number} (delivered, frames only) and ${bl2.number} (planned)`);
  }

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
  console.log("  Purchasing     achats@frame.test       / Achats@123     (service achats)");
  console.log("  HR (assistant) hr-assistant@frame.test / HrAssist@123   (hr_assistant tier -> view-only, most actions blocked)");
  console.log("  Manager        manager@frame.test      / Manager@123    (Production department manager — see My Space > My department)");
  console.log("  Employee       employee@frame.test     / Employee@123   (Opérateur de Production — My Space + Vitrage workshop manager)");
  console.log("============================================================");
  console.log("Also seeded: 6 employees, departments + job positions, salaries,");
  console.log("contracts, absences, advances, documents, attendance, a completed");
  console.log("payroll run, inventory (2 categories, 2 products, one below its");
  console.log("low-stock threshold), 2 purchase requests, 2 performance reviews");
  console.log("(one draft, one submitted), 1 unacknowledged disciplinary action,");
  console.log("and a few notifications.");
  console.log("============================================================");
  console.log("To remove all of this later: npm run unseed");
  console.log("============================================================");
}

run().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
