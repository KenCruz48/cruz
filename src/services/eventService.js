const Event = require('../models/eventModel');
const {
  httpError,
  objectId,
  pagination,
} = require('./queryValidation');

const PUBLIC_FIELDS =
  '_id name date location distance capacity registeredCount status createdAt updatedAt';

function getExampleEvent() {
  return {
    id: 1,
    name: 'Carrera de ejemplo',
    distance: '5K',
    status: 'active',
  };
}

async function createEvent(data = {}, ownerId) {
  const {
    name,
    date,
    location,
    distance,
    capacity,
    status = 'active',
  } = data;

  // Validar campos obligatorios
  if (
    name === undefined ||
    date === undefined ||
    location === undefined ||
    distance === undefined ||
    capacity === undefined
  ) {
    throw httpError(
      400,
      'Nombre, fecha, lugar, distancia y cupo son obligatorios'
    );
  }

  // Validar nombre
  if (
    typeof name !== 'string' ||
    name.trim().length < 2 ||
    name.trim().length > 150
  ) {
    throw httpError(
      400,
      'El nombre del evento debe tener entre 2 y 150 caracteres'
    );
  }

  // Validar lugar
  if (
    typeof location !== 'string' ||
    location.trim().length === 0 ||
    location.trim().length > 200
  ) {
    throw httpError(
      400,
      'El lugar del evento es invalido'
    );
  }

  // Validar fecha
  const eventDate = new Date(date);

  if (Number.isNaN(eventDate.getTime())) {
    throw httpError(
      400,
      'La fecha del evento es invalida'
    );
  }

  // Validar distancia
  if (
    typeof distance !== 'number' ||
    !Number.isFinite(distance) ||
    distance <= 0
  ) {
    throw httpError(
      400,
      'La distancia debe ser mayor que cero'
    );
  }

  // Validar cupo
  if (
    typeof capacity !== 'number' ||
    !Number.isSafeInteger(capacity) ||
    capacity < 1
  ) {
    throw httpError(
      400,
      'El cupo debe ser un numero entero mayor que cero'
    );
  }

  // Validar estado
  if (!['active', 'cancelled'].includes(status)) {
    throw httpError(
      400,
      'El estado del evento es invalido'
    );
  }

  // Validar propietario/organizador
  objectId(ownerId, 'ID del organizador');

  // Guardar el evento en MongoDB
  const event = await Event.create({
    name: name.trim(),
    date: eventDate,
    location: location.trim(),
    distance,
    capacity,
    registeredCount: 0,
    status,
    owner: ownerId,
  });

  return {
    id: event._id,
    name: event.name,
    date: event.date,
    location: event.location,
    distance: event.distance,
    capacity: event.capacity,
    registeredCount: event.registeredCount,
    status: event.status,
    createdAt: event.createdAt,
  };
}

async function listEvents(query = {}) {
  const { page, limit, skip } = pagination(query);
  const filter = {};

  if (query.status !== undefined) {
    if (!['active', 'cancelled'].includes(query.status)) {
      throw httpError(400, 'Estado invalido');
    }

    filter.status = query.status;
  }

  const events = await Event.find(filter)
    .select(PUBLIC_FIELDS)
    .sort({ date: 1, _id: 1 })
    .skip(skip)
    .limit(limit)
    .lean();

  return {
    events,
    page,
    limit,
  };
}

async function getEvent(id) {
  objectId(id, 'ID de evento');

  const event = await Event.findById(id)
    .select(PUBLIC_FIELDS)
    .lean();

  if (!event) {
    throw httpError(
      404,
      'Evento no encontrado'
    );
  }

  return event;
}

module.exports = {
  getExampleEvent,
  createEvent,
  listEvents,
  getEvent,
};