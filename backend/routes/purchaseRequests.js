const express = require("express");
const mongoose = require("mongoose");

const router = express.Router();

const PurchaseRequest = require("../models/PurchaseRequest");
const PurchaseOrder = require("../models/PurchaseOrder");
const Product = require("../models/Product");

const auth = require("../middleware/auth");
const { canAccessProduction, canAccessPurchasing, isAdmin } = require("../permissions/permissions");
const { logAudit } = require("../services/auditLogger");
const { attachTranslationRoutes } = require("../utils/translationRoutes");
const {
  notify, notifyMany, getProductionRecipientIds, getPurchasingRecipientIds,
} = require("../services/notificationService");
const { OPEN, planProcessAction, NOTIFY_TITLES } = require("../services/purchaseRequestWorkflow");

/**
 * ============================================================
 * PURCHASE REQUESTS (demandes d'achat)
 * ============================================================
 * Production asks (from an article in the inventory); the purchasing
 * team answers: ordered / declined (with reason) / delayed (with
 * explanation), or just adds a note. Production is notified of every
 * answer, purchasing of every new request.
 *   view:    production or purchasing
 *   create:  production (the people who manage the stock)
 *   process: purchasing
 * ============================================================
 */

router.use(auth);

const canView = (user) => canAccessProduction(user) || canAccessPurchasing(user);
const deny = (res, message) => res.status(403).json({ success: false, message });

const POPULATE_PRODUCT = "name internalReference image unit quantity threshold translations";

// Everyone in production who should hear back about a request: the
// person who asked, plus the production team (minus whoever acted).
async function notifyProduction(request, actorId, title, message) {
  const ids = new Set(await getProductionRecipientIds(request.company, actorId));
  if (request.requestedBy && String(request.requestedBy) !== String(actorId)) ids.add(String(request.requestedBy));
  await notifyMany([...ids], {
    type: "purchase_request_reviewed",
    title,
    message,
    link: "/production/purchase-requests",
  });
}

// ======================================================
// LIST  GET /api/purchase-requests?companyId=&status=pending,delayed&product=&page=&limit=
// ======================================================
router.get("/", async (req, res) => {
  try {
    if (!canView(req.user)) return deny(res, "You do not have access to purchase requests");
    const { companyId, status, product, page = 1, limit = 20 } = req.query;
    if (!companyId || !mongoose.Types.ObjectId.isValid(companyId)) {
      return res.status(400).json({ success: false, message: "A valid companyId is required" });
    }

    const filter = { company: companyId };
    if (status) {
      const statuses = String(status).split(",").map((s) => s.trim()).filter(Boolean);
      // legacy values still count as their modern equivalents
      if (statuses.includes("ordered")) statuses.push("approved");
      if (statuses.includes("declined")) statuses.push("rejected");
      filter.status = { $in: statuses };
    }
    if (product && mongoose.Types.ObjectId.isValid(product)) filter.product = product;

    const currentPage = Math.max(Number(page) || 1, 1);
    const currentLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);

    const [requests, total] = await Promise.all([
      PurchaseRequest.find(filter)
        .populate("product", POPULATE_PRODUCT)
        .populate("requestedBy", "firstName lastName")
        .populate("reviewedBy", "firstName lastName")
        .populate("purchaseOrder", "number status")
        .populate("history.by", "firstName lastName")
        .sort({ createdAt: -1 })
        .skip((currentPage - 1) * currentLimit)
        .limit(currentLimit),
      PurchaseRequest.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: requests,
      pagination: { total, page: currentPage, limit: currentLimit, pages: Math.ceil(total / currentLimit) || 1 },
    });
  } catch (error) {
    console.error("GET purchase requests error:", error);
    res.status(500).json({ success: false, message: "Error fetching purchase requests", error: error.message });
  }
});

// ======================================================
// OPEN COUNT (the "Demandes d'achat (N)" badge)
// GET /api/purchase-requests/open-count?companyId=
// Registered before /:id-style routes on purpose.
// ======================================================
router.get("/open-count", async (req, res) => {
  try {
    if (!canView(req.user)) return deny(res, "You do not have access to purchase requests");
    const filter = { status: { $in: OPEN } };
    if (req.query.companyId && mongoose.Types.ObjectId.isValid(req.query.companyId)) filter.company = req.query.companyId;
    res.json({ success: true, data: { count: await PurchaseRequest.countDocuments(filter) } });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error counting purchase requests", error: error.message });
  }
});

