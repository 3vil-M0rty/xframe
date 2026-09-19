const express = require("express");
const mongoose = require("mongoose");

const router = express.Router();

const EmployeeDocument = require("../models/EmployeeDocument");
const Employee = require("../models/Employee");
const Company = require("../models/Company");

const auth = require("../middleware/auth");
const documentUpload = require("../middleware/documentUploadMiddleware");
const { requireHRAccess } = require("../middleware/permissionMiddleware");
const { canAccessHRForCompany } = require("../permissions/permissions");
const { uploadFile, deleteFile } = require("../services/cloudinaryService");
const { logAudit } = require("../services/auditLogger");
const { attachTranslationRoutes } = require("../utils/translationRoutes");
const { findMatchingEmployeeIds } = require("../utils/employeeSearch");

router.use(auth, requireHRAccess);

const canManage = (req, company) => canAccessHRForCompany(req.user, company);

// ======================================================
// GET ALL DOCUMENTS
// GET /api/documents?companyId=&employeeId=&search=&type=&page=&limit=
// ======================================================

router.get("/", async (req, res) => {
  try {
    const { companyId, employeeId, search, type, page = 1, limit = 20 } = req.query;

    if (!companyId) {
      return res.status(400).json({ success: false, message: "companyId is required" });
    }

    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }
    if (!canManage(req, company)) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    const filter = { company: companyId };
    if (employeeId) {
      filter.employee = employeeId;
    } else if (search) {
      filter.employee = { $in: await findMatchingEmployeeIds(companyId, search) };
    }
    if (type) filter.type = type;

    const currentPage = Math.max(Number(page), 1);
    const currentLimit = Math.max(Number(limit), 1);

    const [documents, total] = await Promise.all([
      EmployeeDocument.find(filter)
        .populate("employee", "firstName lastName employeeNumber photo")
        .sort({ createdAt: -1 })
        .skip((currentPage - 1) * currentLimit)
        .limit(currentLimit),
      EmployeeDocument.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: documents,
      pagination: {
        total,
        page: currentPage,
        limit: currentLimit,
        pages: Math.ceil(total / currentLimit) || 1,
      },
    });
  } catch (error) {
    console.error("GET documents error:", error);
    res.status(500).json({ success: false, message: "Error fetching documents", error: error.message });
  }
});

// ======================================================
// GET DOCUMENTS EXPIRING SOON
// GET /api/documents/expiring?companyId=&withinDays=30
// ======================================================

router.get("/expiring", async (req, res) => {
  try {
    const { companyId, withinDays = 30 } = req.query;

    if (!companyId) {
      return res.status(400).json({ success: false, message: "companyId is required" });
    }

    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }
    if (!canManage(req, company)) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    const now = new Date();
    const horizon = new Date();
    horizon.setDate(horizon.getDate() + Number(withinDays));

    const documents = await EmployeeDocument.find({
      company: companyId,
      expiryDate: { $ne: null, $gte: now, $lte: horizon },
    })
      .populate("employee", "firstName lastName employeeNumber photo")
      .sort({ expiryDate: 1 });

    res.json({ success: true, data: documents });
  } catch (error) {
    console.error("GET expiring documents error:", error);
    res.status(500).json({ success: false, message: "Error fetching expiring documents", error: error.message });
  }
});

// ======================================================
// UPLOAD A DOCUMENT
// POST /api/documents
// multipart/form-data: file, company, employee, type, label,
//                       issueDate, expiryDate, notes
// ======================================================

