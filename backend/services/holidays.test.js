import { describe, it, expect, vi, beforeEach } from "vitest";

const ExcelJS = require("exceljs");
const request = require("supertest");
const express = require("express");
const { parseHolidayFile } = require("./holidayImportService");
const { resolveDaySchedule, applyHoliday, computeDay } = require("./attendanceCalc");

async function xlsxBuffer(rows) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Sheet1");
  rows.forEach((r) => ws.addRow(r));
  return Buffer.from(await wb.xlsx.writeBuffer());
}

describe("holiday file import", () => {
  it("reads a real .xlsx: Excel dates, typed dates, oui/non and double/normal", async () => {
    const buf = await xlsxBuffer([
      ["Date", "Nom", "Entreprise ouverte (oui/non)", "Paiement si travaillé (double/normal)"],
      [new Date(Date.UTC(2026, 2, 20)), "Aïd al-Fitr", "non", "double"],
      ["30/07/2026", "Fête du Trône", "oui", "normal"],
      ["2026-11-06", "Marche Verte", "", ""],
    ]);
    const { rows, errorCount } = await parseHolidayFile(buf, "feries.xlsx");
    expect(errorCount).toBe(0);
    expect(rows.map((r) => r.day)).toEqual(["2026-03-20", "2026-07-30", "2026-11-06"]);
    expect(rows[0]).toMatchObject({ name: "Aïd al-Fitr", isWorkingDay: false, payRate: 2 });
    expect(rows[1]).toMatchObject({ isWorkingDay: true, payRate: 1 });
    // blank optional columns stay undefined -> re-imports don't overwrite HR's in-app choices
    expect(rows[2].isWorkingDay).toBeUndefined();
    expect(rows[2].payRate).toBeUndefined();
  });

  it("flags bad rows individually instead of rejecting the whole file", async () => {
    const buf = await xlsxBuffer([
      ["Date", "Nom", "Paiement"],
      ["31/02/2026", "Impossible date", "double"],
      ["01/05/2026", "", "double"],
      ["01/05/2026", "Fête du Travail", "triple"],
      ["18/11/2026", "Fête de l'Indépendance", "x2"],
      ["18/11/2026", "Duplicate", "x2"],
    ]);
    const { rows, errorCount } = await parseHolidayFile(buf, "f.xlsx");
    expect(errorCount).toBe(4);
    expect(rows[0].errors[0]).toMatch(/date/i);
    expect(rows[1].errors[0]).toMatch(/name/i);
    expect(rows[2].errors.join()).toMatch(/double or normal/);
    expect(rows[3].errors).toEqual([]);
    expect(rows[4].errors[0]).toMatch(/Same date as row 5/);
  });

  it("reads a CSV saved by Excel in French format (semicolons, BOM)", async () => {
    const csv = "\uFEFFDate;Nom;Entreprise ouverte\n14/01/2026;Nouvel An Amazigh;non\n";
    const { rows, errorCount } = await parseHolidayFile(Buffer.from(csv), "f.csv");
    expect(errorCount).toBe(0);
    expect(rows[0]).toMatchObject({ day: "2026-01-14", name: "Nouvel An Amazigh", isWorkingDay: false });
  });

  it("reports missing required columns", async () => {
    const buf = await xlsxBuffer([["Something", "Else"], ["x", "y"]]);
    expect((await parseHolidayFile(buf, "f.xlsx")).missingColumns).toEqual(["date", "name"]);
  });
});

