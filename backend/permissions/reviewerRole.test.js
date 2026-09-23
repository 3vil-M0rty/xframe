import { describe, it, expect } from "vitest";

const { reviewerRole } = require("../permissions/permissions");

describe("reviewerRole (sequential approval capacity check)", () => {
  const company = { owner: "owner1" };
  const requestingEmployee = { manager: "mgrEmp1" };

  it("admin and the real owner act with hr capacity", () => {
    expect(reviewerRole({ role: "admin" }, company, requestingEmployee)).toBe("hr");
    expect(reviewerRole({ role: "owner", id: "owner1" }, company, requestingEmployee)).toBe("hr");
  });

  it("an unrelated owner (not this company's) gets no capacity", () => {
    expect(reviewerRole({ role: "owner", id: "someoneElse" }, company, requestingEmployee)).toBeNull();
  });

  it("Responsable-RH-tier-and-above acts with hr capacity; below that tier gets none", () => {
    expect(reviewerRole({ department: "hr", hrRole: "hr_manager" }, company, requestingEmployee)).toBe("hr");
    expect(reviewerRole({ department: "hr", hrRole: "hr_assistant" }, company, requestingEmployee)).toBeNull();
  });

  it("the actual line manager acts with manager capacity; an unrelated employee gets none", () => {
    expect(reviewerRole({ employee: "mgrEmp1" }, company, requestingEmployee)).toBe("manager");
    expect(reviewerRole({ employee: "someoneElse" }, company, requestingEmployee)).toBeNull();
  });

  it("no manager on the request at all -> no manager capacity for anyone", () => {
    expect(reviewerRole({ employee: "mgrEmp1" }, company, { manager: null })).toBeNull();
  });

  it("someone who is both HR-tier and the line manager gets hr capacity (stronger authority wins)", () => {
    expect(reviewerRole({ department: "hr", hrRole: "hr_manager", employee: "mgrEmp1" }, company, requestingEmployee)).toBe("hr");
  });
});
