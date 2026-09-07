const express = require('express');
const companyController = require('../controllers/companyController');
const auth = require('../middleware/auth');
const multer = require('multer');

const router = express.Router();

// Multer config
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

// All routes require authentication
router.use(auth);

router.get('/', companyController.getAllCompanies);
router.post('/', upload.single('logo'), companyController.createCompany);
router.get('/:id', companyController.getCompany);
router.put('/:id', upload.single('logo'), companyController.updateCompany);
router.delete('/:id', companyController.deleteCompany);

module.exports = router;