const express = require('express');
const {
  getAllCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getSubCategories,
  createSubCategory,
  updateSubCategory,
  getAllArticles,
  createArticle,
  updateArticle,
  addImage,
  deleteArticle,
  getLowStockArticles
} = require('../controllers/inventoryController');

const router = express.Router();

// Categories
router.get('/categories', getAllCategories);
router.post('/categories', createCategory);
router.put('/categories/:id', updateCategory);
router.delete('/categories/:id', deleteCategory);

// SubCategories
router.get('/subcategories', getSubCategories);
router.post('/subcategories', createSubCategory);
router.put('/subcategories/:id', updateSubCategory);

// Articles
router.get('/articles', getAllArticles);
router.get('/articles/low-stock', getLowStockArticles);
router.post('/articles', createArticle);
router.put('/articles/:id', updateArticle);
router.post('/articles/:id/images', addImage);
router.delete('/articles/:id', deleteArticle);

module.exports = router;
