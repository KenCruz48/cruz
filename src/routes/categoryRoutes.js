const express = require('express');
const categoryController = require('../controllers/categoryController');
const authMiddleware = require('../middlewares/authMiddleware');

const router = express.Router();

router.post('/', authMiddleware, categoryController.createCategory);
router.get('/', categoryController.listCategories);
router.get('/:id', categoryController.getCategory);
router.patch('/:id', authMiddleware, categoryController.updateCategory);
router.patch('/:id/deactivate', authMiddleware, categoryController.deactivateCategory);

module.exports = router;
