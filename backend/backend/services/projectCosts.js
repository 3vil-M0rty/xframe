const { calculatePayslip } = require("./payrollCalculationService");

/**
 * ============================================================
 * PROJECT COSTS & MARGIN (pure except hourlyCostFor)
 * ============================================================
 * Real cost of a project (HT):
 *   materials  inventory taken out for the project × unit cost then
 *   purchases  purchase orders linked to the project (sent or
 *              received, not drafts/cancelled), their HT total
 *   labour     hours entered × each employee's hourly cost then
 *   other      project expenses (transport, subcontracting…)
 * Revenue: the devis HT (budget.revenue); invoiced: issued invoices
 * and deposits minus credit notes (HT).
 * ============================================================
 */

const round2 = (n) => Math.round(((Number(n) || 0) + Number.EPSILON) * 100) / 100;

const DEFAULT_MONTHLY_HOURS = 191; // legal monthly hours (44 h/week)

/**
 * What one hour of this employee costs the company: monthly employer
 * cost (gross + employer CNSS, AMO, training tax) ÷ monthly hours.
 */
function hourlyCostFromSalary(salary, monthlyHours = DEFAULT_MONTHLY_HOURS) {
  if (!salary || !(salary.baseSalary > 0)) return 0;
  const calc = calculatePayslip({
    baseSalary: salary.baseSalary,
    allowances: salary.allowances || [],
    deductions: [],
    numberOfDependents: 0,
  });
  return round2(calc.employer.totalEmployerCost / (monthlyHours || DEFAULT_MONTHLY_HOURS));
}

async function hourlyCostFor(employeeId, companyId) {
  const Salary = require("../models/Salary");
  const { scheduleForEmployee } = require("./scheduleResolver");
  const [salary, schedule] = await Promise.all([
    Salary.findOne({ employee: employeeId, endDate: null }).lean(),
    // The employee's department schedule (its monthly standard hours).
    scheduleForEmployee(employeeId, companyId, { lean: true }),
  ]);
  return hourlyCostFromSalary(salary, schedule?.hoursManagement?.monthlyStandardHours);
}

/** Progress % from tasks: done tasks weighted by estimated hours (or count). */
function progressFromTasks(tasks = []) {
  const live = tasks.filter((t) => t.status !== "cancelled");
  if (!live.length) return 0;
  const weighted = live.some((t) => t.estimatedHours > 0);
  const weight = (t) => (weighted ? t.estimatedHours || 0 : 1);
  const total = live.reduce((s, t) => s + weight(t), 0);
  const done = live.filter((t) => t.status === "done").reduce((s, t) => s + weight(t), 0);
  return total ? Math.round((done / total) * 100) : 0;
}

function purchaseOrderHT(order) {
  return (order.lines || []).reduce((s, l) => s + (l.quantity || 0) * (l.unitPrice || 0), 0);
}

function invoicedHT(invoices = []) {
  return round2(
    invoices
      .filter((i) => ["issued", "partially_paid", "paid"].includes(i.status))
      .reduce((s, i) => s + (i.type === "credit_note" ? -1 : 1) * (i.totalHT || 0), 0)
  );
}

/**
 * @param {Object} p
 * @param {Object} p.project
 * @param {Array} p.movements  inventory movements tagged with the project
 * @param {Array} p.purchaseOrders
 * @param {Array} p.timeEntries
 * @param {Array} p.invoices
 * @param {Array} p.tasks
 */
function projectFinancials({ project, movements = [], purchaseOrders = [], timeEntries = [], invoices = [], tasks = [] }) {
  const materials = round2(
    movements.reduce((s, m) => s + (m.type === "out" ? 1 : m.type === "in" ? -1 : 0) * (m.quantity || 0) * (m.unitCost || 0), 0)
  );
  const orders = purchaseOrders.filter((o) => !["draft", "cancelled"].includes(o.status));
  const purchases = round2(orders.reduce((s, o) => s + purchaseOrderHT(o), 0));
  const labour = round2(timeEntries.reduce((s, t) => s + (t.cost || 0), 0));
  const hours = round2(timeEntries.reduce((s, t) => s + (t.hours || 0), 0));
  const other = round2((project.expenses || []).reduce((s, e) => s + (e.amount || 0), 0));
  const actualCost = round2(materials + purchases + labour + other);

  const b = project.budget || {};
  const plannedCost = round2((b.materials || 0) + (b.labour || 0) + (b.purchases || 0) + (b.other || 0));
  const revenue = round2(b.revenue || 0);
  const invoiced = invoicedHT(invoices);
  const collected = round2(
    invoices
      .filter((i) => i.type !== "credit_note" && ["issued", "partially_paid", "paid"].includes(i.status))
      .reduce((s, i) => s + (i.amountPaid || 0), 0)
  );

  const margin = (rev, cost) => ({ amount: round2(rev - cost), percent: rev ? Math.round(((rev - cost) / rev) * 1000) / 10 : null });

  return {
    actual: { materials, purchases, labour, other, total: actualCost, hours },
    budget: { materials: b.materials || 0, purchases: b.purchases || 0, labour: b.labour || 0, other: b.other || 0, total: plannedCost },
    revenue,
    invoiced,
    toInvoice: round2(Math.max(revenue - invoiced, 0)),
    collectedTTC: collected,
    plannedMargin: margin(revenue, plannedCost),
    actualMargin: margin(revenue, actualCost),
    budgetUsedPercent: plannedCost ? Math.round((actualCost / plannedCost) * 100) : null,
    overBudget: plannedCost > 0 && actualCost > plannedCost,
    progress: progressFromTasks(tasks),
  };
}

module.exports = { hourlyCostFromSalary, hourlyCostFor, progressFromTasks, projectFinancials, purchaseOrderHT, invoicedHT, DEFAULT_MONTHLY_HOURS };
