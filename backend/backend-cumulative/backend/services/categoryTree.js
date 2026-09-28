const InventoryCategory = require("../models/InventoryCategory");

/**
 * ============================================================
 * INVENTORY CATEGORY TREE
 * ============================================================
 * Categories can have sub-categories ("Profilés aluminium" ›
 * "Série ATLAS 78 — coulissants" › …). Helpers shared by the category
 * and product routes.
 * ============================================================
 */
const MAX_DEPTH = 4;
const SEP = " › ";

/**
 * Every category of a company in tree order (parent, then its children
 * alphabetically), each with `fullName` ("A › B"), `depth` (0 = top),
 * `path` (ancestor ids, top first) and `childCount`.
 */
function arrangeTree(rows) {
  const byId = new Map(rows.map((c) => [String(c._id), c]));
  const children = new Map();
  for (const c of rows) {
    // A parent that no longer exists (or a loop) → treat as top-level.
    const pid = c.parent && byId.has(String(c.parent)) && String(c.parent) !== String(c._id) ? String(c.parent) : "";
    if (!children.has(pid)) children.set(pid, []);
    children.get(pid).push(c);
  }
  for (const list of children.values()) list.sort((a, b) => String(a.name).localeCompare(String(b.name), "fr"));
  const out = [];
  const seen = new Set();
  const walk = (pid, depth, path, names) => {
    for (const c of children.get(pid) || []) {
      const id = String(c._id);
      if (seen.has(id)) continue;
      seen.add(id);
      const fullNames = [...names, c.name];
      out.push({ ...c, depth, path, fullName: fullNames.join(SEP), childCount: (children.get(id) || []).length });
      walk(id, depth + 1, [...path, id], fullNames);
    }
  };
  walk("", 0, [], []);
  // Anything left (cycles) goes at the top level.
  for (const c of rows) if (!seen.has(String(c._id))) out.push({ ...c, depth: 0, path: [], fullName: c.name, childCount: 0 });
  return out;
}

async function loadTree(companyId) {
  const rows = await InventoryCategory.find({ company: companyId }).lean();
  return arrangeTree(rows);
}

/** The category and all its sub-categories (ids as strings). */
async function withDescendants(companyId, categoryId) {
  const tree = await loadTree(companyId);
  const id = String(categoryId);
  return tree.filter((c) => String(c._id) === id || c.path.includes(id)).map((c) => String(c._id));
}

/**
 * Accounting of each category, inherited from its parents when empty:
 * a "Série ATLAS 78" with no account uses "Profilés aluminium"'s 6121;
 * a parent flagged as fixed assets makes its sub-categories fixed assets.
 * Returns Map(id → { accountingAccount, isFixedAsset }).
 */
function effectiveAccounting(tree) {
  const byId = new Map(tree.map((c) => [String(c._id), c]));
  const out = new Map();
  for (const c of tree) {
    const chain = [c, ...[...(c.path || [])].reverse().map((id) => byId.get(id)).filter(Boolean)];
    const withAccount = chain.find((x) => String(x.accountingAccount || "").trim());
    out.set(String(c._id), {
      accountingAccount: withAccount ? String(withAccount.accountingAccount).trim() : "",
      isFixedAsset: chain.some((x) => x.isFixedAsset),
    });
  }
  return out;
}

module.exports = { arrangeTree, loadTree, withDescendants, effectiveAccounting, MAX_DEPTH, SEP };
