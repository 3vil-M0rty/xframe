import { describe, it, expect, vi, beforeEach } from "vitest";

const Department = require("../models/Department");
const JobPosition = require("../models/JobPosition");
const { computeInheritedPermissions } = require("./employeeAccountService");

function mockDepartment(permissionKey) {
  vi.spyOn(Department, "findById").mockReturnValue({ select: () => Promise.resolve({ permissionKey }) });
}
function mockPosition(position) {
  vi.spyOn(JobPosition, "findOne").mockReturnValue({ select: () => Promise.resolve(position) });
}

describe("computeInheritedPermissions — module access follows the POSITION, not just the department", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("REGRESSION: a plain employee in Production (e.g. Machine Operator) gets NO module access — My Space only", async () => {
    // Bug history: any employee in a department with a permissionKey
    // inherited the whole module, so a machine operator saw
    // Inventory simply for being in Production.
    mockDepartment("production");
    mockPosition({ grantsModuleAccess: false });
    const result = await computeInheritedPermissions({ department: "d1", jobTitle: "Machine Operator" });
    expect(result.department).toBeUndefined();
    expect(result.hrRole).toBeUndefined();
  });

  it("an employee whose title has no matching position at all also gets no module access", async () => {
    mockDepartment("production");
    mockPosition(null);
    const result = await computeInheritedPermissions({ department: "d1", jobTitle: "Something Unlisted" });
    expect(result.department).toBeUndefined();
  });

  it("a position flagged grantsModuleAccess (e.g. Responsable de Production) unlocks the module", async () => {
    mockDepartment("production");
    mockPosition({ grantsModuleAccess: true });
    const result = await computeInheritedPermissions({ department: "d1", jobTitle: "Responsable de Production" });
    expect(result.department).toBe("production");
    expect(result.hrRole).toBeUndefined();
  });

  it("the 4 canonical HR titles always grant HR access with their exact tier, flag or not", async () => {
    mockDepartment("hr");
    mockPosition(null);
    const result = await computeInheritedPermissions({ department: "d1", jobTitle: "Directeur RH" });
    expect(result.department).toBe("hr");
    expect(result.hrRole).toBe("hr_director");
  });

  it("a flag-granted HR position with a custom title gets the LOWEST tier (least privilege), not full access", async () => {
    mockDepartment("hr");
    mockPosition({ grantsModuleAccess: true });
    const result = await computeInheritedPermissions({ department: "d1", jobTitle: "Gestionnaire Paie" });
    expect(result.department).toBe("hr");
    expect(result.hrRole).toBe("hr_assistant");
  });

  it("a non-canonical, unflagged title in HR gets no HR access", async () => {
    mockDepartment("hr");
    mockPosition({ grantsModuleAccess: false });
    const result = await computeInheritedPermissions({ department: "d1", jobTitle: "Stagiaire" });
    expect(result.department).toBeUndefined();
  });

  it("a department with no permissionKey never grants a module, even with the flag set", async () => {
    mockDepartment(null);
    mockPosition({ grantsModuleAccess: true });
    const result = await computeInheritedPermissions({ department: "d1", jobTitle: "Commercial" });
    expect(result.department).toBeUndefined();
  });

  it("no department or no job title -> no module access", async () => {
    expect((await computeInheritedPermissions({ department: null, jobTitle: "X" })).department).toBeUndefined();
    expect((await computeInheritedPermissions({ department: "d1", jobTitle: "" })).department).toBeUndefined();
  });
});
