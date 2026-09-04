const Supplier = require('../models/Supplier');

// Get all suppliers
exports.getAllSuppliers = async (req, res) => {
  try {
    const { status } = req.query;
    const query = { company: req.company._id };
    
    if (status) query.status = status;
    
    const suppliers = await Supplier.find(query).sort({ name: 1 });
    
    res.json({ suppliers });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get supplier by ID
exports.getSupplierById = async (req, res) => {
  try {
    const supplier = await Supplier.findOne({
      _id: req.params.id,
      company: req.company._id
    });
    
    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found' });
    }
    
    res.json({ supplier });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Create supplier
exports.createSupplier = async (req, res) => {
  try {
    const { name, email, phone, address, city, country, postalCode, contactPerson, currency, minOrderQuantity, deliveryDays } = req.body;
    
    // Check if supplier already exists
    const existing = await Supplier.findOne({
      company: req.company._id,
      name: name.toLowerCase()
    });
    
    if (existing) {
      return res.status(400).json({ error: 'Supplier already exists' });
    }
    
    const supplier = new Supplier({
      company: req.company._id,
      name,
      email,
      phone,
      address,
      city,
      country,
      postalCode,
      contactPerson,
      currency: currency || 'EUR',
      minOrderQuantity: minOrderQuantity || 1,
      deliveryDays: deliveryDays || 7
    });
    
    await supplier.save();
    
    res.status(201).json({
      message: 'Supplier created successfully',
      supplier
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update supplier
exports.updateSupplier = async (req, res) => {
  try {
    const { name, email, phone, address, city, country, postalCode, contactPerson, currency, minOrderQuantity, deliveryDays, rating, status, notes, bankDetails, taxId } = req.body;
    
    const supplier = await Supplier.findOne({
      _id: req.params.id,
      company: req.company._id
    });
    
    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found' });
    }
    
    Object.assign(supplier, {
      name, email, phone, address, city, country, postalCode, contactPerson,
      currency, minOrderQuantity, deliveryDays, rating, status, notes, bankDetails, taxId
    });
    
    await supplier.save();
    
    res.json({ message: 'Supplier updated successfully', supplier });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Delete supplier
exports.deleteSupplier = async (req, res) => {
  try {
    const supplier = await Supplier.findOne({
      _id: req.params.id,
      company: req.company._id
    });
    
    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found' });
    }
    
    await Supplier.findByIdAndDelete(req.params.id);
    
    res.json({ message: 'Supplier deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get supplier by status
exports.getSuppliersByStatus = async (req, res) => {
  try {
    const { status } = req.params;
    
    const suppliers = await Supplier.find({
      company: req.company._id,
      status
    }).sort({ rating: -1 });
    
    res.json({ suppliers });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = exports;
