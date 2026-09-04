const Permission = require('../models/Permission');
const User = require('../models/User');

// Get all permissions for company
exports.getAllPermissions = async (req, res) => {
  try {
    const permissions = await Permission.find({ company: req.company._id })
      .populate('user', 'firstName lastName email')
      .sort({ resource: 1 });
    
    res.json({ permissions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get permissions for specific user
exports.getUserPermissions = async (req, res) => {
  try {
    const permissions = await Permission.find({
      company: req.company._id,
      user: req.params.userId
    });
    
    if (!permissions) {
      return res.status(404).json({ error: 'Permissions not found' });
    }
    
    res.json({ permissions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Create or update permission
exports.setPermission = async (req, res) => {
  try {
    const { userId, resource, actions, restrictions, expiresAt } = req.body;
    
    // Verify user exists in company
    const user = await User.findOne({
      _id: userId,
      company: req.company._id
    });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Check if permission already exists
    let permission = await Permission.findOne({
      company: req.company._id,
      user: userId,
      resource
    });
    
    if (!permission) {
      permission = new Permission({
        company: req.company._id,
        user: userId,
        resource,
        actions,
        restrictions,
        expiresAt
      });
    } else {
      Object.assign(permission, { actions, restrictions, expiresAt });
    }
    
    await permission.save();
    
    res.status(201).json({
      message: 'Permission set successfully',
      permission
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Delete specific permission
exports.deletePermission = async (req, res) => {
  try {
    const permission = await Permission.findOne({
      _id: req.params.permissionId,
      company: req.company._id
    });
    
    if (!permission) {
      return res.status(404).json({ error: 'Permission not found' });
    }
    
    await Permission.findByIdAndDelete(req.params.permissionId);
    
    res.json({ message: 'Permission deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get available resources and actions
exports.getAvailablePermissions = async (req, res) => {
  try {
    const availablePermissions = {
      resources: [
        'users',
        'articles',
        'categories',
        'projects',
        'payroll',
        'reports',
        'settings',
        'permissions'
      ],
      actions: ['create', 'read', 'update', 'delete', 'approve']
    };
    
    res.json(availablePermissions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Bulk set permissions for multiple users
exports.bulkSetPermissions = async (req, res) => {
  try {
    const { permissions } = req.body;
    const results = [];
    
    for (let perm of permissions) {
      const { userId, resource, actions, restrictions, expiresAt } = perm;
      
      let permission = await Permission.findOne({
        company: req.company._id,
        user: userId,
        resource
      });
      
      if (!permission) {
        permission = new Permission({
          company: req.company._id,
          user: userId,
          resource,
          actions,
          restrictions,
          expiresAt
        });
      } else {
        Object.assign(permission, { actions, restrictions, expiresAt });
      }
      
      await permission.save();
      results.push(permission);
    }
    
    res.status(201).json({
      message: 'Permissions set',
      permissions: results
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = exports;
