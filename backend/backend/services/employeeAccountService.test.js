import { describe, it, expect, vi, beforeEach } from "vitest";

const Department = require("../models/Department");
const { computeInheritedPermissions } = require("./employeeAccountService");

describe("computeInheritedPermissions", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("inherits department + hrRole from an HR department employee with a canonical title", async () => {
    vi.spyOn(Department, "findById").mockReturnValue({
      select: () => Promise.resolve({ permissionKey: "hr" }),
    });

    const result = await computeInheritedPermissions({ department: "hr-dept-id", jobTitle: "Directeur RH" });
    expect(result.department).toBe("hr");
    expect(result.hrRole).toBe("hr_director");
  });

  it("leaves hrRole unset for a non-canonical/legacy job title, without erroring", async () => {
    vi.spyOn(Department, "findById").mockReturnValue({
      select: () => Promise.resolve({ permissionKey: "hr" }),
    });

    const result = await computeInheritedPermissions({ department: "hr-dept-id", jobTitle: "Some Custom Legacy Title" });
    expect(result.department).toBe("hr");
    expect(result.hrRole).toBeUndefined();
  });

  it("never sets hrRole for a non-HR department, even if the job title text happens to match one of the 4 canonical titles", async () => {
    vi.spyOn(Department, "findById").mockReturnValue({
      select: () => Promise.resolve({ permissionKey: "production" }),
    });

    const result = await computeInheritedPermissions({ department: "prod-dept-id", jobTitle: "Directeur RH" });
    expect(result.department).toBe("production");
    expect(result.hrRole).toBeUndefined();
  });

  it("works with a populated department ref object, not just a plain ID", async () => {
    vi.spyOn(Department, "findById").mockReturnValue({
      select: () => Promise.resolve({ permissionKey: "hr" }),
    });

    const result = await computeInheritedPermissions({ department: { _id: "hr-dept-id" }, jobTitle: "Responsable RH" });
    expect(result.department).toBe("hr");
    expect(result.hrRole).toBe("hr_manager");
  });

  it("returns no department/hrRole when the employee has no department set", async () => {
    const result = await computeInheritedPermissions({ department: null, jobTitle: "Anything" });
    expect(result.department).toBeUndefined();
    expect(result.hrRole).toBeUndefined();
  });
});
