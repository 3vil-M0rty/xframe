import { describe, it, expect } from "vitest";

const { parsePreetabli, buildDeclarationPlan, buildDeclarationFile } = require("./damancomService");
const { validateRib, ribWithKey, buildTransferPlan, buildTransferCsv } = require("./bankTransferService");
const { monthlySummary, buildAnnualDeclaration, buildAnnualXml, deadlineFor } = require("./simplIrService");
const { makePreetabli } = require("../test/preetabliFixture");
const { LINE_LENGTH } = require("../config/cnssBdsLayout");

const emp = (o) => ({ _id: o.id, firstName: o.first, lastName: o.last, cnssNumber: o.cnss, cin: o.cin, paymentMethod: "bank_transfer", bank: { rib: o.rib }, ...o.extra });
const slip = (e, gross, extra = {}) => ({ employee: e, grossSalary: gross, netSalary: gross * 0.85, incomeTax: 100, monthlyTaxableIncome: gross * 0.7, professionalExpenses: 500, cnssEmployee: 200, amoEmployee: 50, baseSalary: gross, declaredDays: 26, ...extra });

describe("Damancom declaration", () => {
  const ali = emp({ id: "a", first: "Ali", last: "Amrani", cnss: "111111111", cin: "BE1" });
  const sara = emp({ id: "s", first: "Sara", last: "Bennis", cnss: "222222222", cin: "BE2" });
  const newbie = emp({ id: "n", first: "Nour", last: "Chafik", cnss: "333333333", cin: "BE3" });
  const pre = makePreetabli({ employees: [{ cnss: "111111111", name: "AMRANI ALI", children: 2, af: 60000 }, { cnss: "222222222", name: "BENNIS SARA" }] });

  it("reads the préétabli", () => {
    const p = parsePreetabli(pre);
    expect(p.header.L_Periode_raw).toBe("202609");
    expect(p.employees.map((e) => e.cnssNumber)).toEqual(["111111111", "222222222"]);
    expect(p.employees[0].children).toBe(2);
    expect(p.transferId).toBe("00000000012345");
  });

  it("refuses a file that isn't a préétabli", () => {
    expect(() => parsePreetabli("hello")).toThrow(/préétabli/);
  });

  it("matches payroll to the préétabli, lists entrants, asks a situation for insured people without payslip", () => {
    const plan = buildDeclarationPlan({ preetabli: parsePreetabli(pre), run: { month: 9, year: 2026 }, company: { cnssNumber: "1234567" },
      payslips: [slip(ali, 8000), slip(newbie, 5000, { declaredDays: 12 })] });
    expect(plan.insured.find((r) => r.cnssNumber === "111111111")).toMatchObject({ gross: 8000, capped: 6000, days: 26 });
    expect(plan.entrants).toEqual([expect.objectContaining({ cnssNumber: "333333333", days: 12, gross: 5000 })]);
    expect(plan.ready).toBe(false);
    expect(plan.problems[0].code).toBe("needs_situation");

    const ok = buildDeclarationPlan({ preetabli: parsePreetabli(pre), run: { month: 9, year: 2026 }, company: {},
      payslips: [slip(ali, 8000), slip(newbie, 5000, { declaredDays: 12 })], situations: { 222222222: "SO" } });
    expect(ok.ready).toBe(true);
    expect(ok.totals).toMatchObject({ employees: 3, days: 38, gross: 13000, capped: 11000 });
  });

  it("flags a préétabli of another month and employees without CNSS number", () => {
    const plan = buildDeclarationPlan({ preetabli: parsePreetabli(pre), run: { month: 8, year: 2026 }, company: {},
      payslips: [slip(ali, 8000), slip(sara, 4000), slip(emp({ id: "x", first: "X", last: "Y" }), 3000)] });
    expect(plan.problems.map((p) => p.code).sort()).toEqual(["missing_cnss", "period_mismatch"]);
  });

  it("writes fixed-width B00–B06 lines with amounts in centimes and consistent totals", () => {
    const plan = buildDeclarationPlan({ preetabli: parsePreetabli(pre), run: { month: 9, year: 2026 }, company: {},
      payslips: [slip(ali, 8000.5), slip(newbie, 5000, { declaredDays: 12 })], situations: { 222222222: "IL" } });
    const lines = buildDeclarationFile(plan).split("\r\n").filter(Boolean);
    expect(lines.map((l) => l.slice(0, 3))).toEqual(["B00", "B01", "B02", "B02", "B03", "B04", "B05", "B06"]);
    expect(lines.every((l) => l.length === LINE_LENGTH)).toBe(true);
    const b02 = lines[2];
    // type(3) affilié(7) période(6) assuré(9) nom(60) enfants(2) AF×4(24) jours(2) réel(13) plafonné(9) situation(2)
    expect(b02.slice(16, 25)).toBe("111111111");
    expect(b02.slice(111, 113)).toBe("26");
    expect(b02.slice(113, 126)).toBe("0000000800050"); // 8 000,50 MAD
    expect(b02.slice(126, 135)).toBe("000600000"); // capped at 6 000
    expect(lines[3].slice(135, 137)).toBe("IL");
    // B06 = B03 + B05 (salaries count)
    const count = (l) => Number(l.slice(16, 22));
    expect(count(lines[7])).toBe(count(lines[4]) + count(lines[6]));
  });
});

