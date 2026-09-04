const mongoose = require('mongoose');

const purchaseOrderLineSchema = new mongoose.Schema({
  article: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Article',
    required: true
  },
  quantity: {
    type: Number,
    required: true
  },
  unitPrice: {
    type: Number,
    required: true
  },
  totalPrice: {
    type: Number,
    required: true
  },
  deliveryDate: Date,
  receivedQuantity: {
    type: Number,
    default: 0
  },
  notes: String
});

const purchaseOrderSchema = new mongoose.Schema({
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  },
  poNumber: {
    type: String,
    required: true,
    unique: true
  },
  supplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier',
    required: true
  },
  department: {
    type: String,
    required: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  lines: [purchaseOrderLineSchema],
  orderDate: {
    type: Date,
    default: Date.now
  },
  expectedDeliveryDate: Date,
  actualDeliveryDate: Date,
  subtotal: Number,
  tax: {
    type: Number,
    default: 0
  },
  shippingCost: {
    type: Number,
    default: 0
  },
  totalAmount: Number,
  currency: { type: String, default: 'EUR' },
  status: {
    type: String,
    enum: ['draft', 'pending', 'approved', 'sent', 'received', 'cancelled'],
    default: 'draft'
  },
  paymentStatus: {
    type: String,
    enum: ['unpaid', 'partial', 'paid'],
    default: 'unpaid'
  },
  paymentDate: Date,
  invoiceNumber: String,
  notes: String,
  attachments: [{
    name: String,
    url: String,
    uploadedAt: Date
  }],
  history: [{
    action: String,
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    changedAt: {
      type: Date,
      default: Date.now
    },
    details: String
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// Calculate totals
purchaseOrderSchema.methods.calculateTotals = function() {
  this.subtotal = this.lines.reduce((sum, line) => sum + line.totalPrice, 0);
  this.totalAmount = this.subtotal + (this.tax || 0) + (this.shippingCost || 0);
  return this;
};

// Add history entry
purchaseOrderSchema.methods.addHistory = function(action, userId, details) {
  this.history.push({
    action,
    changedBy: userId,
    details
  });
};

// Indexes
purchaseOrderSchema.index({ company: 1, poNumber: 1 });
purchaseOrderSchema.index({ company: 1, supplier: 1 });
purchaseOrderSchema.index({ company: 1, department: 1 });
purchaseOrderSchema.index({ company: 1, status: 1 });
purchaseOrderSchema.index({ company: 1, orderDate: -1 });

module.exports = mongoose.model('PurchaseOrder', purchaseOrderSchema);
