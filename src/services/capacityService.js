const mongoose = require('mongoose');
const Event = require('../models/eventModel');
const { httpError, objectId } = require('./queryValidation');

// RACE-14 passes its writer here. Both writes must share the same transaction.
async function withReservedCapacity(eventId, persistRegistration) {
  objectId(eventId, 'ID de evento');
  if (typeof persistRegistration !== 'function') throw new TypeError('Se requiere persistRegistration');
  return mongoose.connection.transaction(async session => {
    const event = await Event.findOneAndUpdate({
      _id: eventId, status: 'active', date: { $gt: new Date() },
      $expr: { $lt: ['$registeredCount', '$capacity'] },
    }, { $inc: { registeredCount: 1 } }, { session, returnDocument: 'after' });
    if (!event) {
      const existing = await Event.findById(eventId).session(session).lean();
      if (!existing) throw httpError(404, 'Evento no encontrado');
      if (existing.status !== 'active') throw httpError(409, 'Evento cancelado');
      if (new Date(existing.date) <= new Date()) throw httpError(409, 'Evento iniciado');
      throw httpError(409, 'Cupo agotado');
    }
    return persistRegistration(session, event);
  });
}
module.exports = { withReservedCapacity };
