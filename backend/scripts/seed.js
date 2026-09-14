/**
 * ============================================================
 * SEED SCRIPT
 * ============================================================
 * Populates the database with a realistic, interconnected set of
 * test data covering every module: users (with different roles/
 * departments, some linked to employees for self-service testing),
 * a company, employees (including a manager → report relationship
 * for testing manager-approval routing), salaries, contracts,
 * absences, advances, documents, attendance, and a completed
 * payroll run.
 *
 * Run with:  npm run seed   (from backend/)
 * or:        node scripts/seed.js
 *
 * This WIPES the collections it touches before reseeding, so
 * don't run it against a database you care about.
 * ============================================================
 */

const mongoose = require("mongoose");
require("dotenv").config();

const User = require("../models/User");
const Company = require("../models/Company");
const Employee = require("../models/Employee");
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
  ]);

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
    department: "production",
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
    jobTitle: "Production Manager",
    department: "Production",
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
    jobTitle: "Production Line Operator",
    department: "Production",
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
      department: "Finance",
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
      department: "Sales",
      employmentType: "fixed_term",
      manager: null,
      hireDate: daysAgo(150),
    },
    {
      employeeNumber: "EMP-005",
      firstName: "Salma",
      lastName: "Idrissi",
      gender: "female",
      jobTitle: "HR Assistant",
      department: "Human Resources",
      employmentType: "permanent",
      manager: null,
      hireDate: daysAgo(600),
    },
    {
      employeeNumber: "EMP-006",
      firstName: "Omar",
      lastName: "Tahiri",
      gender: "male",
      jobTitle: "Machine Operator",
      department: "Production",
      employmentType: "temporary",
      manager: managerEmployee._id,
      hireDate: daysAgo(60),
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

  // Link the manager/employee test accounts to their Employee
  // records — this is exactly what Employees > (row) > "Link user
  // account" does in the UI.
  await User.findByIdAndUpdate(managerUser._id, { employee: managerEmployee._id });
  await User.findByIdAndUpdate(employeeUser._id, { employee: reportEmployee._id });

  console.log("✓ Linked manager@frame.test and employee@frame.test to their employee records");

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
      department: emp.department,
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
  console.log("  Admin          admin@frame.test    / Admin@123");
  console.log("  Owner          owner@frame.test    / Owner@123");
  console.log("  HR             hr@frame.test       / Hr@12345");
  console.log("  Manager        manager@frame.test  / Manager@123   (linked employee, has 1 direct report)");
  console.log("  Employee       employee@frame.test / Employee@123  (linked employee, reports to Manager)");
  console.log("============================================================\n");

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