// ======================================================
// CREATE  POST /api/purchase-requests  { company, product, requestedQuantity, notes }
// From the "purchase request" button on an inventory article.
// ======================================================
router.post("/", async (req, res) => {
  try {
    if (!canAccessProduction(req.user)) return deny(res, "Only the production team can request a purchase");
    const { company, product, requestedQuantity, notes } = req.body;

    if (!company || !mongoose.Types.ObjectId.isValid(company)) {
      return res.status(400).json({ success: false, message: "A valid company is required" });
    }
    if (!product || !mongoose.Types.ObjectId.isValid(product)) {
      return res.status(400).json({ success: false, message: "A valid product is required" });
    }
    const qty = Number(requestedQuantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      return res.status(400).json({ success: false, message: "The requested quantity must be greater than zero" });
    }

    const productDoc = await Product.findOne({ _id: product, company }).select("name unit");
    if (!productDoc) return res.status(404).json({ success: false, message: "Article not found in this company" });

    const request = await PurchaseRequest.create({
      company,
      product,
      requestedQuantity: qty,
      notes,
      requestedBy: req.user.id,
      history: [{ status: "pending", note: notes, by: req.user.id }],
    });

    await logAudit(req, {
      company,
      action: "create",
      resourceType: "PurchaseRequest",
      resourceId: request._id,
      resourceLabel: `${qty} × ${productDoc.name}`,
    });

    const recipients = await getPurchasingRecipientIds(company, req.user.id);
    await notifyMany(recipients, {
      type: "purchase_request_pending",
      title: "New purchase request",
      message: `${qty}${productDoc.unit ? ` ${productDoc.unit}` : ""} × ${productDoc.name}`,
      link: "/purchasing/requests",
    });

    res.status(201).json({ success: true, data: await request.populate("product", POPULATE_PRODUCT) });
  } catch (error) {
    console.error("POST purchase request error:", error);
    res.status(500).json({ success: false, message: "Error creating purchase request", error: error.message });
  }
});

// ======================================================
// PROCESS  PATCH /api/purchase-requests/:id/process
// body: { action: "ordered"|"declined"|"delayed"|"note", note?, purchaseOrderId? }
// ======================================================
async function processRequest(req, res) {
  try {
    if (!canAccessPurchasing(req.user)) return deny(res, "Only the purchasing team can process purchase requests");
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid purchase request ID" });
    }

    const request = await PurchaseRequest.findById(req.params.id).populate("product", "name unit");
    if (!request) return res.status(404).json({ success: false, message: "Purchase request not found" });

    const { action, note, purchaseOrderId } = req.body;
    const plan = planProcessAction(request.status, action, note);
    if (plan.error) return res.status(400).json({ success: false, message: plan.error });

    let order = null;
    if (action === "ordered" && purchaseOrderId) {
      if (!mongoose.Types.ObjectId.isValid(purchaseOrderId)) {
        return res.status(400).json({ success: false, message: "Invalid purchase order" });
      }
      order = await PurchaseOrder.findOne({ _id: purchaseOrderId, company: request.company });
      if (!order || order.status === "cancelled") {
        return res.status(400).json({ success: false, message: "That purchase order doesn't exist or was cancelled" });
      }
    }

    Object.assign(request, plan.set);
    if (order) {
      request.purchaseOrder = order._id;
      if (!order.purchaseRequests.some((id) => String(id) === String(request._id))) {
        order.purchaseRequests.push(request._id);
        await order.save();
      }
    }
    request.reviewedBy = req.user.id;
    request.reviewedAt = new Date();
    request.history.push({ status: plan.status, note: typeof note === "string" ? note.trim() : undefined, by: req.user.id });
    await request.save();

    const item = `${request.requestedQuantity} × ${request.product?.name || "article"}`;
    const detail = action === "declined" ? request.declineReason : request.purchasingNote;
    await notifyProduction(
      request,
      req.user.id,
      NOTIFY_TITLES[action],
      [item, order ? `(${order.number})` : "", detail ? `— ${detail}` : ""].filter(Boolean).join(" ")
    );

    const populated = await PurchaseRequest.findById(request._id)
      .populate("product", POPULATE_PRODUCT)
      .populate("requestedBy", "firstName lastName")
      .populate("purchaseOrder", "number status")
      .populate("history.by", "firstName lastName");
    res.json({ success: true, data: populated });
  } catch (error) {
    console.error("PATCH purchase request process error:", error);
    res.status(500).json({ success: false, message: "Error processing purchase request", error: error.message });
  }
}

router.patch("/:id/process", processRequest);

// ======================================================
// LEGACY  PATCH /api/purchase-requests/:id/review  { status: approved|rejected, reviewComment? }
// Kept so older screens keep working; maps onto /process.
// ======================================================
router.patch("/:id/review", (req, res) => {
  const map = { approved: "ordered", rejected: "declined" };
  req.body = {
    action: map[req.body.status],
    // a legacy rejection may carry no comment; the new workflow requires a reason
    note: req.body.reviewComment || req.body.note || (req.body.status === "rejected" ? "Refusé" : undefined),
  };
  return processRequest(req, res);
});

// ======================================================
// DELETE  DELETE /api/purchase-requests/:id
// The requester can withdraw their own request while it's still open;
// admins can delete any.
// ======================================================
router.delete("/:id", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid purchase request ID" });
    }
    const request = await PurchaseRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ success: false, message: "Purchase request not found" });

    const ownOpen = String(request.requestedBy) === String(req.user.id) && OPEN.includes(request.status);
    if (!isAdmin(req.user) && !ownOpen) {
      return deny(res, "Only the requester (while it's still open) or an admin can delete this request");
    }

    await request.deleteOne();
    res.json({ success: true, message: "Purchase request deleted", requestId: request._id });
  } catch (error) {
    console.error("DELETE purchase request error:", error);
    res.status(500).json({ success: false, message: "Error deleting purchase request", error: error.message });
  }
});

attachTranslationRoutes(router, PurchaseRequest, { resourceType: "PurchaseRequest" });

module.exports = router;
