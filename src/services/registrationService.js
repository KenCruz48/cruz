const Registration = require('../models/registrationModel');
const Category = require('../models/categoryModel');
const {
  httpError,
  objectId,
} = require('./queryValidation');
const {
  withReservedCapacity,
} = require('./capacityService');

/**
 * Evita que un participante tenga dos inscripciones
 * activas en el mismo evento.
 */
async function assertNoActiveDuplicate(
  eventId,
  participantId
) {
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
      'El participante ya tiene una inscripcion activa en este evento'
    );
  }
}

/**
 * Valida que la categoría exista y esté activa.
 */
async function validateCategory(categoryId) {
  objectId(categoryId, 'ID de categoría');

  const category = await Category.findById(categoryId)
    .select('_id status')
    .lean();

  if (!category) {
    throw httpError(
      404,
      'Categoría no encontrada'
    );
  }

  if (category.status !== 'active') {
    throw httpError(
      409,
      'La categoría no está activa'
    );
  }

  return category;
}

/**
 * RACE-14
 * Registrar una inscripción a un evento.
 */
async function createRegistration(
  data = {},
  participantId
) {
  const {
    eventId,
    categoryId,
  } = data;

  // Campos obligatorios
  if (
    eventId === undefined ||
    categoryId === undefined
  ) {
    throw httpError(
      400,
      'Evento y categoría son obligatorios'
    );
  }

  // Validar IDs antes de consultar MongoDB
  objectId(eventId, 'ID de evento');
  objectId(participantId, 'ID de participante');
  objectId(categoryId, 'ID de categoría');

  // Evitar inscripción duplicada
  await assertNoActiveDuplicate(
    eventId,
    participantId
  );

  // Comprobar que la categoría existe y está activa
  await validateCategory(categoryId);

  /*
   * Reserva el cupo del evento dentro de una
   * transacción de MongoDB.
   *
   * capacityService también valida:
   * - evento inexistente
   * - evento cancelado
   * - evento ya iniciado
   * - cupo agotado
   */
  return withReservedCapacity(
    eventId,
    async session => {
      const registrations =
        await Registration.create(
          [
            {
              event: eventId,
              participant: participantId,
              category: categoryId,
              status: 'active',
            },
          ],
          {
            session,
          }
        );

      const registration = registrations[0];

      return {
        id: registration._id,
        event: registration.event,
        participant: registration.participant,
        category: registration.category,
        status: registration.status,
        createdAt: registration.createdAt,
      };
    }
  );
}

module.exports = {
  assertNoActiveDuplicate,
  validateCategory,
  createRegistration,
};