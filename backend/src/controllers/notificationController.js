const Notification = require('../models/Notification');
const User = require('../models/User');

// Get user's notifications
exports.getUserNotifications = async (req, res) => {
  try {
    const { unreadOnly, limit = 50 } = req.query;
    const query = {
      company: req.company._id,
      $or: [
        { user: req.user.id },
        { targetRole: req.user.role },
        { targetDepartment: req.user.department }
      ]
    };
    
    if (unreadOnly === 'true') {
      query.isRead = false;
    }
    
    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));
    
    const unreadCount = await Notification.countDocuments({
      company: req.company._id,
      user: req.user.id,
      isRead: false
    });
    
    res.json({ notifications, unreadCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get unread count
exports.getUnreadCount = async (req, res) => {
  try {
    const unreadCount = await Notification.countDocuments({
      company: req.company._id,
      user: req.user.id,
      isRead: false
    });
    
    res.json({ unreadCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Mark notification as read
exports.markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findOne({
      _id: req.params.id,
      company: req.company._id
    });
    
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    
    await notification.markAsRead();
    
    res.json({ message: 'Notification marked as read', notification });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Mark all as read
exports.markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      {
        company: req.company._id,
        user: req.user.id,
        isRead: false
      },
      {
        isRead: true,
        readAt: new Date()
      }
    );
    
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Delete notification
exports.deleteNotification = async (req, res) => {
  try {
    const notification = await Notification.findOne({
      _id: req.params.id,
      company: req.company._id,
      user: req.user.id
    });
    
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    
    await Notification.findByIdAndDelete(req.params.id);
    
    res.json({ message: 'Notification deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Create notification (internal - called by other controllers)
exports.createNotification = async (notificationData) => {
  try {
    // If no specific user, find users by role/department
    if (!notificationData.user && (notificationData.targetRole || notificationData.targetDepartment)) {
      const query = { company: notificationData.company };
      
      if (notificationData.targetRole) {
        query.role = notificationData.targetRole;
      }
      if (notificationData.targetDepartment) {
        query.department = notificationData.targetDepartment;
      }
      
      const users = await User.find(query);
      
      // Create notification for each user
      for (let user of users) {
        await Notification.create({
          ...notificationData,
          user: user._id
        });
      }
    } else {
      // Create for specific user
      await Notification.create(notificationData);
    }
  } catch (err) {
    console.error('Error creating notification:', err);
  }
};

// Get notification stats
exports.getNotificationStats = async (req, res) => {
  try {
    const stats = {
      unread: await Notification.countDocuments({
        company: req.company._id,
        user: req.user.id,
        isRead: false
      }),
      byPriority: await Notification.aggregate([
        {
          $match: {
            company: req.company._id,
            user: req.user.id
          }
        },
        {
          $group: {
            _id: '$priority',
            count: { $sum: 1 }
          }
        }
      ]),
      byType: await Notification.aggregate([
        {
          $match: {
            company: req.company._id,
            user: req.user.id
          }
        },
        {
          $group: {
            _id: '$type',
            count: { $sum: 1 }
          }
        }
      ])
    };
    
    res.json({ stats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = exports;
