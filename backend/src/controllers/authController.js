const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Company = require('../models/Company');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Register new company and owner
exports.registerCompany = async (req, res) => {
  try {
    const { companyName, companySlug, email, password, firstName, lastName } = req.body;
    
    // Check if company already exists
    const existingCompany = await Company.findOne({ slug: companySlug.toLowerCase() });
    if (existingCompany) {
      return res.status(400).json({ error: 'Company slug already exists' });
    }
    
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }
    
    // Create company
    const company = new Company({
      name: companyName,
      slug: companySlug.toLowerCase(),
      owner: new User().id // Placeholder, will update after user creation
    });
    
    // Create user
    const user = new User({
      email,
      password,
      firstName,
      lastName,
      company: company._id,
      role: 'admin'
    });
    
    company.owner = user._id;
    
    await user.save();
    await company.save();
    
    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '30d' }
    );
    
    res.status(201).json({
      message: 'Company registered successfully',
      token,
      user: user.toJSON(),
      company: { id: company._id, name: company.name, slug: company.slug }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const user = await User.findOne({ email }).populate('company');
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    user.lastLogin = new Date();
    await user.save();
    
    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '30d' }
    );
    
    res.json({
      message: 'Login successful',
      token,
      user: user.toJSON(),
      company: {
        id: user.company._id,
        name: user.company.name,
        slug: user.company.slug
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get current user
exports.getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .populate('company')
      .populate('permissions');
    
    res.json({ user: user.toJSON() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Change password
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    const user = await User.findById(req.user.id);
    const isPasswordValid = await user.comparePassword(currentPassword);
    
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }
    
    user.password = newPassword;
    await user.save();
    
    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = exports;
