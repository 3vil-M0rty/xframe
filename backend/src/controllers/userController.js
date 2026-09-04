const User = require('../models/User');
const Company = require('../models/Company');
const Permission = require('../models/Permission');

// Get all users in company
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find({ company: req.company._id })
      .populate('permissions')
      .select('-password');
    
    res.json({ users });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get user by ID
exports.getUserById = async (req, res) => {
  try {
    const user = await User.findOne({
      _id: req.params.id,
      company: req.company._id
    }).populate('permissions').select('-password');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Create new user
exports.createUser = async (req, res) => {
  try {
    const { email, firstName, lastName, phone, role, department } = req.body;
    
    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already exists' });
    }
    
    const user = new User({
      email,
      firstName,
      lastName,
      phone,
      company: req.company._id,
      role,
      department,
      password: Math.random().toString(36).slice(-8) // Temporary password
    });
    
    await user.save();
    
    res.status(201).json({
      message: 'User created successfully',
      user: user.toJSON()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update user
exports.updateUser = async (req, res) => {
  try {
    const { firstName, lastName, phone, role, department, status } = req.body;
    
    const user = await User.findOne({
      _id: req.params.id,
      company: req.company._id
    });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Only admins can change role
    if (req.userRole !== 'admin' && req.body.role) {
      return res.status(403).json({ error: 'Only admins can change roles' });
    }
    
    Object.assign(user, { firstName, lastName, phone, role, department, status });
    await user.save();
    
    res.json({ message: 'User updated successfully', user: user.toJSON() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Delete user
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findOne({
      _id: req.params.id,
      company: req.company._id
    });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Prevent deletion of company owner
    const company = await Company.findById(req.company._id);
    if (company.owner.toString() === user._id.toString()) {
      return res.status(400).json({ error: 'Cannot delete company owner' });
    }
    
    await User.findByIdAndDelete(req.params.id);
    await Permission.deleteMany({ user: req.params.id });
    
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Bulk update permissions for user
exports.updateUserPermissions = async (req, res) => {
  try {
    const { permissions } = req.body;
    
    const user = await User.findOne({
      _id: req.params.id,
      company: req.company._id
    });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Remove old permissions
    await Permission.deleteMany({ user: user._id });
    
    // Create new permissions
    const newPermissions = [];
    for (let perm of permissions) {
      const permission = new Permission({
        company: req.company._id,
        user: user._id,
        ...perm
      });
      await permission.save();
      newPermissions.push(permission);
    }
    
    user.permissions = newPermissions.map(p => p._id);
    await user.save();
    
    res.json({
      message: 'User permissions updated',
      permissions: newPermissions
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = exports;
