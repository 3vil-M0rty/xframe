const { has } = require("../services/permissionService");
const { KEY_SET } = require("../config/permissionCatalog");

/**
 * ============================================================
 * PERMISSION GUARD — one table per router
 * ============================================================
 * Each router declares which permission every one of its endpoints
 * needs, in a single readable table:
 *
 *   router.use(auth, guard([
 *     ["GET /", "sales.quotes.view"],
 *     ["POST /:id/status", "sales.quotes.decide"],
 *     ["PATCH /:id/review", null],          // decided in the handler
 *     ["GET /mine", null],                  // self-service
 *     ["POST /", ["a.b.c", "d.e.f"]],       // any of these
 *   ]));
 *
 * Entries are matched in order (put "/expiring" before "/:id").
 * `null` = no extra permission (self-service, manager approvals or
 * checks that depend on the record, done in the handler). A test
 * (routes/permissionGuard.coverage.test.js) makes sure every route of
 * every router has an entry, so nothing new slips through unguarded.
 * ============================================================
 */
function compile(pattern) {
  const [method, path] = pattern.trim().split(/\s+/);
  const src = path
    .replace(/\/$/, "")
    .split("/")
    .map((seg) => (seg.startsWith(":") ? "[^/]+" : seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
    .join("/");
  return { method: method.toUpperCase(), re: new RegExp(`^${src || ""}/?$`), pattern };
}

function guard(table) {
  const entries = table.map(([pattern, perm]) => {
    const keys = perm === null ? null : Array.isArray(perm) ? perm : [perm];
    for (const k of keys || []) if (!KEY_SET.has(k)) throw new Error(`permissionGuard: unknown permission "${k}" (${pattern})`);
    return { ...compile(pattern), keys };
  });
  const mw = (req, res, next) => {
    const method = req.method === "HEAD" ? "GET" : req.method;
    const entry = entries.find((e) => e.method === method && e.re.test(req.path));
    if (!entry || entry.keys === null) return next();
    if (!req.user) return res.status(401).json({ success: false, message: "Not authenticated" });
    if (entry.keys.some((k) => has(req.user, k))) return next();
    return res.status(403).json({
      success: false,
      message: "You don't have the permission for this action",
      permission: entry.keys[0],
    });
  };
  mw.entries = entries;
  mw.find = (method, path) => entries.find((e) => e.method === method.toUpperCase() && e.re.test(path));
  return mw;
}

module.exports = { guard, compile };
