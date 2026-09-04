const express = require('express');
const router = express.Router();
const purchaseOrderController = require('../controllers/purchaseOrderController');
const { authenticate, checkCompanyAccess, checkPermission } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate, checkCompanyAccess);

// Get all purchase orders
router.get('/', purchaseOrderController.getAllPurchaseOrders);

// Get PO statistics
router.get('/stats/overview', purchaseOrderController.getPurchaseOrderStats);

// Get PO by ID
router.get('/:id', purchaseOrderController.getPurchaseOrderById);

// Create PO (requires permission)
router.post('/', checkPermission('projects', 'create'), purchaseOrderController.createPurchaseOrder);

// Update PO (requires permission)
router.put('/:id', checkPermission('projects', 'update'), purchaseOrderController.updatePurchaseOrder);

// Send PO to supplier
router.post('/:id/send', checkPermission('projects', 'update'), purchaseOrderController.sendPurchaseOrder);

// Approve PO (requires manager role)
router.post('/:id/approve', (req, res, next) => {
  if (!['admin', 'manager'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Only managers can approve orders' });
  }
  next();
}, purchaseOrderController.approvePurchaseOrder);

// Receive PO
router.post('/:id/receive', checkPermission('projects', 'update'), purchaseOrderController.receivePurchaseOrder);

// Cancel PO
router.post('/:id/cancel', checkPermission('projects', 'delete'), purchaseOrderController.cancelPurchaseOrder);

module.exports = router;
