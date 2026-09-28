import { describe, it, expect, beforeAll } from "vitest";

/**
 * Several named schedules per company, each assigned to departments:
 * offices on a continuous day, the workshop on a split day with a
 * Saturday half day. An employee follows their department's schedule
 * (lateness, working days for leave), others the company default.
 */
const tenantScope = require("../services/tenantScope");
const fake = require("../test/fakeMongo");
const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET = "schedules-secret";

const User = require("../models/User");
const Tenant = require("../models/Tenant");
const Company = require("../models/Company");
const Department = require("../models/Department");
const Employee = require("../models/Employee");
const { scheduleForEmployee } = require("../services/scheduleResolver");
const { countAbsenceDays } = require("../services/workingDays");

let app;
let token;
let companyId;
let office;
let workshop;
let clerk;
let welder;
const h = () => ({ Authorization: `Bearer ${token}` });
const day = (o) => ({ isWorkingDay: true, startMinute: 0, endMinute: 0, graceMinutes: 10, splitShift: false, ...o });
const SPLIT = day({ startHour: 8, endHour: 18, splitShift: true, breakStartHour: 12, breakStartMinute: 0, breakEndHour: 14, breakEndMinute: 0 });

beforeAll(async () => {
  fake.connect();
  app = express();
  app.use(express.json());
  app.use((req, res, next) => tenantScope.bindRequest(req, tenantScope.SYSTEM, next));
  app.use("/api/work-schedule", require("./workSchedule"));
  tenantScope.enableStrictMode(true);
  await tenantScope.runAsSystem(async () => {
    const tenant = await Tenant.create({ name: "T" });
    const admin = await User.create({ firstName: "A", lastName: "A", email: "a@alu.ma", password: "secret12", role: "admin", tenant: tenant._id });
    const company = await Company.create({ name: "Alu", tenant: tenant._id, owner: admin._id, industry: "x", legalForm: "SARL" });
    companyId = String(company._id);
    office = await Department.create({ company: company._id, name: "Bureaux" });
    workshop = await Department.create({ company: company._id, name: "Atelier" });
    const emp = (firstName, dep) => Employee.create({ company: company._id, firstName, lastName: "X", employeeNumber: firstName, hireDate: new Date(), jobTitle: "Agent", department: dep._id });
    clerk = await emp("Clerk", office);
    welder = await emp("Welder", workshop);
    token = jwt.sign({ id: String(admin._id) }, process.env.JWT_SECRET);
  });
});

describe("several work schedules, per department", () => {
  let defaultId;
  let atelierId;

  it("starts with one default schedule and lists the departments", async () => {
    const r = await request(app).get(`/api/work-schedule/list?companyId=${companyId}`).set(h());
    expect(r.status).toBe(200);
    expect(r.body.data.schedules).toHaveLength(1);
    expect(r.body.data.schedules[0]).toMatchObject({ name: "Horaire standard", isDefault: true });
    expect(r.body.data.departments.map((d) => d.name)).toEqual(["Atelier", "Bureaux"]);
    defaultId = r.body.data.schedules[0]._id;
    // Offices: continuous 9-17, Saturday off
    await request(app).put(`/api/work-schedule/${defaultId}`).set(h())
      .send({ name: "Bureaux — journée continue", saturday: { isWorkingDay: false } }).expect(200);
  });

  it("creates a split schedule with a Saturday half day and assigns it to the workshop", async () => {
    const days = Object.fromEntries(["monday", "tuesday", "wednesday", "thursday", "friday"].map((d) => [d, SPLIT]));
    const c = await request(app).post("/api/work-schedule").set(h())
      .send({ companyId, name: "Atelier — horaire coupé", ...days, saturday: day({ startHour: 8, endHour: 12 }), sunday: { isWorkingDay: false } });
    expect(c.status).toBe(201);
    atelierId = c.body.data._id;
    expect(c.body.data.monday.workHours).toBe(8);      // 4h + 4h
    expect(c.body.data.saturday.workHours).toBe(4);    // half day, continuous inside a split schedule
    expect(c.body.data.saturday.splitShift).toBe(false);
    // same name twice is refused
    await request(app).post("/api/work-schedule").set(h()).send({ companyId, name: "Atelier — horaire coupé" }).expect(409);

    const a = await request(app).put(`/api/work-schedule/${atelierId}/departments`).set(h()).send({ departmentIds: [String(workshop._id)] });
    expect(a.status).toBe(200);
    expect(a.body.data.departments.find((d) => d.name === "Atelier").workSchedule).toBe(atelierId);
  });

  it("each employee follows their department's schedule", async () => {
    await tenantScope.runAsSystem(async () => {
      const w = await scheduleForEmployee(welder._id);
      const c = await scheduleForEmployee(clerk._id);
      expect(w.name).toBe("Atelier — horaire coupé");
      expect(w.monday.splitShift).toBe(true);
      expect(c.name).toBe("Bureaux — journée continue");
      // A Mon–Sat week of leave: 6 working days for the workshop, 5 for the offices
      const mon = new Date(2026, 0, 12);
      const sat = new Date(2026, 0, 17);
      expect(await countAbsenceDays({ companyId, employeeId: welder._id, type: "paid_leave", startDate: mon, endDate: sat })).toBe(6);
      expect(await countAbsenceDays({ companyId, employeeId: clerk._id, type: "paid_leave", startDate: mon, endDate: sat })).toBe(5);
    });
  });

  it("the default can change; the default can't be deleted; deleting sends departments back to the default", async () => {
    await request(app).delete(`/api/work-schedule/${defaultId}`).set(h()).expect(400);
    const d = await request(app).patch(`/api/work-schedule/${atelierId}/default`).set(h());
    expect(d.body.data.schedules.find((s) => s._id === atelierId).isDefault).toBe(true);
    await request(app).patch(`/api/work-schedule/${defaultId}/default`).set(h()).expect(200);
    const del = await request(app).delete(`/api/work-schedule/${atelierId}`).set(h());
    expect(del.status).toBe(200);
    expect(del.body.data.schedules).toHaveLength(1);
    expect(del.body.data.departments.find((x) => x.name === "Atelier").workSchedule).toBeNull();
    await tenantScope.runAsSystem(async () => {
      expect((await scheduleForEmployee(welder._id)).name).toBe("Bureaux — journée continue");
    });
  });
});
