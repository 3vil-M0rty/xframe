const Company = require('../models/Company');
const multer = require('multer');
const path = require('path');

// Multer config for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.'));
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

// Get all companies for current user
exports.getAllCompanies = async (req, res) => {
  try {
    const companies = await Company.find({ owner: req.user.id }).sort({ createdAt: -1 });
    res.json({
      message: 'Companies fetched successfully',
      data: companies,
      count: companies.length
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get single company
exports.getCompany = async (req, res) => {
  try {
    const company = await Company.findById(req.params.id);
    if (!company) return res.status(404).json({ message: 'Company not found' });
    if (company.owner.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    res.json({ message: 'Company fetched successfully', data: company });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create company
exports.createCompany = async (req, res) => {
  try {
    const { name, legalForm, industry } = req.body;
    if (!name || !legalForm || !industry) {
      return res.status(400).json({ message: 'Name, legal form, and industry are required' });
    }

    // Parse address if it's JSON string
    let address = req.body.address;
    if (typeof address === 'string') {
      address = JSON.parse(address);
    }

    const company = new Company({
      name: req.body.name,
      legalForm: req.body.legalForm,
      registrationNumber: req.body.registrationNumber,
      taxId: req.body.taxId,
      industry: req.body.industry,
      email: req.body.email,
      phone: req.body.phone,
      address,
      website: req.body.website,
      size: req.body.size,
      employeeCount: req.body.employeeCount,
      currency: req.body.currency,
      owner: req.user.id,
      settings: {
        theme: {
          primaryColor: req.body.primaryColor || '#3b82f6',
          secondaryColor: req.body.secondaryColor || '#10b981'
        },
        language: req.body.language || 'fr'
      }
    });

    // Handle file upload (Cloudinary would go here in production)
    if (req.file) {
      company.logo = {
        url: `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`,
        publicId: req.file.fieldname
      };
    }

    await company.save();
    res.status(201).json({ message: 'Company created successfully', data: company });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Registration number or tax ID already exists' });
    }
    res.status(500).json({ message: error.message });
  }
};

// Update company
exports.updateCompany = async (req, res) => {
  try {
    const company = await Company.findById(req.params.id);
    if (!company) return res.status(404).json({ message: 'Company not found' });
    if (company.owner.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Update all fields except owner
    Object.keys(req.body).forEach(key => {
      if (key !== 'owner' && key !== 'address') {
        company[key] = req.body[key];
      }
    });

    // Handle address separately if it's JSON string
    if (req.body.address) {
      company.address = typeof req.body.address === 'string' 
        ? JSON.parse(req.body.address) 
        : req.body.address;
    }

    // Handle file upload
    if (req.file) {
      company.logo = {
        url: `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`,
        publicId: req.file.fieldname
      };
    }

    await company.save();
    res.json({ message: 'Company updated successfully', data: company });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete company
exports.deleteCompany = async (req, res) => {
  try {
    const company = await Company.findById(req.params.id);
    if (!company) return res.status(404).json({ message: 'Company not found' });
    if (company.owner.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    await Company.findByIdAndDelete(req.params.id);
    res.json({ message: 'Company deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports.upload = upload.single('logo');
