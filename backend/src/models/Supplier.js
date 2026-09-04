const mongoose = require('mongoose');

const supplierSchema = new mongoose.Schema({
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  },
  name: {
    type: String,
    required: true
  },
  email: String,
  phone: String,
  address: String,
  city: String,
  country: String,
  postalCode: String,
  contactPerson: String,
  paymentTerms: String,
  currency: { type: String, default: 'EUR' },
  minOrderQuantity: { type: Number, default: 1 },
  deliveryDays: { type: Number, default: 7 },
  rating: { type: Number, min: 0, max: 5, default: 0 },
  status: {
    type: String,
    enum: ['active', 'inactive', 'blocked'],
    default: 'active'
  },
  notes: String,
  bankDetails: {
    accountHolder: String,
    iban: String,
    swift: String
  },
  taxId: String,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

supplierSchema.index({ company: 1, name: 1 });

module.exports = mongoose.model('Supplier', supplierSchema);
