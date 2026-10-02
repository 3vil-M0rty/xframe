import { describe, it, expect } from "vitest";

/**
 * Every endpoint of every guarded router must have a line in
 * config/routePermissions.js — a new route without one fails here.
 */
const { ROUTE_PERMISSIONS } = require("../config/routePermissions");
const { guard } = require("../middleware/permissionGuard");

const sample = (path) => path.replace(/:[A-Za-z]+/g, "x");

describe("route permission tables", () => {
  for (const name of Object.keys(ROUTE_PERMISSIONS)) {
    it(`${name}: every route has a permission line`, () => {
      const router = require(`./${name}`);
      const g = guard(ROUTE_PERMISSIONS[name]);
      const missing = [];
      for (const layer of router.stack) {
        if (!layer.route) continue;
        for (const method of Object.keys(layer.route.methods)) {
          if (!g.find(method, sample(layer.route.path))) missing.push(`${method.toUpperCase()} ${layer.route.path}`);
        }
      }
      expect(missing).toEqual([]);
    });
  }

  it("each line points at the right route (no literal path shadowed by /:id)", () => {
    for (const [name, table] of Object.entries(ROUTE_PERMISSIONS)) {
      const g = guard(table);
      for (const [pattern] of table) {
        const [method, path] = pattern.split(" ");
        expect(g.find(method, sample(path)).pattern, `${name}: ${pattern}`).toBe(pattern);
      }
    }
  });
});
