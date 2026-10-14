const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 150 },
  date: { type: Date, required: true },
  location: { type: String, required: true, trim: true, maxlength: 200 },
  distance: { type: Number, required: true, min: 0.1 },
  capacity: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
  registeredCount: { type: Number, default: 0, min: 0, validate: Number.isSafeInteger },
  status: { type: String, enum: ['active', 'cancelled'], default: 'active' },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });
schema.index({ date: 1, _id: 1 });
module.exports = mongoose.models.Event || mongoose.model('Event', schema);
