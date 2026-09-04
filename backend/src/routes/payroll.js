const express = require('express');
const {
  getAllPayroll,
  getPayrollById,
  createPayroll,
  updatePayroll,
  addBonus,
  addDeduction,
  approvePayroll,
  markAsPaid,
  getMonthlySummary
} = require('../controllers/payrollController');
const { checkRole } = require('../middleware/auth');

const router = express.Router();

// Read access for all
router.get('/', getAllPayroll);
router.get('/:id', getPayrollById);
router.get('/summary/monthly', getMonthlySummary);

// Admin/Manager only
router.post('/', checkRole('admin', 'manager'), createPayroll);
router.put('/:id', checkRole('admin', 'manager'), updatePayroll);
router.post('/:id/bonus', checkRole('admin', 'manager'), addBonus);
router.post('/:id/deduction', checkRole('admin', 'manager'), addDeduction);

// Admin only for approval/payment
router.post('/:id/approve', checkRole('admin'), approvePayroll);
router.post('/:id/mark-paid', checkRole('admin'), markAsPaid);

module.exports = router;
