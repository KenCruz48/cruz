const mongoose = require('mongoose');

const schema = new mongoose.Schema(
  {
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
    },

    registration: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Registration',
      required: true,
    },

    timeMs: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isSafeInteger,
        message: 'El tiempo debe ser un entero válido',
      },
    },

    status: {
      type: String,
      enum: ['finished'],
      default: 'finished',
    },
  },
  {
    timestamps: true,
  }
);

schema.index({
  event: 1,
  timeMs: 1,
  _id: 1,
});

schema.index({
  registration: 1,
  updatedAt: -1,
});

module.exports =
  mongoose.models.Result ||
  mongoose.model(
    'Result',
    schema,
    'results'
  );