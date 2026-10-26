const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 150,
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500,
    default: '',
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active',
  },
}, { timestamps: true });

schema.index({ name: 1 });

module.exports = mongoose.models.Category
  || mongoose.model('Category', schema);