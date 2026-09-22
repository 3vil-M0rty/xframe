import { describe, it, expect, vi, beforeEach } from "vitest";

const Employee = require("../models/Employee");
const Department = require("../models/Department");
const { previewImport } = require("./employeeBulkImportService");

describe("employeeBulkImportService.previewImport", () => {
  const company = { _id: "c1" };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(Employee, "find").mockReturnValue({
      select: () =>
        Promise.resolve([
          { employeeNumber: "EMP-0001", cin: "AB111111" },
          { employeeNumber: "EMP-0002", cin: "CD222222" },
        ]),
    });
    vi.spyOn(Department, "find").mockReturnValue({
      select: () => Promise.resolve([{ _id: "dep1", name: "Production" }]),
    });
  });

  it("validates a well-formed row with no errors, auto-generates an employee number, and parses salary", async () => {
    const csv = [
      "firstName,lastName,cin,hireDate,department,employmentType,baseSalary",
      "Yassine,El Amrani,EF333333,2021-03-15,Production,permanent,8000",
    ].join("\n");

    const result = await previewImport(Buffer.from(csv), company);
    expect(result.errorCount).toBe(0);
    expect(result.rows[0].employeeNumber).toMatch(/^EMP-\d{4}$/);
    expect(result.rows[0].baseSalary).toBe(8000);
  });

  it("REGRESSION: does not silently convert a negative salary into a positive one", async () => {
    // Bug history: the original "strip non-numeric characters"
    // regex also stripped the minus sign, so "-500" became a valid
    // 500 instead of being rejected. Locking this in permanently.
    const csv = [
      "firstName,lastName,cin,hireDate,department,employmentType,baseSalary",
      "Omar,Fassi,KL666666,2023-09-01,,,-500",
    ].join("\n");

    const result = await previewImport(Buffer.from(csv), company);
    expect(result.rows[0].baseSalary).toBeNull();
    expect(result.rows[0].warnings.some((w) => w.toLowerCase().includes("salary"))).toBe(true);
  });

  it("correctly parses a currency-formatted salary despite commas and a currency suffix", async () => {
    const csv = [
      "firstName,lastName,cin,hireDate,department,employmentType,baseSalary",
      'Leila,Amrani,MN777777,2023-10-01,,,"8,500 MAD"',
    ].join("\n");

    const result = await previewImport(Buffer.from(csv), company);
    expect(result.rows[0].baseSalary).toBe(8500);
  });

  it("flags a missing first name as a hard error", async () => {
    const csv = [
      "firstName,lastName,cin,hireDate",
      ",Alaoui,GH444444,2023-01-10",
    ].join("\n");

    const result = await previewImport(Buffer.from(csv), company);
    expect(result.rows[0].errors.some((e) => e.includes("First name"))).toBe(true);
  });

  it("flags a CIN that already exists in the database as a hard error", async () => {
    const csv = [
      "firstName,lastName,cin,hireDate",
      "Karim,Idrissi,AB111111,2020-05-01", // AB111111 already exists per the mock above
    ].join("\n");

    const result = await previewImport(Buffer.from(csv), company);
    expect(result.rows[0].errors.some((e) => e.includes("AB111111"))).toBe(true);
  });

  it("flags an unparseable hire date as a hard error", async () => {
    const csv = [
      "firstName,lastName,cin,hireDate",
      "Nadia,Chraibi,IJ555555,not-a-date",
    ].join("\n");

    const result = await previewImport(Buffer.from(csv), company);
    expect(result.rows[0].errors.some((e) => e.includes("hire date"))).toBe(true);
  });

  it("treats an unknown department as a soft warning, not a hard error", async () => {
    const csv = [
      "firstName,lastName,hireDate,department",
      "Sara,Bennis,2022-06-15,Ventes", // "Ventes" doesn't exist per the mock above
    ].join("\n");

    const result = await previewImport(Buffer.from(csv), company);
    expect(result.rows[0].errors.length).toBe(0);
    expect(result.rows[0].warnings.some((w) => w.includes("Ventes"))).toBe(true);
  });
});
