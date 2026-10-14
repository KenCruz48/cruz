const mongoose = require('mongoose');
// Persistence contract for RACE-14/17. Creation and cancellation belong to
// their assigned team members; this model supports Kevin's read endpoint.
const schema = new mongoose.Schema({
  event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  participant: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
  status: { type: String, enum: ['active', 'cancelled'], default: 'active' },
}, { timestamps: true });
schema.index({ event: 1, status: 1, _id: 1 });
module.exports = mongoose.models.Registration || mongoose.model('Registration', schema);
