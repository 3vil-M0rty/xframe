/**
 * ============================================================
 * In-memory MongoDB stand-in for integration tests
 * ============================================================
 * Real Mongoose, real models, real hooks (including the tenant
 * isolation plugin) — only the driver's collections are replaced by
 * in-memory arrays evaluated with `mingo` (a MongoDB query engine in
 * JS). Lets the cross-client isolation tests exercise real routes
 * end to end without a running mongod.
 *
 *   const fake = require("../test/fakeMongo");
 *   beforeAll(() => fake.connect());
 *   beforeEach(() => fake.reset());
 *
 * Covers the collection methods Mongoose 7 uses for everyday CRUD
 * (find/findOne/count/distinct/aggregate/insert/update/replace/
 * delete/findOneAnd*). Not a full MongoDB: no transactions, no
 * unique-index enforcement, no text search.
 * ============================================================
 */
const mongoose = require("mongoose");
const { Query, Aggregator } = require("mingo");
const { updateOne: mingoUpdateOne, updateMany: mingoUpdateMany, update: mingoUpdate } = require("mingo");

const { BSON } = mongoose.mongo;

function clone(doc) {
  return doc == null ? doc : BSON.deserialize(BSON.serialize(doc), { promoteBuffers: true });
}

function isOperatorUpdate(update) {
  return update && Object.keys(update).some((k) => k.startsWith("$"));
}

function equalityFields(filter) {
  const out = {};
  for (const [k, v] of Object.entries(filter || {})) {
    if (k.startsWith("$")) {
      if (k === "$and") v.forEach((f) => Object.assign(out, equalityFields(f)));
      continue;
    }
    if (v && typeof v === "object" && !(v instanceof mongoose.Types.ObjectId) && !(v instanceof Date)) {
      if (Object.keys(v).some((x) => x.startsWith("$"))) continue;
    }
    out[k] = v;
  }
  return out;
}

class FakeCursor {
  constructor(docs) {
    this.docs = docs;
  }
  toArray() {
    return Promise.resolve(this.docs);
  }
  async *[Symbol.asyncIterator]() {
    for (const d of this.docs) yield d;
  }
  close() {
    return Promise.resolve();
  }
}

class FakeCollection {
  constructor(name, collections) {
    this.collectionName = name;
    this.name = name;
    this.docs = [];
    this.collections = collections;
  }

  _find(filter, options = {}) {
    let cursor = new Query(filter || {}).find(this.docs);
    if (options.sort && Object.keys(options.sort).length) cursor = cursor.sort(normalizeSort(options.sort));
    if (options.skip) cursor = cursor.skip(options.skip);
    if (options.limit) cursor = cursor.limit(options.limit);
    return cursor.all();
  }

  find(filter, options = {}) {
    let docs = this._find(filter, options).map(clone);
    if (options.projection && Object.keys(options.projection).length) docs = project(docs, options.projection);
    return new FakeCursor(docs);
  }
  async findOne(filter, options = {}) {
    const [doc] = this.find(filter, { ...options, limit: 1 }).docs;
    return doc || null;
  }
  async countDocuments(filter) {
    return this._find(filter).length;
  }
  async count(filter) {
    return this._find(filter).length;
  }
  async estimatedDocumentCount() {
    return this.docs.length;
  }
  async distinct(field, filter) {
    const seen = new Map();
    for (const d of this._find(filter)) {
      const v = field.split(".").reduce((o, k) => (o == null ? o : o[k]), d);
      for (const x of Array.isArray(v) ? v : [v]) {
        if (x === undefined) continue;
        seen.set(String(x), x);
      }
    }
    return [...seen.values()].map(clone1);
  }
  aggregate(pipeline) {
    const agg = new Aggregator(pipeline, {
      collectionResolver: (name) => (this.collections.get(name) || { docs: [] }).docs,
    });
    return new FakeCursor(agg.run(this.docs).map(clone));
  }

  async insertOne(doc) {
    const d = clone(doc);
    if (!d._id) d._id = new mongoose.Types.ObjectId();
    this.docs.push(d);
    return { acknowledged: true, insertedId: d._id };
  }
  async insertMany(docs) {
    const insertedIds = {};
    docs.forEach((doc, i) => {
      const d = clone(doc);
      if (!d._id) d._id = new mongoose.Types.ObjectId();
      this.docs.push(d);
      insertedIds[i] = d._id;
    });
    return { acknowledged: true, insertedCount: docs.length, insertedIds };
  }

  _upsert(filter, update) {
    const base = clone(equalityFields(filter));
    if (!base._id) base._id = new mongoose.Types.ObjectId();
    if (isOperatorUpdate(update)) {
      const { $setOnInsert, ...rest } = update;
      if (Object.keys(rest).length) mingoUpdate(base, rest);
      if ($setOnInsert) mingoUpdate(base, { $set: $setOnInsert });
    } else Object.assign(base, update);
    this.docs.push(base);
    return base;
  }

  _applyOne(filter, update, options = {}) {
    const [target] = this._find(filter, { sort: options.sort, limit: 1 });
    if (!target) return { target: null };
    const before = clone(target);
    if (isOperatorUpdate(update)) {
      const { $setOnInsert, ...rest } = update;
      mingoUpdate(target, rest, options.arrayFilters, filter);
    } else {
      const id = target._id;
      for (const k of Object.keys(target)) delete target[k];
      Object.assign(target, clone(update), { _id: id });
    }
    return { target, before };
  }

