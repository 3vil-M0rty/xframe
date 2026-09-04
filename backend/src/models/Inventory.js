const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  },
  name: {
    type: String,
    required: true
  },
  description: String,
  color: { type: String, default: '#000000' },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

categorySchema.index({ company: 1, name: 1 });

const subCategorySchema = new mongoose.Schema({
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true
  },
  name: {
    type: String,
    required: true
  },
  description: String,
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

subCategorySchema.index({ company: 1, category: 1 });

const articleSchema = new mongoose.Schema({
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  },
  subCategory: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SubCategory',
    required: true
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true
  },
  // Multi-language names
  names: {
    en: {
      type: String,
      required: true
    },
    fr: {
      type: String,
      required: true
    },
    ar: {
      type: String,
      required: true
    }
  },
  // References
  internalReference: {
    type: String,
    required: true,
    unique: true
  },
  supplierReference: String,
  supplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier'
  },
  description: String,
  sku: {
    type: String,
    required: true,
    unique: true
  },
  unit: {
    type: String,
    enum: ['kg', 'pieces', 'meters', 'liters', 'boxes', 'pallets'],
    default: 'kg'
  },
  quantity: {
    type: Number,
    default: 0
  },
  minQuantity: {
    type: Number,
    default: 0
  },
  // Pricing
  unitPrice: {
    type: Number,
    required: true
  },
  supplierPrice: Number,
  currency: { type: String, default: 'EUR' },
  lastPriceUpdate: Date,
  // Lead time
  leadTimeDays: { type: Number, default: 7 },
  images: [{
    url: String,
    publicId: String,
    uploadedAt: { type: Date, default: Date.now },
    source: { type: String, enum: ['upload', 'url', 'camera'] }
  }],
  status: {
    type: String,
    enum: ['active', 'inactive', 'discontinued'],
    default: 'active'
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

articleSchema.index({ company: 1, sku: 1 });
articleSchema.index({ company: 1, subCategory: 1 });
articleSchema.index({ company: 1, internalReference: 1 });
articleSchema.index({ company: 1, supplier: 1 });

// Check stock level
articleSchema.methods.isLowStock = function() {
  return this.quantity <= this.minQuantity;
};

// Get best name in language
articleSchema.methods.getName = function(language = 'en') {
  return this.names[language] || this.names.en || 'Unknown';
};

module.exports = {
  Category: mongoose.model('Category', categorySchema),
  SubCategory: mongoose.model('SubCategory', subCategorySchema),
  Article: mongoose.model('Article', articleSchema)
};

