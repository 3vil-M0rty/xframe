const mongoose = require('mongoose');

const payrollSchema = new mongoose.Schema({
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  },
  staff: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  month: {
    type: Date,
    required: true
  },
  baseSalary: {
    type: Number,
    required: true
  },
  hourlyRate: Number,
  hoursWorked: {
    type: Number,
    default: 0
  },
  overtimeHours: {
    type: Number,
    default: 0
  },
  overtimeMultiplier: {
    type: Number,
    default: 1.5
  },
  bonuses: [{
    reason: String,
    amount: Number,
    date: Date
  }],
  deductions: [{
    reason: String,
    amount: Number,
    date: Date
  }],
  socialContribution: {
    type: Number,
    default: 0
  },
  taxDeduction: {
    type: Number,
    default: 0
  },
  grossSalary: Number,
  netSalary: Number,
  paymentMethod: {
    type: String,
    enum: ['bank_transfer', 'cash', 'check'],
    default: 'bank_transfer'
  },
  paymentDate: Date,
  status: {
    type: String,
    enum: ['pending', 'approved', 'paid', 'cancelled'],
    default: 'pending'
  },
  notes: String,
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

payrollSchema.index({ company: 1, staff: 1, month: 1 });

// Calculate net salary
payrollSchema.methods.calculateSalaries = function() {
  let gross = this.baseSalary;
  
  // Add hourly pay if applicable
  if (this.hourlyRate && this.hoursWorked) {
    gross += this.hourlyRate * this.hoursWorked;
  }
  
  // Add overtime
  if (this.overtimeHours) {
    gross += this.hourlyRate * this.overtimeHours * this.overtimeMultiplier;
  }
  
  // Add bonuses
  const totalBonuses = this.bonuses.reduce((sum, b) => sum + b.amount, 0);
  gross += totalBonuses;
  
  // Calculate net
  const totalDeductions = this.deductions.reduce((sum, d) => sum + d.amount, 0);
  const totalDeductionsAll = totalDeductions + this.socialContribution + this.taxDeduction;
  
  this.grossSalary = gross;
  this.netSalary = Math.max(0, gross - totalDeductionsAll);
  
  return {
    gross: this.grossSalary,
    net: this.netSalary
  };
};

module.exports = mongoose.model('Payroll', payrollSchema);
