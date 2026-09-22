import { describe, it, expect } from "vitest";
import { buildJobTitleOptionsForDepartment, HR_JOB_TITLES } from "./hrJobTitles.js";

const fakeT = (key) =>
  ({
    "users.hrRole.assistant": "Assistant(e) RH",
    "users.hrRole.officer": "Chargé(e) RH",
    "users.hrRole.manager": "Responsable RH",
    "users.hrRole.director": "Directeur/Directrice RH",
  }[key] || key);

describe("buildJobTitleOptionsForDepartment", () => {
  it("returns null for no category (free-text fallback)", () => {
    expect(buildJobTitleOptionsForDepartment(fakeT, null, "")).toBeNull();
    expect(buildJobTitleOptionsForDepartment(fakeT, undefined, "")).toBeNull();
  });

  it("returns the 4 HR titles with translated labels for the hr category", () => {
    const options = buildJobTitleOptionsForDepartment(fakeT, "hr", "");
    expect(options.length).toBe(4);
    expect(options.map((o) => o.value)).toEqual(HR_JOB_TITLES);
    expect(options[0].label).toBe("Assistant(e) RH");
  });

  it("returns titles for a non-HR category (e.g. sales)", () => {
    const options = buildJobTitleOptionsForDepartment(fakeT, "sales", "");
    expect(options.some((o) => o.value === "Directeur Commercial")).toBe(true);
  });

  it("returns titles for another non-HR category (e.g. it)", () => {
    const options = buildJobTitleOptionsForDepartment(fakeT, "it", "");
    expect(options.some((o) => o.value === "Développeur(se)")).toBe(true);
  });

  it("appends a legacy/custom current value as an extra option instead of losing it", () => {
    const options = buildJobTitleOptionsForDepartment(fakeT, "sales", "Ancien Titre Personnalisé");
    expect(options.length).toBe(5);
    expect(options[4]).toEqual({ value: "Ancien Titre Personnalisé", label: "Ancien Titre Personnalisé" });
  });

  it("does not duplicate the current value when it's already one of the canonical titles", () => {
    const options = buildJobTitleOptionsForDepartment(fakeT, "hr", "Responsable RH");
    expect(options.length).toBe(4);
  });

  it("returns null for an unrecognized category", () => {
    expect(buildJobTitleOptionsForDepartment(fakeT, "not_a_real_category", "")).toBeNull();
  });
});
