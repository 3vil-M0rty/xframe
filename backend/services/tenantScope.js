const { AsyncLocalStorage } = require("async_hooks");
const mongoose = require("mongoose");

/**
 * ============================================================
 * TENANT SCOPE — client data isolation
 * ============================================================
 * One database is shared by every client (tenant). Each client owns
 * one or more companies; every business record carries `company`,
 * and Company/User (plus AuditLog/EmailOutbox) carry `tenant`.
 *
 * Instead of trusting every route to remember "and only this
 * client's companies", the rule is enforced HERE, once, for every
 * Mongoose query:
 *
 *   - An AsyncLocalStorage context follows each request from the
 *     auth middleware to the last database call it triggers.
 *   - A global Mongoose plugin adds the client's filter to every
 *     find / count / update / delete / aggregate:
 *         schemas with a `tenant` path  → { tenant: <client> }
 *         schemas with a `company` path → { company: { $in: <client's companies> } }
 *     so a request from client A asking for client B's record by id
 *     simply gets "not found".
 *   - Saving a record into a company that isn't the client's is
 *     refused, and moving a record to another company/client via an
 *     update is refused.
 *
 * Context kinds:
 *   tenant   — a normal logged-in user. Scoped as above.
 *   platform — the platform operator (role platform_admin). Sees NO
 *              client business data by default; platform routes opt
 *              in explicitly with runAsSystem().
 *   system   — scheduled jobs, startup tasks, pre-login routes
 *              (login, 2FA). No restriction.
 *   (none)   — scripts and tests: no restriction. In the running
 *              server (strict mode) a query with NO context is a
 *              bug — it throws instead of silently seeing everything.
 *
 * Escape hatch for one query: .setOptions({ skipTenantScope: true })
 * (used e.g. for "is this email already taken anywhere" checks,
 * since emails are unique across the whole platform).
 *
 * THIS FILE MUST BE REQUIRED BEFORE ANY MODEL IS LOADED — the plugin
 * only applies to schemas compiled after it is registered. server.js
 * requires it first; assertAllModelsScoped() fails the boot if a
 * model slipped through.
 * ============================================================
 */

const als = new AsyncLocalStorage();
const CTX_KEY = Symbol.for("frame.tenantContext");
// Matches no document — what a platform context gets on client data.
const NONE = new mongoose.Types.ObjectId("000000000000000000000000");

let strictMode = false;

function toId(v) {
  if (!v) return null;
  if (v instanceof mongoose.Types.ObjectId) return v;
  if (v._id) return toId(v._id);
  return new mongoose.Types.ObjectId(String(v));
}

function tenantContext({ tenantId, companyIds = [], userId = null }) {
  return {
    kind: "tenant",
    tenantId: toId(tenantId),
    // Mutable on purpose: a company created during the request is
    // added (see the Company post-save hook below) so the same
    // request can immediately create that company's departments.
    companyIds: companyIds.map(toId),
    userId,
  };
}

const SYSTEM = Object.freeze({ kind: "system" });
const PLATFORM = Object.freeze({ kind: "platform" });

/**
 * Runs fn inside a context. A Mongoose Query is LAZY — it only runs
 * when someone calls .then()/.exec(). `runAsSystem(() => Model.find())`
 * would otherwise hand back an unexecuted query that the caller then
 * awaits OUTSIDE the context. Starting any returned thenable here
 * guarantees it executes inside.
 */
function run(ctx, fn) {
  return als.run(ctx, () => {
    const result = fn();
    if (result && typeof result.then === "function" && !(result instanceof Promise)) {
      return result.then((v) => v);
    }
    return result;
  });
}
function runInTenant(ctxInput, fn) {
  const ctx = ctxInput.kind === "tenant" ? ctxInput : tenantContext(ctxInput);
  return run(ctx, fn);
}
function runAsSystem(fn) {
  return run(SYSTEM, fn);
}
function runAsPlatform(fn) {
  return run(PLATFORM, fn);
}
function current() {
  return als.getStore() || null;
}
function enableStrictMode(on = true) {
  strictMode = on;
}