  async updateOne(filter, update, options = {}) {
    const { target } = this._applyOne(filter, update, options);
    if (!target && options.upsert) {
      const d = this._upsert(filter, update);
      return { acknowledged: true, matchedCount: 0, modifiedCount: 0, upsertedCount: 1, upsertedId: d._id };
    }
    return { acknowledged: true, matchedCount: target ? 1 : 0, modifiedCount: target ? 1 : 0, upsertedCount: 0, upsertedId: null };
  }
  async replaceOne(filter, doc, options = {}) {
    return this.updateOne(filter, doc, options);
  }
  async updateMany(filter, update, options = {}) {
    const matches = this._find(filter);
    if (!matches.length && options.upsert) {
      const d = this._upsert(filter, update);
      return { acknowledged: true, matchedCount: 0, modifiedCount: 0, upsertedCount: 1, upsertedId: d._id };
    }
    const { $setOnInsert, ...rest } = update;
    for (const m of matches) mingoUpdate(m, rest, options.arrayFilters);
    return { acknowledged: true, matchedCount: matches.length, modifiedCount: matches.length, upsertedCount: 0, upsertedId: null };
  }
  async findOneAndUpdate(filter, update, options = {}) {
    const { target, before } = this._applyOne(filter, update, options);
    if (!target) {
      if (options.upsert) {
        const d = this._upsert(filter, update);
        const value = options.returnDocument === "after" || options.returnOriginal === false ? clone(d) : null;
        return result(value, options, false);
      }
      return result(null, options, false);
    }
    const after = options.returnDocument === "after" || options.returnOriginal === false;
    let value = after ? clone(target) : before;
    if (options.projection && Object.keys(options.projection).length) [value] = project([value], options.projection);
    return result(value, options, true);
  }
  async findOneAndReplace(filter, doc, options = {}) {
    return this.findOneAndUpdate(filter, doc, options);
  }
  async findOneAndDelete(filter, options = {}) {
    const [target] = this._find(filter, { sort: options.sort, limit: 1 });
    if (target) this.docs = this.docs.filter((d) => d !== target);
    return result(target ? clone(target) : null, options, !!target);
  }
  async deleteOne(filter) {
    const [target] = this._find(filter, { limit: 1 });
    if (target) this.docs = this.docs.filter((d) => d !== target);
    return { acknowledged: true, deletedCount: target ? 1 : 0 };
  }
  async deleteMany(filter) {
    const matches = new Set(this._find(filter));
    this.docs = this.docs.filter((d) => !matches.has(d));
    return { acknowledged: true, deletedCount: matches.size };
  }

  // Index management — accepted and ignored.
  async createIndex() {
    return "ok";
  }
  async createIndexes() {
    return [];
  }
  async dropIndex() {
    return {};
  }
  async dropIndexes() {
    return true;
  }
  listIndexes() {
    return new FakeCursor([{ key: { _id: 1 }, name: "_id_" }]);
  }
  async indexes() {
    return [{ key: { _id: 1 }, name: "_id_" }];
  }
  async indexExists() {
    return false;
  }
}

function result(value, options, updatedExisting) {
  if (options.includeResultMetadata === false) return value;
  return { value, ok: 1, lastErrorObject: { n: value ? 1 : 0, updatedExisting } };
}

function clone1(v) {
  return v;
}

function normalizeSort(sort) {
  if (Array.isArray(sort)) return Object.fromEntries(sort);
  if (sort instanceof Map) return Object.fromEntries(sort);
  return sort;
}

function project(docs, projection) {
  const keys = Object.keys(projection);
  const inclusive = keys.some((k) => k !== "_id" && projection[k] && typeof projection[k] !== "object");
  if (keys.some((k) => typeof projection[k] === "object")) return docs; // $slice/$elemMatch: return full docs
  return docs.map((d) => {
    if (!d) return d;
    if (inclusive) {
      const out = {};
      if (projection._id !== 0) out._id = d._id;
      for (const k of keys) {
        if (!projection[k] || k === "_id") continue;
        const parts = k.split(".");
        let src = d;
        let dst = out;
        for (let i = 0; i < parts.length; i += 1) {
          if (src == null) break;
          if (i === parts.length - 1) {
            if (src[parts[i]] !== undefined) dst[parts[i]] = src[parts[i]];
          } else {
            dst[parts[i]] = dst[parts[i]] || {};
            dst = dst[parts[i]];
            src = src[parts[i]];
          }
        }
      }
      return out;
    }
    const out = { ...d };
    for (const k of keys) if (!projection[k]) delete out[k];
    return out;
  });
}

/** A fresh, independent in-memory database. */
function createFakeDb(databaseName = "fake") {
  const collections = new Map();
  return {
    databaseName,
    collections,
    collection(name) {
      if (!collections.has(name)) collections.set(name, new FakeCollection(name, collections));
      return collections.get(name);
    },
    async createCollection(name) {
      return this.collection(name);
    },
    listCollections() {
      return new FakeCursor([...collections.keys()].map((name) => ({ name })));
    },
    async dropDatabase() {
      collections.clear();
      return true;
    },
  };
}

const fakeDb = createFakeDb();

let connected = false;
function connect() {
  if (connected) return;
  mongoose.set("autoIndex", false);
  mongoose.set("autoCreate", false);
  const conn = mongoose.connection;
  conn.db = fakeDb;
  conn.onOpen();
  // Models compiled before this point already have collections;
  // make sure they all point at the fake db and stop buffering.
  for (const model of Object.values(mongoose.models)) {
    model.collection.collection = fakeDb.collection(model.collection.name);
    model.collection.buffer = false;
  }
  connected = true;
}

function reset() {
  for (const c of fakeDb.collections.values()) c.docs = [];
}

function rawCollection(name) {
  return fakeDb.collection(name);
}

module.exports = { connect, reset, rawCollection, fakeDb, createFakeDb };