router.post("/", documentUpload.single("file"), async (req, res) => {
  try {
    const { company, employee, type, label, issueDate, expiryDate, notes } = req.body;

    if (!company || !mongoose.Types.ObjectId.isValid(company)) {
      return res.status(400).json({ success: false, message: "A valid company is required" });
    }
    if (!employee || !mongoose.Types.ObjectId.isValid(employee)) {
      return res.status(400).json({ success: false, message: "A valid employee is required" });
    }
    if (!type) {
      return res.status(400).json({ success: false, message: "Document type is required" });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, message: "Please select a file" });
    }

    const companyDoc = await Company.findById(company);
    if (!companyDoc) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }
    if (!canManage(req, companyDoc)) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    const employeeDoc = await Employee.findOne({ _id: employee, company });
    if (!employeeDoc) {
      return res.status(404).json({ success: false, message: "Employee not found in this company" });
    }

    const result = await uploadFile(
      req.file.buffer,
      `frame/companies/${company}/employees/${employee}/documents`,
      req.file.originalname
    );

    const document = await EmployeeDocument.create({
      company,
      employee,
      type,
      label,
      file: {
        url: result.secure_url,
        publicId: result.public_id,
        originalName: req.file.originalname,
      },
      issueDate: issueDate || null,
      expiryDate: expiryDate || null,
      notes,
      uploadedBy: req.user.id,
    });

    const populated = await document.populate(
      "employee",
      "firstName lastName employeeNumber photo"
    );

    await logAudit(req, {
      company,
      action: "create",
      resourceType: "EmployeeDocument",
      resourceId: document._id,
      resourceLabel: label || type,
      after: document.toObject(),
    });

    res.status(201).json({ success: true, data: populated, message: "Document uploaded successfully" });
  } catch (error) {
    console.error("POST document error:", error);
    res.status(500).json({ success: false, message: "Error uploading document", error: error.message });
  }
});

// ======================================================
// UPDATE DOCUMENT (metadata, and optionally replace the file)
// PUT /api/documents/:id
// multipart/form-data: type, label, issueDate, expiryDate, notes,
//                       file (optional — only present if replacing)
// ======================================================

router.put("/:id", documentUpload.single("file"), async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid document ID" });
    }

    const document = await EmployeeDocument.findById(req.params.id).populate("company");
    if (!document) {
      return res.status(404).json({ success: false, message: "Document not found" });
    }
    if (!canManage(req, document.company)) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    const before = document.toObject();

    const { type, label, issueDate, expiryDate, notes } = req.body;
    if (type !== undefined) document.type = type;
    if (label !== undefined) document.label = label;
    if (issueDate !== undefined) document.issueDate = issueDate || null;
    if (expiryDate !== undefined) document.expiryDate = expiryDate || null;
    if (notes !== undefined) document.notes = notes;

    // A new file was attached — upload it and swap it in, then
    // clean up the old one from Cloudinary so replacing a document
    // doesn't leave orphaned files behind.
    if (req.file) {
      const oldPublicId = document.file?.publicId;

      const result = await uploadFile(
        req.file.buffer,
        `frame/companies/${document.company._id}/employees/${document.employee}/documents`,
        req.file.originalname
      );

      document.file = {
        url: result.secure_url,
        publicId: result.public_id,
        originalName: req.file.originalname,
      };

      if (oldPublicId) {
        await deleteFile(oldPublicId);
      }
    }

    await document.save();

    const populated = await document.populate(
      "employee",
      "firstName lastName employeeNumber photo"
    );

    await logAudit(req, {
      company: document.company._id,
      action: "update",
      resourceType: "EmployeeDocument",
      resourceId: document._id,
      resourceLabel: document.label || document.type,
      before,
      after: document.toObject(),
    });

    res.json({ success: true, data: populated, message: "Document updated successfully" });
  } catch (error) {
    console.error("PUT document error:", error);
    res.status(500).json({ success: false, message: "Error updating document", error: error.message });
  }
});

// ======================================================
// DELETE DOCUMENT
// DELETE /api/documents/:id
// ======================================================

router.delete("/:id", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid document ID" });
    }

    const document = await EmployeeDocument.findById(req.params.id).populate("company");
    if (!document) {
      return res.status(404).json({ success: false, message: "Document not found" });
    }
    if (!canManage(req, document.company)) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    if (document.file?.publicId) {
      await deleteFile(document.file.publicId);
    }

    await EmployeeDocument.findByIdAndDelete(req.params.id);

    await logAudit(req, {
      company: document.company._id,
      action: "delete",
      resourceType: "EmployeeDocument",
      resourceId: document._id,
      before: document.toObject(),
    });

    res.json({ success: true, message: "Document deleted successfully", documentId: document._id });
  } catch (error) {
    console.error("DELETE document error:", error);
    res.status(500).json({ success: false, message: "Error deleting document", error: error.message });
  }
});

// ======================================================
// TRANSLATIONS (label, notes) — see config/i18nContent.js
// ======================================================
// router.use(auth, requireHRAccess) above already gates the whole
// router, matching every other :id route in this file.

attachTranslationRoutes(router, EmployeeDocument, {
  resourceType: "EmployeeDocument",
  authorize: async (req, doc) => {
    const company = await Company.findById(doc.company);
    return canManage(req, company);
  },
});

module.exports = router;