/**
 * Binds a context to an Express request, and runs `next` inside it.
 * The context is also kept on the request so it can be restored if
 * a callback-based middleware (multer/busboy) resumes the chain from
 * an event emitter, where AsyncLocalStorage would otherwise be lost
 * (see the Express Layer patch at the bottom of this file).
 */
function bindRequest(req, ctx, next) {
  req[CTX_KEY] = ctx;
  return als.run(ctx, () => next());
}

function tenantError(status, message) {
  const err = new Error(message);
  err.status = status;
  err.tenantScope = true;
  return err;
}

function missingContext(what) {
  return tenantError(
    500,
    `Tenant context missing for ${what} — the request lost its client context (see services/tenantScope.js)`
  );
}

function scopeMode(schema) {
  if (schema.path("tenant")) return "tenant";
  if (schema.path("company")) return "company";
  return null;
}

/** The filter a context must see for a given schema, or null for "no restriction". */
function filterFor(schema, ctx, what) {
  const mode = scopeMode(schema);
  if (!mode) return null;
  if (!ctx) {
    if (strictMode) throw missingContext(what);
    return null;
  }
  if (ctx.kind === "system") return null;
  if (ctx.kind === "platform") {
    // Platform staff see only platform-level records (their own
    // accounts, tenant: null) and no company data at all.
    return mode === "tenant" ? { tenant: null } : { company: NONE };
  }
  if (ctx.kind === "tenant") {
    return mode === "tenant"
      ? { tenant: ctx.tenantId || NONE }
      : { company: { $in: ctx.companyIds } };
  }
  return null;
}

function idIn(id, list) {
  if (!id) return false;
  const s = String(id._id || id);
  return list.some((c) => String(c) === s);
}

function checkDocOwnership(doc, schema, ctx) {
  if (!ctx) {
    if (strictMode) throw missingContext(`saving ${doc.constructor.modelName}`);
    return;
  }
  if (ctx.kind === "system") return;
  if (ctx.kind === "platform") {
    throw tenantError(403, "Platform accounts cannot write client data");
  }
  const mode = scopeMode(schema);
  if (mode === "tenant") {
    if (!doc.tenant) doc.tenant = ctx.tenantId;
    else if (String(doc.tenant._id || doc.tenant) !== String(ctx.tenantId)) {
      throw tenantError(404, "Not found");
    }
  }
  if (schema.path("company") && doc.company) {
    if (!idIn(doc.company, ctx.companyIds)) throw tenantError(404, "Company not found");
  }
}

function checkUpdate(update, schema, ctx) {
  if (!update || !ctx || ctx.kind !== "tenant") return;
  const parts = [update, update.$set, update.$setOnInsert].filter(Boolean);
  for (const part of parts) {
    if (schema.path("company") && part.company !== undefined && part.company !== null) {
      if (!idIn(part.company, ctx.companyIds)) throw tenantError(404, "Company not found");
    }
    if (schema.path("tenant") && part.tenant !== undefined) {
      if (String(part.tenant) !== String(ctx.tenantId)) throw tenantError(404, "Not found");
    }
  }
  if (update.$unset && (update.$unset.company !== undefined || update.$unset.tenant !== undefined)) {
    throw tenantError(400, "Cannot detach a record from its client");
  }
}

const QUERY_OPS = [
  "count",
  "countDocuments",
  "distinct",
  "find",
  "findOne",
  "findOneAndDelete",
  "findOneAndRemove",
  "findOneAndReplace",
  "findOneAndUpdate",
  "deleteOne",
  "deleteMany",
  "replaceOne",
  "updateOne",
  "updateMany",
];
const UPDATE_OPS = new Set(["findOneAndUpdate", "findOneAndReplace", "replaceOne", "updateOne", "updateMany"]);

