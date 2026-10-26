const express = require('express');
const categoryController = require('../controllers/categoryController');

const router = express.Router();

router.post('/', categoryController.createCategory);
router.get('/', categoryController.listCategories);
router.get('/:id', categoryController.getCategory);
router.patch('/:id', categoryController.updateCategory);
router.patch('/:id/deactivate', categoryController.deactivateCategory);

module.exports = router;