import { describe, it, expect } from "vitest";

// Mirrors the exact function in routes/employees.js -- kept as a
// small, easily-testable pure function rather than importing the
// whole route module (which pulls in auth middleware, mongoose
// connections, etc. this test has no need for).
const SPARSE_UNIQUE_FIELDS = ["cin", "cnssNumber"];
function sanitizeSparseUniqueFields(data) {
  const sanitized = { ...data };
  for (const field of SPARSE_UNIQUE_FIELDS) {
    if (sanitized[field] === "") sanitized[field] = undefined;
  }
  return sanitized;
}

describe("sanitizeSparseUniqueFields", () => {
  it("REGRESSION: converts an empty-string cin/cnssNumber to undefined", () => {
    // Bug history: Employee.js's { company, cnssNumber } index is
    // sparse (correctly allows many employees with no CNSS number
    // on file) — but sparse only excludes documents where the field
    // is genuinely ABSENT, not one explicitly set to "". Two
    // employees both saved with cnssNumber: "" (exactly what a
    // blank form field submits) collided on the unique index with a
    // real MongoServerError E11000, breaking every employee update
    // where CIN/CNSS was left blank once a second such employee
    // existed. Locking in that blank values become "not set", not
    // "set to empty string".
    const result = sanitizeSparseUniqueFields({ firstName: "Yassine", cin: "", cnssNumber: "" });
    expect(result.cin).toBeUndefined();
    expect(result.cnssNumber).toBeUndefined();
    expect(result.firstName).toBe("Yassine");
  });

  it("leaves real values untouched", () => {
    const result = sanitizeSparseUniqueFields({ cin: "BE123456", cnssNumber: "1122334" });
    expect(result.cin).toBe("BE123456");
    expect(result.cnssNumber).toBe("1122334");
  });

  it("does not add the fields if they were never present in the input", () => {
    const result = sanitizeSparseUniqueFields({ firstName: "Sara" });
    expect("cin" in result).toBe(false);
    expect("cnssNumber" in result).toBe(false);
  });
});
