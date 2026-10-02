const Employee = require("../models/Employee");
const Product = require("../models/Product");

/**
 * Brings the employees collection's indexes in line with
 * models/Employee.js. Needed because the CIN / CNSS uniqueness
 * indexes changed from `sparse` to `partialFilterExpression` (see the
 * comment there) under the SAME index names — MongoDB won't change an
 * existing index's options in place, and Mongoose's automatic index
 * build just logs a conflict and keeps the old, broken one.
 * syncIndexes() drops indexes whose definition differs from the
 * schema and rebuilds them. Idempotent: once in sync it does nothing.
 * Scoped to Employee only, deliberately.
 */
async function syncEmployeeIndexes() {
  await dropStaleIndexes();
  try {
    const dropped = await Employee.syncIndexes();
    if (dropped && dropped.length) {
      console.log(`✓ Rebuilt employee indexes: ${dropped.join(", ")}`);
    }
  } catch (error) {
    // Most likely cause: existing records that genuinely violate the
    // (correct) uniqueness rule — two employees sharing a real CIN or
    // CNSS number in the same company. Log loudly but don't crash.
    console.error("Could not sync employee indexes:", error.message);
  }
  // Same story for inventory articles' internal reference (now
  // optional — see models/Product.js).
  try {
    const dropped = await Product.syncIndexes();
    if (dropped && dropped.length) console.log(`✓ Rebuilt product indexes: ${dropped.join(", ")}`);
  } catch (error) {
    console.error("Could not sync product indexes:", error.message);
  }
}

/**
 * Drops indexes left behind by fields that no longer exist in the
 * schemas — e.g. an old UNIQUE index on companies.slug: every new
 * company has no slug (null), so the second company ever created
 * fails with "E11000 duplicate key ... slug: null". Only indexes on a
 * field the model doesn't declare at all are dropped; anything the
 * schema still defines is left alone.
 */
async function dropStaleIndexes() {
  const mongoose = require("mongoose");
  for (const Model of Object.values(mongoose.models)) {
    let indexes;
    try {
      indexes = await Model.collection.indexes();
    } catch {
      continue; // collection doesn't exist yet
    }
    for (const idx of indexes) {
      if (idx.name === "_id_" || idx.textIndexVersion) continue;
      const stale = Object.keys(idx.key || {}).some((field) => {
        const top = field.split(".")[0];
        return !Model.schema.path(top) && Model.schema.pathType(top) === "adhocOrUndefined";
      });
      if (!stale) continue;
      try {
        await Model.collection.dropIndex(idx.name);
        console.log(`✓ Dropped obsolete index ${Model.collection.name}.${idx.name}`);
      } catch (error) {
        console.error(`Could not drop obsolete index ${Model.collection.name}.${idx.name}:`, error.message);
      }
    }
  }
}

module.exports = { syncEmployeeIndexes, dropStaleIndexes };