function tenantScopePlugin(schema) {
  if (!scopeMode(schema)) return;
  if (schema.$tenantScoped) return;
  schema.$tenantScoped = true;

  schema.pre(QUERY_OPS, function scopeQuery() {
    if (this.getOptions().skipTenantScope) return;
    const ctx = current();
    const filter = filterFor(schema, ctx, `${this.model.modelName}.${this.op}`);
    if (filter) this.and([filter]);
    if (UPDATE_OPS.has(this.op)) checkUpdate(this.getUpdate(), schema, ctx);
  });

  schema.pre("aggregate", function scopeAggregate() {
    if (this.options && this.options.skipTenantScope) return;
    const filter = filterFor(schema, current(), `${this._model && this._model.modelName}.aggregate`);
    if (filter) this.pipeline().unshift({ $match: filter });
  });

  schema.pre("validate", function scopeSave() {
    if (this.$locals && this.$locals.skipTenantScope) return;
    // Subdocuments are covered by their parent document.
    if (typeof this.ownerDocument === "function" && this.ownerDocument() !== this) return;
    checkDocOwnership(this, schema, current());
  });

  schema.pre("insertMany", function scopeInsertMany(next, docs) {
    try {
      const ctx = current();
      for (const d of [].concat(docs || [])) {
        if (d && typeof d === "object") checkDocOwnership(d, schema, ctx);
      }
      next();
    } catch (err) {
      next(err);
    }
  });
}

mongoose.plugin(tenantScopePlugin);

/**
 * A company created while serving a request must be usable by that
 * same request (e.g. creating its default departments). Called by
 * models/Company.js after save.
 */
function registerNewCompany(company) {
  const ctx = current();
  if (!ctx || ctx.kind !== "tenant") return;
  if (String(company.tenant) !== String(ctx.tenantId)) return;
  if (!idIn(company._id, ctx.companyIds)) ctx.companyIds.push(company._id);
}

/** Fails loudly if any model holding client data escaped the plugin. */
function assertAllModelsScoped() {
  const unscoped = Object.values(mongoose.models)
    .filter((m) => scopeMode(m.schema) && !m.schema.$tenantScoped)
    .map((m) => m.modelName);
  if (unscoped.length) {
    throw new Error(
      `Tenant isolation: models loaded before services/tenantScope.js — ${unscoped.join(", ")}. ` +
        "Require services/tenantScope first."
    );
  }
  return true;
}

// ------------------------------------------------------------
// Keep the context across callback-based middleware.
// multer resumes the Express chain from busboy's 'finish' event,
// which runs outside the request's AsyncLocalStorage context. Every
// Express layer re-enters the context stored on the request if the
// current one was lost. One central patch instead of wrapping every
// upload route.
// ------------------------------------------------------------
try {
  const Layer = require("express/lib/router/layer");
  if (!Layer.prototype.__tenantPatched) {
    const origRequest = Layer.prototype.handle_request;
    const origError = Layer.prototype.handle_error;
    Layer.prototype.handle_request = function (req, res, next) {
      const ctx = req && req[CTX_KEY];
      if (ctx && als.getStore() !== ctx) return als.run(ctx, () => origRequest.call(this, req, res, next));
      return origRequest.call(this, req, res, next);
    };
    Layer.prototype.handle_error = function (err, req, res, next) {
      const ctx = req && req[CTX_KEY];
      if (ctx && als.getStore() !== ctx) return als.run(ctx, () => origError.call(this, err, req, res, next));
      return origError.call(this, err, req, res, next);
    };
    Layer.prototype.__tenantPatched = true;
  }
} catch (_) {
  // express not installed (e.g. a standalone script) — nothing to patch.
}

module.exports = {
  runInTenant,
  runAsSystem,
  runAsPlatform,
  run,
  current,
  bindRequest,
  tenantContext,
  enableStrictMode,
  registerNewCompany,
  assertAllModelsScoped,
  SYSTEM,
  PLATFORM,
  NONE,
  CTX_KEY,
  _filterFor: filterFor,
};
