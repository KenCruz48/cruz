const categoryService = require('../services/categoryService');

async function createCategory(req, res, next) {
  try {
    const category = await categoryService.createCategory(req.body);

    return res.status(201).json({
      status: 'success',
      data: category,
    });
  } catch (error) {
    return next(error);
  }
}

async function listCategories(req, res, next) {
  try {
    const result = await categoryService.listCategories(req.query);

    return res.status(200).json({
      status: 'success',
      data: result.categories,
      pagination: {
        page: result.page,
        limit: result.limit,
      },
    });
  } catch (error) {
    return next(error);
  }
}

async function getCategory(req, res, next) {
  try {
    const category = await categoryService.getCategory(req.params.id);

    return res.status(200).json({
      status: 'success',
      data: category,
    });
  } catch (error) {
    return next(error);
  }
}

async function updateCategory(req, res, next) {
  try {
    const category = await categoryService.updateCategory(
      req.params.id,
      req.body,
    );

    return res.status(200).json({
      status: 'success',
      data: category,
    });
  } catch (error) {
    return next(error);
  }
}

async function deactivateCategory(req, res, next) {
  try {
    const category = await categoryService.deactivateCategory(req.params.id);

    return res.status(200).json({
      status: 'success',
      data: category,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createCategory,
  listCategories,
  getCategory,
  updateCategory,
  deactivateCategory,
};