describe("bank transfer", () => {
  it("validates the Moroccan RIB key", () => {
    const good = ribWithKey("0077800001234567890123");
    expect(validateRib(good)).toMatchObject({ valid: true, bankName: "Attijariwafa bank" });
    const bad = good.slice(0, 10) + ((Number(good[10]) + 1) % 10) + good.slice(11);
    expect(validateRib(bad)).toMatchObject({ valid: false, reason: "key" });
    expect(validateRib("123")).toMatchObject({ valid: false, reason: "length" });
    expect(validateRib("")).toMatchObject({ valid: false, reason: "missing" });
    expect(validateRib(`MA64${good}`)).toMatchObject({ valid: true, rib: good });
    expect(validateRib(ribWithKey("1817800001234567890123")).bankName).toBe("Banque Populaire");
  });

  it("builds the transfer list; a wrong RIB blocks the file; cash is listed apart", () => {
    const rib = ribWithKey("0117800001234567890123");
    const company = { name: "Atlas", bank: { rib: ribWithKey("0077800009999999999999") } };
    const e1 = emp({ id: "1", first: "Ali", last: "A", rib });
    const e2 = emp({ id: "2", first: "Sara", last: "B", rib: "123" });
    const e3 = { ...emp({ id: "3", first: "Cash", last: "C" }), paymentMethod: "cash" };
    const plan = buildTransferPlan({ run: { month: 9, year: 2026 }, company, payslips: [slip(e1, 1000), slip(e2, 1000), slip(e3, 1000)] });
    expect(plan.count).toBe(1);
    expect(plan.total).toBe(850);
    expect(plan.otherPayments).toHaveLength(1);
    expect(plan.ready).toBe(false);
    expect(plan.problems[0].message).toMatch(/24 digits/);
    const csv = buildTransferCsv(plan);
    expect(csv).toContain(rib);
    expect(csv).toContain("SALAIRE 09/2026");
  });
});

describe("Simpl-IR", () => {
  it("monthly IR to pay, due at the end of the following month", () => {
    const s = monthlySummary({ run: { month: 12, year: 2026, status: "completed" }, payslips: [slip(emp({ id: "a" }), 8000), slip(emp({ id: "b" }), 3000, { incomeTax: 0 })] });
    expect(s.totalIncomeTax).toBe(100);
    expect(s.taxedEmployees).toBe(1);
    expect(deadlineFor(12, 2026).toISOString().slice(0, 10)).toBe("2027-01-31");
  });

  it("annual declaration per employee, from completed runs; XML escapes and sums", () => {
    const a = emp({ id: "a", first: "Ali", last: "Amrani & Fils", cin: "BE1" });
    const payslips = [slip(a, 8000), slip(a, 8000)];
    const decl = buildAnnualDeclaration({ company: { name: "Atlas", taxId: "1234" }, year: 2026, payslips, monthsCompleted: [1, 2] });
    expect(decl.employees[0]).toMatchObject({ gross: 16000, incomeTax: 200, months: 2, days: 52, contributions: 500 });
    expect(decl.warnings.some((w) => w.code === "missing_months")).toBe(true);
    const xml = buildAnnualXml(decl);
    expect(xml).toContain("<identifiantFiscal>1234</identifiantFiscal>");
    expect(xml).toContain("<nom>Amrani &amp; Fils</nom>");
    expect(xml).toContain("<irPreleve>200.00</irPreleve>");
    expect(xml).toContain("<totalMtIrPrelevePP>200.00</totalMtIrPrelevePP>");
  });

  it("no XML without the company's tax identifier", () => {
    const decl = buildAnnualDeclaration({ company: { name: "Atlas" }, year: 2026, payslips: [slip(emp({ id: "a" }), 1000)] });
    expect(decl.ready).toBe(false);
    expect(() => buildAnnualXml(decl)).toThrow();
  });
});
