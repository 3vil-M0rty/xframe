const express = require("express");
const mongoose = require("mongoose");
const auth = require("../middleware/auth");
const { canAccessHRForCompany, canAccessPurchasing } = require("../permissions/permissions");
const { privateFileUrl, FILE_LINK_TTL_SECONDS } = require("../services/cloudinaryService");
const EmployeeDocument = require("../models/EmployeeDocument");
const Supplier = require("../models/Supplier");
const PurchaseOrder = require("../models/PurchaseOrder");
const PriceRequest = require("../models/PriceRequest");
const Company = require("../models/Company");

/**
 * ============================================================
 * FILE LINKS — GET /api/files/link?kind=&id=&sub=
 * ============================================================
 * Private documents (HR documents, supplier documents, delivery
 * notes, invoices, quotes) have no permanent public URL. To open
 * one, the app asks here; the caller must be allowed to see the
 * record that holds the file (same rule as the page that lists it),
 * and gets back a signed link that expires after a few minutes.
 *
 * Client isolation is automatic: another client's record is simply
 * "not found" (services/tenantScope.js).
 *
 *   kind=employee-document   id=<EmployeeDocument>
 *   kind=supplier-document   id=<Supplier>       sub=<document _id>
 *   kind=order-reception     id=<PurchaseOrder>  sub=<reception _id>
 *   kind=order-invoice       id=<PurchaseOrder>  sub=<invoice _id>
 *   kind=price-request-quote id=<PriceRequest>
 * ============================================================
 */

const router = express.Router();
router.use(auth);

const isId = (v) => mongoose.Types.ObjectId.isValid(String(v || ""));

const purchasing = (req) => canAccessPurchasing(req.user);

const RESOLVERS = {
  "employee-document": async (req, id) => {
    const doc = await EmployeeDocument.findById(id).select("company file").lean();
    if (!doc) return null;
    const company = await Company.findById(doc.company);
    return { allowed: !!company && canAccessHRForCompany(req.user, company), file: doc.file };
  },
  "supplier-document": async (req, id, sub) => {
    const supplier = await Supplier.findById(id).select("documents");
    const d = supplier?.documents?.id(sub);
    return d ? { allowed: purchasing(req), file: d.file } : null;
  },
  "order-reception": async (req, id, sub) => {
    const order = await PurchaseOrder.findById(id).select("receptions");
    const r = order?.receptions?.id(sub);
    return r ? { allowed: purchasing(req), file: r.file } : null;
  },
  "order-invoice": async (req, id, sub) => {
    const order = await PurchaseOrder.findById(id).select("invoices");
    const inv = order?.invoices?.id(sub);
    return inv ? { allowed: purchasing(req), file: inv.file } : null;
  },
  "price-request-quote": async (req, id) => {
    const pr = await PriceRequest.findById(id).select("quoteFile").lean();
    return pr ? { allowed: purchasing(req), file: pr.quoteFile } : null;
  },
};

router.get("/link", async (req, res) => {
  try {
    const { kind, id, sub } = req.query;
    const resolve = RESOLVERS[kind];
    if (!resolve) return res.status(400).json({ success: false, message: "Unknown file kind" });
    if (!isId(id) || (sub !== undefined && !isId(sub))) {
      return res.status(400).json({ success: false, message: "Invalid id" });
    }

    const found = await resolve(req, id, sub);
    if (!found || !found.file) return res.status(404).json({ success: false, message: "File not found" });
    if (!found.allowed) return res.status(403).json({ success: false, message: "Not authorized" });

    const url = privateFileUrl(found.file);
    if (!url) return res.status(404).json({ success: false, message: "File not found" });

    res.set("Cache-Control", "no-store");
    res.json({
      success: true,
      data: {
        url,
        name: found.file.originalName || "",
        expiresInSeconds: found.file.private ? FILE_LINK_TTL_SECONDS : null,
      },
    });
  } catch (error) {
    console.error("GET file link error:", error);
    res.status(500).json({ success: false, message: "Error opening the file" });
  }
});

module.exports = router;
