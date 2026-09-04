const express = require('express');
const router = express.Router();
const supplierController = require('../controllers/supplierController');
const { authenticate, checkCompanyAccess, checkPermission } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate, checkCompanyAccess);

// Get all suppliers
router.get('/', supplierController.getAllSuppliers);

// Get supplier by ID
router.get('/:id', supplierController.getSupplierById);

// Get suppliers by status
router.get('/status/:status', supplierController.getSuppliersByStatus);

// Create supplier (requires permission)
router.post('/', checkPermission('inventory', 'create'), supplierController.createSupplier);

// Update supplier (requires permission)
router.put('/:id', checkPermission('inventory', 'update'), supplierController.updateSupplier);

// Delete supplier (requires permission)
router.delete('/:id', checkPermission('inventory', 'delete'), supplierController.deleteSupplier);

module.exports = router;
