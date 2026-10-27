const Event =
  require('../models/eventModel');

const Registration =
  require('../models/registrationModel');

const Result =
  require('../models/resultModel');

const {
  httpError,
  objectId,
} = require('./queryValidation');

/**
 * RACE-19
 * Registrar tiempo y resultado de un participante.
 */
async function createResult(
  data = {},
  organizerId
) {
  const {
    eventId,
    registrationId,
    timeMs,
  } = data;

  /*
   * Validar campos obligatorios.
   */
  if (
    eventId === undefined ||
    registrationId === undefined ||
    timeMs === undefined
  ) {
    throw httpError(
      400,
      'Evento, inscripción y tiempo son obligatorios'
    );
  }

  /*
   * Validar identificadores.
   */
  objectId(
    eventId,
    'ID de evento'
  );

  objectId(
    registrationId,
    'ID de inscripción'
  );

  objectId(
    organizerId,
    'ID del organizador'
  );

  /*
   * El tiempo se maneja en milisegundos
   * porque así lo consume rankingService.
   */
  if (
    typeof timeMs !== 'number' ||
    !Number.isSafeInteger(timeMs) ||
    timeMs <= 0
  ) {
    throw httpError(
      400,
      'El tiempo debe ser un número entero positivo en milisegundos'
    );
  }

  /*
   * Verificar que el evento exista.
   */
  const event =
    await Event.findById(eventId)
      .select('owner status')
      .lean();

  if (!event) {
    throw httpError(
      404,
      'Evento no encontrado'
    );
  }

  /*
   * Solo el organizador propietario puede
   * registrar resultados de su evento.
   */
  if (
    String(event.owner) !== organizerId
  ) {
    throw httpError(
      403,
      'No tienes permiso para registrar resultados de este evento'
    );
  }

  /*
   * No registrar resultados en eventos cancelados.
   */
  if (
    event.status === 'cancelled'
  ) {
    throw httpError(
      409,
      'No se pueden registrar resultados de un evento cancelado'
    );
  }

  /*
   * Verificar que la inscripción exista.
   */
  const registration =
    await Registration
      .findById(registrationId)
      .select(
        'event participant category status'
      )
      .lean();

  if (!registration) {
    throw httpError(
      404,
      'Inscripción no encontrada'
    );
  }

  /*
   * La inscripción debe pertenecer
   * exactamente al evento indicado.
   */
  if (
    String(registration.event) !== eventId
  ) {
    throw httpError(
      409,
      'La inscripción no pertenece a este evento'
    );
  }

  /*
   * Solo participantes actualmente inscritos.
   */
  if (
    registration.status !== 'active'
  ) {
    throw httpError(
      409,
      'La inscripción no está activa'
    );
  }

  /*
   * Persistir en MongoDB.
   *
   * Los nombres de los campos coinciden con
   * los utilizados posteriormente por rankingService.
   */
  const result =
    await Result.create({
      event: eventId,
      registration: registrationId,
      timeMs,
      status: 'finished',
    });

  return {
    id: result._id,
    event: result.event,
    registration: result.registration,
    participant:
      registration.participant,
    category:
      registration.category,
    timeMs: result.timeMs,
    status: result.status,
    createdAt:
      result.createdAt,
    updatedAt:
      result.updatedAt,
  };
}

module.exports = {
  createResult,
};