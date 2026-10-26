
const Registration = require('../models/registrationModel');
const { httpError, objectId } = require('./queryValidation');

async function assertNoActiveDuplicate(eventId, participantId) {
  objectId(eventId, 'ID de evento');
  objectId(participantId, 'ID de participante');

  const existing = await Registration.exists({
    event: eventId,
    participant: participantId,
    status: 'active',
  });

  if (existing) {
    throw httpError(
      409,
      'El participante ya tiene una inscripcion activa en este evento',
    );
  }
}

module.exports = { assertNoActiveDuplicate };
