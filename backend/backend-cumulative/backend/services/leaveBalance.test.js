import { describe, it, expect, vi, afterEach } from "vitest";

const Absence = require("../models/Absence");
const { getLeaveBalance, annualEntitlement, accruedBetween } = require("./leaveBalanceService");
const { countWorkingDays } = require("./workingDays");

afterEach(() => vi.restoreAllMocks());

function mockLeave(rows) {
  vi.spyOn(Absence, "find").mockImplementation((filter) => ({
    select: async () => rows.filter((r) => !filter.startDate?.$gte || new Date(r.startDate) >= filter.startDate.$gte),
  }));
}

describe("legal leave entitlement (Code du travail art. 231–232)", () => {
  const at = new Date("2026-06-15");
  it("1.5 days per month = 18 days a year", () => {
    expect(annualEntitlement({ hireDate: new Date("2024-01-01"), dateOfBirth: new Date("1990-01-01"), at }).total).toBe(18);
  });
  it("2 days per month for an employee under 18", () => {
    const e = annualEntitlement({ hireDate: new Date("2025-09-01"), dateOfBirth: new Date("2009-01-01"), at });
    expect(e.isMinor).toBe(true);
    expect(e.total).toBe(24);
  });
  it("+1.5 days per full 5 years of service", () => {
    expect(annualEntitlement({ hireDate: new Date("2021-06-15"), at }).total).toBe(19.5); // exactly 5 years
    expect(annualEntitlement({ hireDate: new Date("2021-06-16"), at }).total).toBe(18); // one day short
    expect(annualEntitlement({ hireDate: new Date("2011-01-01"), at }).total).toBe(22.5); // 15 years
  });
  it("never more than 30 days a year", () => {
    expect(annualEntitlement({ hireDate: new Date("1980-01-01"), at }).legal).toBe(30);
  });
  it("company days on top of the law", () => {
    expect(annualEntitlement({ hireDate: new Date("2024-01-01"), at, extraDaysPerYear: 4 }).total).toBe(22);
  });
  it("accrues month by month at the rate in force (seniority bonus starts after 5 years)", () => {
    // 12 months just before + 12 months just after the 5-year mark
    const hire = new Date("2016-01-01");
    const accrued = accruedBetween({ from: new Date("2020-01-01"), asOf: new Date("2022-01-01"), hireDate: hire });
    expect(accrued).toBe(18 + 19.5);
  });
});

describe("leave balance", () => {
  it("accrued − taken, from the hire date", async () => {
    mockLeave([{ daysCount: 6, startDate: "2026-03-02" }, { daysCount: 2, startDate: "2025-08-04" }]);
    const b = await getLeaveBalance({ _id: "e", hireDate: new Date("2025-01-10") }, new Date("2026-01-10"), { extraDaysPerYear: 0 });
    expect(b.accruedDays).toBe(18);
    expect(b.usedDays).toBe(8);
    expect(b.remainingDays).toBe(10);
  });

  it("opening balance: accrual restarts from its date and older leave isn't counted twice", async () => {
    mockLeave([{ daysCount: 5, startDate: "2025-03-03" }, { daysCount: 3, startDate: "2026-02-02" }]);
    const b = await getLeaveBalance(
      { _id: "e", hireDate: new Date("2015-01-01"), leaveOpeningBalance: { days: 12, asOf: new Date("2026-01-01") } },
      new Date("2026-05-01"),
      { extraDaysPerYear: 0 }
    );
    // 12 + 4 months × (19.5 + 1.5 → 21 days/yr for 11 full years → 2 bonuses) / 12
    expect(b.openingBalance.days).toBe(12);
    expect(b.accruedDays).toBe(12 + 7);
    expect(b.usedDays).toBe(3);
    expect(b.remainingDays).toBe(16);
  });

  it("warns when more than 2 years of leave piled up (art. 240)", async () => {
    mockLeave([]);
    const b = await getLeaveBalance({ _id: "e", hireDate: new Date("2022-01-01") }, new Date("2026-01-01"), { extraDaysPerYear: 0 });
    expect(b.remainingDays).toBe(72);
    expect(b.excessCarryOver).toBe(true);
  });
});

describe("working days", () => {
  it("REGRESSION: a week of leave on a Monday–Saturday schedule costs 6 days, not 7", () => {
    expect(countWorkingDays(new Date(2026, 8, 7), new Date(2026, 8, 13))).toBe(6); // Mon 7 → Sun 13 Sept
  });
  it("closed public holidays don't count", () => {
    const closedDays = new Set(["2026-11-18"]); // Fête de l'Indépendance, a Wednesday
    expect(countWorkingDays(new Date(2026, 10, 16), new Date(2026, 10, 20), { closedDays })).toBe(4);
  });
  it("follows the company's schedule (Monday–Friday)", () => {
    const workingWeekdays = new Set([1, 2, 3, 4, 5]);
    expect(countWorkingDays(new Date(2026, 8, 7), new Date(2026, 8, 13), { workingWeekdays })).toBe(5);
  });
});
