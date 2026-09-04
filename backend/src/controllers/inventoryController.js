const { Category, SubCategory, Article } = require('../models/Inventory');
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// ===== CATEGORIES =====

exports.getAllCategories = async (req, res) => {
  try {
    const categories = await Category.find({ company: req.company._id });
    res.json({ categories });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createCategory = async (req, res) => {
  try {
    const { name, description, color } = req.body;
    
    const category = new Category({
      company: req.company._id,
      name,
      description,
      color
    });
    
    await category.save();
    res.status(201).json({ message: 'Category created', category });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateCategory = async (req, res) => {
  try {
    const { name, description, color } = req.body;
    
    const category = await Category.findOne({
      _id: req.params.id,
      company: req.company._id
    });
    
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }
    
    Object.assign(category, { name, description, color });
    await category.save();
    
    res.json({ message: 'Category updated', category });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteCategory = async (req, res) => {
  try {
    const category = await Category.findOne({
      _id: req.params.id,
      company: req.company._id
    });
    
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }
    
    // Check if category has subcategories
    const subCount = await SubCategory.countDocuments({ category: category._id });
    if (subCount > 0) {
      return res.status(400).json({ error: 'Cannot delete category with subcategories' });
    }
    
    await Category.findByIdAndDelete(req.params.id);
    res.json({ message: 'Category deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ===== SUBCATEGORIES =====

exports.getSubCategories = async (req, res) => {
  try {
    const { categoryId } = req.query;
    const query = { company: req.company._id };
    
    if (categoryId) {
      query.category = categoryId;
    }
    
    const subCategories = await SubCategory.find(query).populate('category');
    res.json({ subCategories });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createSubCategory = async (req, res) => {
  try {
    const { categoryId, name, description } = req.body;
    
    // Verify category exists
    const category = await Category.findOne({
      _id: categoryId,
      company: req.company._id
    });
    
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }
    
    const subCategory = new SubCategory({
      company: req.company._id,
      category: categoryId,
      name,
      description
    });
    
    await subCategory.save();
    res.status(201).json({ message: 'SubCategory created', subCategory });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateSubCategory = async (req, res) => {
  try {
    const { name, description } = req.body;
    
    const subCategory = await SubCategory.findOne({
      _id: req.params.id,
      company: req.company._id
    });
    
    if (!subCategory) {
      return res.status(404).json({ error: 'SubCategory not found' });
    }
    
    Object.assign(subCategory, { name, description });
    await subCategory.save();
    
    res.json({ message: 'SubCategory updated', subCategory });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ===== ARTICLES =====

exports.getAllArticles = async (req, res) => {
  try {
    const { subCategoryId, status } = req.query;
    const query = { company: req.company._id };
    
    if (subCategoryId) query.subCategory = subCategoryId;
    if (status) query.status = status;
    
    const articles = await Article.find(query)
      .populate('category subCategory');
    
    res.json({ articles });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createArticle = async (req, res) => {
  try {
    const { 
      subCategoryId, 
      categoryId,
      name, 
      description, 
      sku, 
      unit, 
      quantity,
      minQuantity,
      unitPrice,
      imageUrl
    } = req.body;
    
    // Check SKU uniqueness
    const existingSku = await Article.findOne({ 
      company: req.company._id,
      sku 
    });
    
    if (existingSku) {
      return res.status(400).json({ error: 'SKU already exists' });
    }
    
    const article = new Article({
      company: req.company._id,
      subCategory: subCategoryId,
      category: categoryId,
      name,
      description,
      sku,
      unit,
      quantity,
      minQuantity,
      unitPrice
    });
    
    // Handle image URL if provided
    if (imageUrl) {
      article.images.push({
        url: imageUrl,
        source: 'url'
      });
    }
    
    await article.save();
    res.status(201).json({ message: 'Article created', article });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateArticle = async (req, res) => {
  try {
    const { name, description, quantity, minQuantity, unitPrice, status } = req.body;
    
    const article = await Article.findOne({
      _id: req.params.id,
      company: req.company._id
    });
    
    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }
    
    Object.assign(article, { name, description, quantity, minQuantity, unitPrice, status });
    await article.save();
    
    res.json({ message: 'Article updated', article });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.addImage = async (req, res) => {
  try {
    const article = await Article.findOne({
      _id: req.params.id,
      company: req.company._id
    });
    
    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }
    
    const { imageUrl, source } = req.body; // source: 'url' | 'camera' | 'upload'
    
    // If upload from file (would come from multer middleware)
    if (req.file) {
      try {
        const result = await cloudinary.uploader.upload(req.file.path);
        article.images.push({
          url: result.secure_url,
          publicId: result.public_id,
          source: 'upload'
        });
      } catch (cloudErr) {
        return res.status(500).json({ error: 'Image upload failed' });
      }
    } else if (imageUrl) {
      article.images.push({
        url: imageUrl,
        source: source || 'url'
      });
    }
    
    await article.save();
    res.json({ message: 'Image added', article });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteArticle = async (req, res) => {
  try {
    const article = await Article.findOne({
      _id: req.params.id,
      company: req.company._id
    });
    
    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }
    
    // Delete images from Cloudinary
    for (let img of article.images) {
      if (img.publicId) {
        await cloudinary.uploader.destroy(img.publicId);
      }
    }
    
    await Article.findByIdAndDelete(req.params.id);
    res.json({ message: 'Article deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get low stock articles
exports.getLowStockArticles = async (req, res) => {
  try {
    const articles = await Article.find({
      company: req.company._id,
      status: 'active',
      $expr: { $lte: ['$quantity', '$minQuantity'] }
    });
    
    res.json({ articles });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = exports;
