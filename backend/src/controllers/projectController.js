const Project = require('../models/Project');
const { Article } = require('../models/Inventory');

// Get all projects
exports.getAllProjects = async (req, res) => {
  try {
    const { status } = req.query;
    const query = { company: req.company._id };
    
    if (status) query.status = status;
    
    const projects = await Project.find(query)
      .populate('manager')
      .populate('consumption.article');
    
    res.json({ projects });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get project by ID
exports.getProjectById = async (req, res) => {
  try {
    const project = await Project.findOne({
      _id: req.params.id,
      company: req.company._id
    }).populate('manager').populate('consumption.article');
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    res.json({ project });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Create project
exports.createProject = async (req, res) => {
  try {
    const { name, description, projectCode, startDate, endDate, managerId, budget } = req.body;
    
    // Check project code uniqueness
    const existingCode = await Project.findOne({
      company: req.company._id,
      projectCode
    });
    
    if (existingCode) {
      return res.status(400).json({ error: 'Project code already exists' });
    }
    
    const project = new Project({
      company: req.company._id,
      name,
      description,
      projectCode,
      startDate,
      endDate,
      manager: managerId,
      budget,
      status: 'planning'
    });
    
    await project.save();
    await project.populate('manager');
    
    res.status(201).json({ message: 'Project created', project });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update project
exports.updateProject = async (req, res) => {
  try {
    const { name, description, startDate, endDate, status, managerId, budget } = req.body;
    
    const project = await Project.findOne({
      _id: req.params.id,
      company: req.company._id
    });
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    Object.assign(project, {
      name, description, startDate, endDate, status, manager: managerId, budget
    });
    
    await project.save();
    res.json({ message: 'Project updated', project });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Add consumption to project
exports.addConsumption = async (req, res) => {
  try {
    const { articleId, quantity, date, notes } = req.body;
    
    const project = await Project.findOne({
      _id: req.params.id,
      company: req.company._id
    });
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Get article to verify it exists and get unit
    const article = await Article.findOne({
      _id: articleId,
      company: req.company._id
    });
    
    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }
    
    // Deduct from article stock
    if (article.quantity < quantity) {
      return res.status(400).json({ error: 'Insufficient stock' });
    }
    
    article.quantity -= quantity;
    await article.save();
    
    // Add consumption record
    project.consumption.push({
      article: articleId,
      quantity,
      unit: article.unit,
      date: date || new Date(),
      notes
    });
    
    // Calculate total value
    await project.calculateTotalValue();
    await project.save();
    
    res.json({ message: 'Consumption added', project });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Remove consumption record
exports.removeConsumption = async (req, res) => {
  try {
    const { consumptionId } = req.body;
    
    const project = await Project.findOne({
      _id: req.params.id,
      company: req.company._id
    });
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const consumption = project.consumption.id(consumptionId);
    if (!consumption) {
      return res.status(404).json({ error: 'Consumption record not found' });
    }
    
    // Restore article stock
    const article = await Article.findById(consumption.article);
    if (article) {
      article.quantity += consumption.quantity;
      await article.save();
    }
    
    consumption.deleteOne();
    await project.calculateTotalValue();
    await project.save();
    
    res.json({ message: 'Consumption removed', project });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get project consumption summary
exports.getConsumptionSummary = async (req, res) => {
  try {
    const project = await Project.findOne({
      _id: req.params.id,
      company: req.company._id
    }).populate('consumption.article');
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const summary = {
      totalConsumptionValue: project.totalConsumptionValue,
      totalItems: project.consumption.length,
      consumption: project.consumption.map(c => ({
        article: c.article.name,
        sku: c.article.sku,
        quantity: c.quantity,
        unit: c.unit,
        unitPrice: c.article.unitPrice,
        totalValue: c.quantity * c.article.unitPrice,
        date: c.date
      }))
    };
    
    res.json({ summary });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Delete project
exports.deleteProject = async (req, res) => {
  try {
    const project = await Project.findOne({
      _id: req.params.id,
      company: req.company._id
    });
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Restore stock if project is deleted
    for (let consumption of project.consumption) {
      const article = await Article.findById(consumption.article);
      if (article) {
        article.quantity += consumption.quantity;
        await article.save();
      }
    }
    
    await Project.findByIdAndDelete(req.params.id);
    res.json({ message: 'Project deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = exports;
