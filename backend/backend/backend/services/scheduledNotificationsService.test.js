import { describe, it, expect, vi, beforeEach } from "vitest";

const Contract = require("../models/Contract");
const EmployeeDocument = require("../models/EmployeeDocument");

// scheduledNotificationsService.js destructures notifyMany/
// getHRRecipientIds at require-time, so mocking the
// notificationService MODULE's exported properties after the fact
// (vi.spyOn, or even vi.mock in this CommonJS require() context)
// doesn't reach the local references it already captured. Replacing
// the module in Node's own require cache BEFORE
// scheduledNotificationsService.js is first required is what
// actually works here — the same technique used successfully
// elsewhere in this backend's tests for mocking middleware/auth.js.
const notificationServicePath = require.resolve("./notificationService");
const fakeNotifyMany = vi.fn();
const fakeGetHRRecipientIds = vi.fn();
require.cache[notificationServicePath] = {
  id: notificationServicePath,
  filename: notificationServicePath,
  loaded: true,
  exports: { notifyMany: fakeNotifyMany, getHRRecipientIds: fakeGetHRRecipientIds },
};

const { checkExpiringContracts, checkExpiringDocuments } = require("./scheduledNotificationsService");

describe("scheduledNotificationsService", () => {
  const fakeCompany = { _id: "c1", owner: "owner1" };
  const fakeEmployee = { firstName: "Yassine", lastName: "El Amrani" };

  beforeEach(() => {
    fakeNotifyMany.mockReset().mockResolvedValue();
    fakeGetHRRecipientIds.mockReset().mockResolvedValue(["hr1", "hr2"]);
  });

  it("notifies HR about a contract expiring within the window, and marks it notified", async () => {
    const save = vi.fn();
    const fixedNow = new Date("2026-01-01T00:00:00Z");
    vi.spyOn(Contract, "find").mockReturnValue({
      populate: () => ({
        populate: () =>
          Promise.resolve([
            {
              employee: fakeEmployee,
              company: fakeCompany,
              endDate: new Date("2026-01-11T00:00:00Z"), // exactly 10 days after fixedNow
              expiryNotifiedAt: null,
              save,
            },
          ]),
      }),
    });

    const count = await checkExpiringContracts(fixedNow);
    expect(count).toBe(1);
    expect(save).toHaveBeenCalled();

    const [, payload] = fakeNotifyMany.mock.calls[0];
    expect(payload.type).toBe("contract_expiring");
    expect(payload.message).toContain("Yassine El Amrani");
    expect(payload.message).toContain("10 day");
  });

  it("only queries contracts that have not already been notified (query filter check)", async () => {
    const findSpy = vi.spyOn(Contract, "find").mockReturnValue({
      populate: () => ({ populate: () => Promise.resolve([]) }),
    });

    await checkExpiringContracts();

    const filterArg = findSpy.mock.calls[0][0];
    expect(filterArg.status).toBe("active");
    expect(filterArg.expiryNotifiedAt).toBeNull();
  });

  it("notifies HR about an expiring employee document with its label in the message", async () => {
    const save = vi.fn();
    const fixedNow = new Date("2026-01-01T00:00:00Z");
    vi.spyOn(EmployeeDocument, "find").mockReturnValue({
      populate: () => ({
        populate: () =>
          Promise.resolve([
            {
              employee: fakeEmployee,
              company: fakeCompany,
              expiryDate: new Date("2026-01-06T00:00:00Z"), // exactly 5 days after fixedNow
              label: "Carte CIN",
              expiryNotifiedAt: null,
              save,
            },
          ]),
      }),
    });

    const count = await checkExpiringDocuments(fixedNow);
    expect(count).toBe(1);
    expect(save).toHaveBeenCalled();

    const [, payload] = fakeNotifyMany.mock.calls[0];
    expect(payload.type).toBe("document_expiring");
    expect(payload.message).toContain("Carte CIN");
  });

  it("skips a contract/document with no company populated, without throwing", async () => {
    vi.spyOn(Contract, "find").mockReturnValue({
      populate: () => ({
        populate: () =>
          Promise.resolve([{ employee: fakeEmployee, company: null, endDate: new Date(), expiryNotifiedAt: null, save: vi.fn() }]),
      }),
    });

    const count = await checkExpiringContracts();
    expect(count).toBe(0);
  });
});
