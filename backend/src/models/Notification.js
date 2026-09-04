const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  // Target by role or department if no specific user
  targetRole: {
    type: String,
    enum: ['admin', 'manager', 'supervisor', 'staff', null],
    default: null
  },
  targetDepartment: String,
  
  // Notification details
  type: {
    type: String,
    enum: [
      'purchase_order_created',
      'purchase_order_approved',
      'purchase_order_received',
      'low_stock_alert',
      'supplier_message',
      'payment_due',
      'permission_granted',
      'user_action_required',
      'general'
    ],
    required: true
  },
  
  title: {
    type: String,
    required: true
  },
  
  message: {
    type: String,
    required: true
  },
  
  icon: {
    type: String,
    default: 'info' // info, success, warning, error, alert, document, package, etc.
  },
  
  relatedResource: {
    resourceType: String, // 'purchase_order', 'article', 'user', etc.
    resourceId: mongoose.Schema.Types.ObjectId
  },
  
  actionUrl: String, // Link to related resource
  
  isRead: {
    type: Boolean,
    default: false
  },
  
  readAt: Date,
  
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },
  
  expiresAt: Date, // Auto-delete old notifications
  
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// Auto-delete expired notifications
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Indexes for quick queries
notificationSchema.index({ company: 1, user: 1, isRead: 1 });
notificationSchema.index({ company: 1, user: 1, createdAt: -1 });
notificationSchema.index({ company: 1, targetRole: 1, targetDepartment: 1 });

// Mark as read
notificationSchema.methods.markAsRead = function() {
  this.isRead = true;
  this.readAt = new Date();
  return this.save();
};

// Get unread count for user
notificationSchema.statics.getUnreadCount = function(userId) {
  return this.countDocuments({
    user: userId,
    isRead: false
  });
};

module.exports = mongoose.model('Notification', notificationSchema);