describe("downloadable template", () => {
  const authPath = require.resolve("../middleware/auth");
  require.cache[authPath] = { id: authPath, filename: authPath, loaded: true,
    exports: (req, res, next) => { req.user = { id: "u1", role: "admin" }; next(); } };
  const router = require("../routes/holidays");

  it("ROUND TRIP: the template's pre-filled fixed-date holidays import cleanly", async () => {
    const app = express(); app.use("/api/holidays", router);
    const res = await request(app).get("/api/holidays/template?year=2026").buffer(true)
      .parse((r, cb) => { const chunks = []; r.on("data", (c) => chunks.push(c)); r.on("end", () => cb(null, Buffer.concat(chunks))); });
    expect(res.status).toBe(200);
    const { rows, errorCount } = await parseHolidayFile(res.body, "jours-feries-2026.xlsx");
    expect(errorCount).toBe(0);
    expect(rows).toHaveLength(11);
    expect(rows.find((r) => r.day === "2026-10-31").name).toBe("Fête de l'Unité");
    expect(rows.every((r) => r.isWorkingDay === false && r.payRate === 2)).toBe(true);
  });
});

describe("attendance on a public holiday", () => {
  const DAY = new Date(2026, 6, 30);
  const at = (h, m = 0) => new Date(2026, 6, 30, h, m);
  const base = resolveDaySchedule({ startHour: 9, startMinute: 0, endHour: 16, endMinute: 0, graceMinutes: 10 });

  it("CLOSED holiday: nobody is late, and all worked time is holiday time (not overtime)", () => {
    const schedule = applyHoliday(base, { name: "Fête du Trône", isWorkingDay: false, payRate: 2 });
    const r = computeDay({ clockIn: at(10, 30), clockOut: at(14, 30) }, schedule, DAY);
    expect(r.lateMinutes).toBe(0);
    expect(r.holidayMinutes).toBe(240);
    expect(r.overtimeMinutes).toBe(0);
    expect(r.holidayPayRate).toBe(2);
  });

  it("OPEN holiday: normal schedule; scheduled hours are holiday time, extra stays overtime (no double counting)", () => {
    const schedule = applyHoliday(base, { name: "Fête du Trône", isWorkingDay: true, payRate: 2 });
    const r = computeDay({ clockIn: at(9), clockOut: at(17) }, schedule, DAY);
    expect(r.overtimeMinutes).toBe(60);
    expect(r.holidayMinutes).toBe(420);
  });

  it("an ordinary day has no holiday time", () => {
    const r = computeDay({ clockIn: at(9), clockOut: at(16) }, base, DAY);
    expect(r.holidayMinutes).toBe(0);
    expect(r.holidayPayRate).toBeNull();
  });
});

describe("payroll premium for holidays worked", () => {
  const Attendance = require("../models/Attendance");
  const { computePayrollAdjustments } = require("./payrollAttendanceService");
  const Absence = require("../models/Absence");
  const Advance = require("../models/Advance");

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(Absence, "find").mockReturnValue({ select: async () => [] });
    vi.spyOn(Advance, "find").mockResolvedValue([]);
  });

  const run = (records) => {
    vi.spyOn(Attendance, "find").mockReturnValue({ select: async () => records });
    // 191 MAD / 191 h = 1 MAD per hour keeps the arithmetic obvious
    return computePayrollAdjustments({ employeeId: "e1", month: 7, year: 2026, baseSalary: 191, hoursManagement: null });
  };

  it("double: 8h worked on a holiday adds 8 extra hours of pay", async () => {
    const r = await run([{ holidayMinutes: 480, holidayPayRate: 2 }]);
    expect(r.holidayAmount).toBe(8);
    expect(r.holidayHours).toBe(8);
  });

  it("normal: no premium (the holiday itself is already in the monthly salary)", async () => {
    const r = await run([{ holidayMinutes: 480, holidayPayRate: 1 }]);
    expect(r.holidayAmount).toBe(0);
    expect(r.holidayHours).toBe(8);
  });

  it("applies even when overtime pay is switched off", async () => {
    const r = await run([{ holidayMinutes: 120, holidayPayRate: 2 }, { overtimeMinutes: 60 }]);
    expect(r.holidayAmount).toBe(2);
    expect(r.overtimeAmount).toBe(0);
  });
});
