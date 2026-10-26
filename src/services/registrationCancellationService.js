
const mongoose = require('mongoose');
const Registration = require('../models/registrationModel');
const Event = require('../models/eventModel');
const { httpError, objectId } = require('./queryValidation');

async function cancelRegistration(registrationId, participantId) {
  objectId(registrationId, 'ID de inscripción');
  objectId(participantId, 'ID de participante');

  return mongoose.connection.transaction(async session => {
    const registration = await Registration.findById(registrationId)
      .session(session)
      .lean();

    if (!registration) {
      throw httpError(404, 'Inscripción no encontrada');
    }

    if (String(registration.participant) !== participantId) {
      throw httpError(403, 'No puedes cancelar la inscripción de otro participante');
    }

    if (registration.status !== 'active') {
      throw httpError(409, 'La inscripción ya está cancelada');
    }

    const cancelled = await Registration.findOneAndUpdate(
      {
        _id: registrationId,
        participant: participantId,
        status: 'active',
      },
      { $set: { status: 'cancelled' } },
      { new: true, session, runValidators: true },
    );

    if (!cancelled) {
      throw httpError(409, 'La inscripción ya no está activa');
    }

    const event = await Event.findOneAndUpdate(
      {
        _id: registration.event,
        registeredCount: { $gt: 0 },
      },
      { $inc: { registeredCount: -1 } },
      { new: true, session },
    );

    if (!event) {
      throw new Error('No se pudo actualizar el contador de inscripciones del evento');
    }

    return {
      id: cancelled._id,
      event: cancelled.event,
      participant: cancelled.participant,
      category: cancelled.category,
      status: cancelled.status,
      createdAt: cancelled.createdAt,
      updatedAt: cancelled.updatedAt,
    };
  });
}

module.exports = { cancelRegistration };
