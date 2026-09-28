const { canSeeFinancials } = require("../permissions/permissions");

/**
 * ============================================================
 * HIDE AMOUNTS FROM PEOPLE WHO DON'T SEE MONEY
 * ============================================================
 * Production, workshop staff and logistics run the chassis without
 * seeing sale prices, project revenue / costs / margins, budgets, cost
 * prices or pricing rules (permissions: canSeeFinancials).
 *
 * hideMoney(keys, transform?) — on the way OUT: every `data` sent by the
 *   router loses those keys at any depth (after an optional transform).
 * dropMoneyInput(keys) — on the way IN: the same people can't change
 *   them (their screens don't have the values, so a form sending 0 must
 *   not wipe an hourly rate or a model's pricing).
 *
 * Mount both right after `auth` in a router.
 * ============================================================
 */
function stripKeys(value, keys) {
  if (Array.isArray(value)) return value.map((v) => stripKeys(v, keys));
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) if (!keys.has(k)) out[k] = stripKeys(v, keys);
    return out;
  }
  return value;
}

function hideMoney(keys, transform = null) {
  const set = new Set(keys);
  return (req, res, next) => {
    if (canSeeFinancials(req.user)) return next();
    const json = res.json.bind(res);
    res.json = (body) => {
      if (!body || typeof body !== "object" || body.data === undefined || body.data === null) return json(body);
      // Plain JSON first (mongoose documents, ObjectIds, dates) — exactly what would be sent anyway.
      let data = JSON.parse(JSON.stringify(body.data));
      if (transform) data = transform(data, req);
      return json({ ...body, data: stripKeys(data, set), amountsHidden: true });
    };
    next();
  };
}

function dropMoneyInput(keys) {
  return (req, res, next) => {
    if (!canSeeFinancials(req.user) && req.body && typeof req.body === "object") {
      for (const k of keys) delete req.body[k];
    }
    next();
  };
}

module.exports = { hideMoney, dropMoneyInput, stripKeys };
