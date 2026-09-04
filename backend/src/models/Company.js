const mongoose = require('mongoose');

const companySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  description: String,
  logo: String,
  website: String,
  industry: String,
  maxUsers: {
    type: Number,
    default: 50
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'trial'],
    default: 'trial'
  },
  subscriptionPlan: {
    type: String,
    enum: ['free', 'starter', 'professional', 'enterprise'],
    default: 'free'
  },
  subscriptionEnd: Date,
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  settings: {
    currency: { type: String, default: 'EUR' },
    timezone: { type: String, default: 'UTC' },
    dateFormat: { type: String, default: 'DD/MM/YYYY' }
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

module.exports = mongoose.model('Company', companySchema);
