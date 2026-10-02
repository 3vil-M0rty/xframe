import { describe, it, expect, vi, beforeEach } from "vitest";

const request = require("supertest");
const express = require("express");

const authPath = require.resolve("../middleware/auth");
let currentUser = null;
require.cache[authPath] = {
  id: authPath,
  filename: authPath,
  loaded: true,
  exports: (req, res, next) => {
    req.user = currentUser;
    next();
  },
};

const Absence = require("../models/Absence");
const User = require("../models/User");

// routes/absences.js destructures notify/notifyMany/getHRRecipientIds
// at require-time, so a plain vi.spyOn on the notificationService
// module's exports never reaches the route's already-captured local
// references — the same gotcha documented and fixed the same way in
// services/scheduledNotificationsService.test.js. Replacing the
// module in Node's require cache BEFORE routes/absences.js is first
// required is what actually works here.
const notificationServicePath = require.resolve("../services/notificationService");
const fakeNotify = vi.fn();
const fakeNotifyMany = vi.fn();
const fakeGetHRRecipientIds = vi.fn();
require.cache[notificationServicePath] = {
  id: notificationServicePath,
  filename: notificationServicePath,
  loaded: true,
  exports: { notify: fakeNotify, notifyMany: fakeNotifyMany, getHRRecipientIds: fakeGetHRRecipientIds },
};

const router = require("../routes/absences");

const MGR_EMPLOYEE_ID = "507f1f77bcf86cd799439040";

function makeAbsence(id, employeeManager, sequential) {
  return {
    _id: id,
    status: "pending",
    company: { _id: "c1", owner: "owner1", settings: { requireSequentialApproval: sequential } },
    employee: { firstName: "Test", lastName: "Employee", manager: employeeManager },
    toObject() { return { ...this }; },
    async save() {},
    async populate() { return this; },
  };
}

describe("PATCH /absences/:id/review — sequential approval state machine", () => {
  let absencesById;

  beforeEach(() => {
    vi.restoreAllMocks();
    absencesById = {};
    vi.spyOn(Absence, "findById").mockImplementation((id) => ({
      populate() { return this; },
      then(resolve) { resolve(absencesById[id] || null); },
    }));
    vi.spyOn(User, "findOne").mockReturnValue({ select: () => Promise.resolve(null) });
    fakeNotify.mockReset().mockResolvedValue();
    fakeNotifyMany.mockReset().mockResolvedValue();
    fakeGetHRRecipientIds.mockReset().mockResolvedValue(["hr1"]);
  });

  function callAs(user, id, body) {
    currentUser = user;
    const app = express();
    app.use(express.json());
    app.use("/api/absences", router);
    return request(app).patch(`/api/absences/${id}/review`).send(body);
  }

  it("REGRESSION: sequential mode blocks HR from approving before the manager has", async () => {
    const id = "507f1f77bcf86cd799439051";
    absencesById[id] = makeAbsence(id, MGR_EMPLOYEE_ID, true);

    const res = await callAs({ id: "hrUser", role: "user", department: "hr", hrRole: "hr_manager" }, id, { status: "accepted" });
    expect(res.status).toBe(400);
    expect(absencesById[id].status).toBe("pending");
  });

  it("the manager's approval moves the request to manager_approved, not straight to accepted", async () => {
    const id = "507f1f77bcf86cd799439052";
    absencesById[id] = makeAbsence(id, MGR_EMPLOYEE_ID, true);

    const res = await callAs({ employee: MGR_EMPLOYEE_ID, role: "user" }, id, { status: "accepted" });
    expect(res.status).toBe(200);
    expect(absencesById[id].status).toBe("manager_approved");

    // HR gets a bell notification that it's their turn — and the
    // employee is NOT told anything yet (it isn't a final decision).
    expect(fakeNotifyMany).toHaveBeenCalledTimes(1);
    expect(fakeNotifyMany.mock.calls[0][0]).toEqual(["hr1"]);
    expect(fakeNotifyMany.mock.calls[0][1].type).toBe("absence_pending");
    expect(fakeNotify).not.toHaveBeenCalled();
  });

  it("the manager cannot act a second time once already manager_approved", async () => {
    const id = "507f1f77bcf86cd799439053";
    absencesById[id] = { ...makeAbsence(id, MGR_EMPLOYEE_ID, true), status: "manager_approved" };

    const res = await callAs({ employee: MGR_EMPLOYEE_ID, role: "user" }, id, { status: "accepted" });
    expect(res.status).toBe(400);
  });

  it("HR gives the final approval after the manager has already approved", async () => {
    const id = "507f1f77bcf86cd799439054";
    absencesById[id] = { ...makeAbsence(id, MGR_EMPLOYEE_ID, true), status: "manager_approved" };

    const res = await callAs({ id: "hrUser", role: "user", department: "hr", hrRole: "hr_manager" }, id, { status: "accepted" });
    expect(res.status).toBe(200);
    expect(absencesById[id].status).toBe("accepted");
  });

  it("rejection always short-circuits the chain, even from a still-pending request", async () => {
    const id = "507f1f77bcf86cd799439055";
    absencesById[id] = makeAbsence(id, MGR_EMPLOYEE_ID, true);

    const res = await callAs({ id: "hrUser", role: "user", department: "hr", hrRole: "hr_manager" }, id, { status: "rejected" });
    expect(res.status).toBe(200);
    expect(absencesById[id].status).toBe("rejected");
  });

  it("REGRESSION: an employee with no manager on file is not stuck unreviewable in sequential mode", async () => {
    const id = "507f1f77bcf86cd799439056";
    absencesById[id] = makeAbsence(id, null, true);

    const res = await callAs({ id: "hrUser", role: "user", department: "hr", hrRole: "hr_manager" }, id, { status: "accepted" });
    expect(res.status).toBe(200);
    expect(absencesById[id].status).toBe("accepted");
  });

  it("sequential mode off preserves the original single-step behavior exactly", async () => {
    const id = "507f1f77bcf86cd799439057";
    absencesById[id] = makeAbsence(id, MGR_EMPLOYEE_ID, false);

    const res = await callAs({ employee: MGR_EMPLOYEE_ID, role: "user" }, id, { status: "accepted" });
    expect(res.status).toBe(200);
    expect(absencesById[id].status).toBe("accepted");
  });
});
