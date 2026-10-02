import { describe, it, expect, vi, afterEach } from "vitest";

const fake = require("../test/fakeMongo");
const Company = require("../models/Company");
fake.connect(); // other models' collections answer with just the _id index
const { dropStaleIndexes } = require("./syncEmployeeIndexes");

afterEach(() => vi.restoreAllMocks());

describe("dropStaleIndexes", () => {
  it("REGRESSION: drops the old unique companies.slug index (second company failed with E11000 slug: null), keeps real ones", async () => {
    vi.spyOn(Company.collection, "indexes").mockResolvedValue([
      { name: "_id_", key: { _id: 1 } },
      { name: "slug_1", key: { slug: 1 }, unique: true },
      { name: "ice_1", key: { ice: 1 }, unique: true, sparse: true },
      { name: "tenant_1", key: { tenant: 1 } },
      { name: "address.city_1", key: { "address.city": 1 } },
    ]);
    const dropped = vi.spyOn(Company.collection, "dropIndex").mockResolvedValue({});
    vi.spyOn(console, "log").mockImplementation(() => {});
    await dropStaleIndexes();
    const names = dropped.mock.calls.map((c) => c[0]);
    expect(names).toContain("slug_1");
    expect(names).not.toContain("ice_1");
    expect(names).not.toContain("tenant_1");
    expect(names).not.toContain("address.city_1");
  });
});
