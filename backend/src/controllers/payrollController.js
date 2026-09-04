const Payroll = require('../models/Payroll');
const User = require('../models/User');

// Get all payroll records
exports.getAllPayroll = async (req, res) => {
  try {
    const { month, status, staffId } = req.query;
    const query = { company: req.company._id };
    
    if (month) {
      const startMonth = new Date(month);
      const endMonth = new Date(month);
      endMonth.setMonth(endMonth.getMonth() + 1);
      query.month = { $gte: startMonth, $lt: endMonth };
    }
    if (status) query.status = status;
    if (staffId) query.staff = staffId;
    
    const payroll = await Payroll.find(query)
      .populate('staff', 'firstName lastName email')
      .populate('approvedBy', 'firstName lastName')
      .sort({ month: -1 });
    
    res.json({ payroll });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get payroll by ID
exports.getPayrollById = async (req, res) => {
  try {
    const payroll = await Payroll.findOne({
      _id: req.params.id,
      company: req.company._id
    }).populate('staff').populate('approvedBy');
    
    if (!payroll) {
      return res.status(404).json({ error: 'Payroll record not found' });
    }
    
    res.json({ payroll });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Create payroll record
exports.createPayroll = async (req, res) => {
  try {
    const {
      staffId,
      month,
      baseSalary,
      hourlyRate,
      hoursWorked,
      overtimeHours,
      socialContribution,
      taxDeduction,
      paymentMethod,
      notes
    } = req.body;
    
    // Verify staff exists in company
    const staff = await User.findOne({
      _id: staffId,
      company: req.company._id
    });
    
    if (!staff) {
      return res.status(404).json({ error: 'Staff member not found' });
    }
    
    // Check if payroll already exists for this month
    const existing = await Payroll.findOne({
      company: req.company._id,
      staff: staffId,
      month: new Date(month)
    });
    
    if (existing) {
      return res.status(400).json({ error: 'Payroll already exists for this month' });
    }
    
    const payroll = new Payroll({
      company: req.company._id,
      staff: staffId,
      month: new Date(month),
      baseSalary,
      hourlyRate,
      hoursWorked,
      overtimeHours,
      socialContribution,
      taxDeduction,
      paymentMethod,
      notes
    });
    
    payroll.calculateSalaries();
    await payroll.save();
    await payroll.populate('staff');
    
    res.status(201).json({ message: 'Payroll created', payroll });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update payroll
exports.updatePayroll = async (req, res) => {
  try {
    const {
      baseSalary,
      hourlyRate,
      hoursWorked,
      overtimeHours,
      overtimeMultiplier,
      socialContribution,
      taxDeduction,
      paymentMethod,
      paymentDate,
      notes
    } = req.body;
    
    const payroll = await Payroll.findOne({
      _id: req.params.id,
      company: req.company._id
    });
    
    if (!payroll) {
      return res.status(404).json({ error: 'Payroll record not found' });
    }
    
    // Prevent updating if already paid
    if (payroll.status === 'paid') {
      return res.status(400).json({ error: 'Cannot update paid payroll' });
    }
    
    Object.assign(payroll, {
      baseSalary,
      hourlyRate,
      hoursWorked,
      overtimeHours,
      overtimeMultiplier,
      socialContribution,
      taxDeduction,
      paymentMethod,
      paymentDate,
      notes
    });
    
    payroll.calculateSalaries();
    await payroll.save();
    
    res.json({ message: 'Payroll updated', payroll });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Add bonus to payroll
exports.addBonus = async (req, res) => {
  try {
    const { reason, amount } = req.body;
    
    const payroll = await Payroll.findOne({
      _id: req.params.id,
      company: req.company._id
    });
    
    if (!payroll) {
      return res.status(404).json({ error: 'Payroll record not found' });
    }
    
    payroll.bonuses.push({
      reason,
      amount,
      date: new Date()
    });
    
    payroll.calculateSalaries();
    await payroll.save();
    
    res.json({ message: 'Bonus added', payroll });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Add deduction
exports.addDeduction = async (req, res) => {
  try {
    const { reason, amount } = req.body;
    
    const payroll = await Payroll.findOne({
      _id: req.params.id,
      company: req.company._id
    });
    
    if (!payroll) {
      return res.status(404).json({ error: 'Payroll record not found' });
    }
    
    payroll.deductions.push({
      reason,
      amount,
      date: new Date()
    });
    
    payroll.calculateSalaries();
    await payroll.save();
    
    res.json({ message: 'Deduction added', payroll });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Approve payroll
exports.approvePayroll = async (req, res) => {
  try {
    const payroll = await Payroll.findOne({
      _id: req.params.id,
      company: req.company._id
    });
    
    if (!payroll) {
      return res.status(404).json({ error: 'Payroll record not found' });
    }
    
    if (payroll.status !== 'pending') {
      return res.status(400).json({ error: 'Only pending payroll can be approved' });
    }
    
    payroll.status = 'approved';
    payroll.approvedBy = req.user.id;
    await payroll.save();
    
    res.json({ message: 'Payroll approved', payroll });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Mark as paid
exports.markAsPaid = async (req, res) => {
  try {
    const { paymentDate } = req.body;
    
    const payroll = await Payroll.findOne({
      _id: req.params.id,
      company: req.company._id
    });
    
    if (!payroll) {
      return res.status(404).json({ error: 'Payroll record not found' });
    }
    
    if (payroll.status !== 'approved') {
      return res.status(400).json({ error: 'Only approved payroll can be marked as paid' });
    }
    
    payroll.status = 'paid';
    payroll.paymentDate = paymentDate || new Date();
    await payroll.save();
    
    res.json({ message: 'Payroll marked as paid', payroll });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get payroll summary by month
exports.getMonthlySummary = async (req, res) => {
  try {
    const { month } = req.query;
    
    const startMonth = new Date(month);
    const endMonth = new Date(month);
    endMonth.setMonth(endMonth.getMonth() + 1);
    
    const payrolls = await Payroll.find({
      company: req.company._id,
      month: { $gte: startMonth, $lt: endMonth }
    }).populate('staff');
    
    const summary = {
      month: month,
      totalRecords: payrolls.length,
      totalGross: payrolls.reduce((sum, p) => sum + (p.grossSalary || 0), 0),
      totalNet: payrolls.reduce((sum, p) => sum + (p.netSalary || 0), 0),
      paidRecords: payrolls.filter(p => p.status === 'paid').length,
      approvedRecords: payrolls.filter(p => p.status === 'approved').length,
      pendingRecords: payrolls.filter(p => p.status === 'pending').length,
      records: payrolls
    };
    
    res.json({ summary });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = exports;
