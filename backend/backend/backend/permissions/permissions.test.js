import { describe, it, expect } from "vitest";

const {
  canApproveHRRequests,
  canManageEmployeeRecords,
  canManageSalaries,
  canDeleteEmployee,
  canManageHRStaffRoles,
  canReviewRequest,
} = require("./permissions");

describe("HR role hierarchy", () => {
  const admin = { role: "admin" };
  const owner = { role: "owner", id: "u1" };
  const director = { department: "hr", hrRole: "hr_director" };
  const manager = { department: "hr", hrRole: "hr_manager" };
  const officer = { department: "hr", hrRole: "hr_officer" };
  const assistant = { department: "hr", hrRole: "hr_assistant" };
  const legacyHR = { department: "hr" }; // pre-existing account, no hrRole set
  const salesUser = { department: "sales" };

  describe("canApproveHRRequests (Responsable RH and above)", () => {
    it("allows admin, director, and manager", () => {
      expect(canApproveHRRequests(admin)).toBe(true);
      expect(canApproveHRRequests(director)).toBe(true);
      expect(canApproveHRRequests(manager)).toBe(true);
    });

    it("denies officer and assistant tiers", () => {
      expect(canApproveHRRequests(officer)).toBe(false);
      expect(canApproveHRRequests(assistant)).toBe(false);
    });

    it("grandfathers in pre-existing HR accounts with no hrRole set (no regression)", () => {
      expect(canApproveHRRequests(legacyHR)).toBe(true);
    });

    it("denies non-HR department users entirely", () => {
      expect(canApproveHRRequests(salesUser)).toBe(false);
    });
  });

  describe("canManageEmployeeRecords (Chargé RH and above)", () => {
    it("allows officer tier and above", () => {
      expect(canManageEmployeeRecords(officer)).toBe(true);
      expect(canManageEmployeeRecords(manager)).toBe(true);
    });

    it("denies assistant tier", () => {
      expect(canManageEmployeeRecords(assistant)).toBe(false);
    });
  });

  describe("canManageSalaries / canDeleteEmployee (Responsable RH and above)", () => {
    it("allows manager tier, denies officer tier", () => {
      expect(canManageSalaries(manager)).toBe(true);
      expect(canManageSalaries(officer)).toBe(false);
      expect(canDeleteEmployee(manager)).toBe(true);
      expect(canDeleteEmployee(officer)).toBe(false);
    });
  });

  describe("canManageHRStaffRoles (Directeur RH only)", () => {
    it("allows only director (plus admin/owner)", () => {
      expect(canManageHRStaffRoles(director)).toBe(true);
      expect(canManageHRStaffRoles(manager)).toBe(false);
    });
  });

  describe("canReviewRequest (HR-tier OR the requester's own line manager)", () => {
    it("allows a manager-tier+ HR staffer regardless of company ownership", () => {
      expect(canReviewRequest(manager, { owner: "someone-else" }, {})).toBe(true);
    });

    it("allows a line manager to review their own direct report's request, independent of HR tier", () => {
      const lineManagerUser = { employee: "emp-lead-1" }; // not even in the HR department
      const requestingEmployee = { manager: "emp-lead-1" };
      expect(canReviewRequest(lineManagerUser, { owner: "x" }, requestingEmployee)).toBe(true);
    });

    it("denies an unrelated self-service user", () => {
      const unrelatedUser = { employee: "someone-else" };
      const requestingEmployee = { manager: "emp-lead-1" };
      expect(canReviewRequest(unrelatedUser, { owner: "x" }, requestingEmployee)).toBe(false);
    });
  });
});
