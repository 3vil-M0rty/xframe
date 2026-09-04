const mongoose = require('mongoose');

const permissionSchema = new mongoose.Schema({
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  resource: {
    type: String,
    enum: [
      'users',
      'articles',
      'categories',
      'projects',
      'payroll',
      'reports',
      'settings',
      'permissions'
    ],
    required: true
  },
  actions: [{
    type: String,
    enum: ['create', 'read', 'update', 'delete', 'approve'],
  }],
  restrictions: {
    limitToOwnData: { type: Boolean, default: false },
    limitToDepartment: { type: Boolean, default: false },
    department: String
  },
  expiresAt: Date,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// Compound index for quick lookup
permissionSchema.index({ company: 1, user: 1, resource: 1 });

module.exports = mongoose.model('Permission', permissionSchema);
