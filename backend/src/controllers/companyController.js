const Company = require('../models/Company');
const User = require('../models/User');

// Get company details
exports.getCompany = async (req, res) => {
  try {
    const company = await Company.findById(req.company._id)
      .populate('owner', 'firstName lastName email');
    
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }
    
    res.json({ company });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update company settings
exports.updateCompany = async (req, res) => {
  try {
    const { name, description, website, industry } = req.body;
    
    const company = await Company.findById(req.company._id);
    
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }
    
    // Only allow owner to update
    const user = await User.findById(req.user.id);
    if (company.owner.toString() !== user._id.toString() && user.role !== 'admin') {
      return res.status(403).json({ error: 'Only owner can update company' });
    }
    
    Object.assign(company, { name, description, website, industry });
    await company.save();
    
    res.json({ message: 'Company updated', company });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update company settings (currency, timezone, etc)
exports.updateSettings = async (req, res) => {
  try {
    const { currency, timezone, dateFormat } = req.body;
    
    const company = await Company.findById(req.company._id);
    
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }
    
    company.settings = {
      currency: currency || company.settings.currency,
      timezone: timezone || company.settings.timezone,
      dateFormat: dateFormat || company.settings.dateFormat
    };
    
    await company.save();
    
    res.json({ message: 'Settings updated', settings: company.settings });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get company statistics
exports.getStats = async (req, res) => {
  try {
    const User = require('../models/User');
    const { Article } = require('../models/Inventory');
    const Project = require('../models/Project');
    const Payroll = require('../models/Payroll');
    
    const stats = {
      totalUsers: await User.countDocuments({ company: req.company._id }),
      activeUsers: await User.countDocuments({ 
        company: req.company._id,
        status: 'active'
      }),
      totalArticles: await Article.countDocuments({ company: req.company._id }),
      activeArticles: await Article.countDocuments({
        company: req.company._id,
        status: 'active'
      }),
      lowStockArticles: await Article.countDocuments({
        company: req.company._id,
        $expr: { $lte: ['$quantity', '$minQuantity'] }
      }),
      totalProjects: await Project.countDocuments({ company: req.company._id }),
      activeProjects: await Project.countDocuments({
        company: req.company._id,
        status: { $in: ['planning', 'in-progress'] }
      }),
      completedProjects: await Project.countDocuments({
        company: req.company._id,
        status: 'completed'
      })
    };
    
    res.json({ stats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Invite user to company
exports.inviteUser = async (req, res) => {
  try {
    const { email, role } = req.body;
    
    const existingUser = await User.findOne({ email });
    
    if (existingUser && existingUser.company.toString() === req.company._id.toString()) {
      return res.status(400).json({ error: 'User already in company' });
    }
    
    // In production, send email invitation here
    // For now, return invitation details
    
    res.json({
      message: 'Invitation prepared',
      invitation: {
        email,
        role,
        company: req.company.name,
        joinLink: `${process.env.FRONTEND_URL}/join?token=xxx&company=${req.company.slug}`
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = exports;
