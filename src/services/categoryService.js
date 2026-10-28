
const Category = require('../models/categoryModel');
const {
  httpError,
  objectId,
  pagination,
} = require('./queryValidation');
const { escapeRegex } = require('../utils/regexUtils');

const PUBLIC_FIELDS = '_id name description status createdAt updatedAt';

async function createCategory(data = {}) {
  const name = typeof data.name === 'string' ? data.name.trim() : '';

  if (name.length < 2 || name.length > 150) {
    throw httpError(400, 'El nombre debe tener entre 2 y 150 caracteres');
  }

  const description = data.description === undefined
    ? ''
    : data.description;

  if (typeof description !== 'string' || description.length > 500) {
    throw httpError(400, 'La descripción debe ser un texto de máximo 500 caracteres');
  }

  const existing = await Category.findOne({
    name: { $regex: `^${escapeRegex(name)}$`, $options: 'i' },
  }).lean();

  if (existing) {
    throw httpError(409, 'Ya existe una categoría con ese nombre');
  }

  const category = await Category.create({
    name,
    description: description.trim(),
  });

  return Category.findById(category._id)
    .select(PUBLIC_FIELDS)
    .lean();
}

async function listCategories(query = {}) {
  const { page, limit, skip } = pagination(query);
  const filter = {};

  if (query.status !== undefined) {
    if (!['active', 'inactive'].includes(query.status)) {
      throw httpError(400, 'Estado inválido');
    }

    filter.status = query.status;
  }

  const categories = await Category.find(filter)
    .select(PUBLIC_FIELDS)
    .sort({ name: 1, _id: 1 })
    .skip(skip)
    .limit(limit)
    .lean();

  return { categories, page, limit };
}

async function getCategory(id) {
  objectId(id, 'ID de categoría');

  const category = await Category.findById(id)
    .select(PUBLIC_FIELDS)
    .lean();

  if (!category) {
    throw httpError(404, 'Categoría no encontrada');
  }

  return category;
}

async function updateCategory(id, data = {}) {
  objectId(id, 'ID de categoría');

  const updates = {};

  if (Object.hasOwn(data, 'name')) {
    if (typeof data.name !== 'string') {
      throw httpError(400, 'El nombre debe ser un texto');
    }

    const name = data.name.trim();

    if (name.length < 2 || name.length > 150) {
      throw httpError(400, 'El nombre debe tener entre 2 y 150 caracteres');
    }

    const existing = await Category.findOne({
      _id: { $ne: id },
      name: { $regex: `^${escapeRegex(name)}$`, $options: 'i' },
    }).lean();

    if (existing) {
      throw httpError(409, 'Ya existe una categoría con ese nombre');
    }

    updates.name = name;
  }

  if (Object.hasOwn(data, 'description')) {
    if (
      typeof data.description !== 'string'
      || data.description.length > 500
    ) {
      throw httpError(400, 'La descripción debe ser un texto de máximo 500 caracteres');
    }

    updates.description = data.description.trim();
  }

  if (Object.keys(updates).length === 0) {
    throw httpError(400, 'No hay campos válidos para actualizar');
  }

  const category = await Category.findByIdAndUpdate(
    id,
    { $set: updates },
    { returnDocument: 'after', runValidators: true },
  )
    .select(PUBLIC_FIELDS)
    .lean();

  if (!category) {
    throw httpError(404, 'Categoría no encontrada');
  }

  return category;
}

async function deactivateCategory(id) {
  objectId(id, 'ID de categoría');

  const category = await Category.findByIdAndUpdate(
    id,
    { $set: { status: 'inactive' } },
    { returnDocument: 'after', runValidators: true },
  )
    .select(PUBLIC_FIELDS)
    .lean();

  if (!category) {
    throw httpError(404, 'Categoría no encontrada');
  }

  return category;
}

module.exports = {
  createCategory,
  listCategories,
  getCategory,
  updateCategory,
  deactivateCategory,
};
