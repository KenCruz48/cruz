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

/**
 * RACE-33
 * Actualizar un evento existente.
 */
async function updateEvent(id, data = {}, ownerId) {
  objectId(id, 'ID de evento');
  objectId(ownerId, 'ID del organizador');

  // Buscar el evento antes de modificarlo
  const existingEvent = await Event.findById(id)
    .select('owner registeredCount status')
    .lean();

  if (!existingEvent) {
    throw httpError(
      404,
      'Evento no encontrado'
    );
  }

  // Solo el organizador puede modificar su evento
  if (String(existingEvent.owner) !== ownerId) {
    throw httpError(
      403,
      'No tienes permiso para actualizar este evento'
    );
  }

  // Solo estos campos se pueden modificar
  const allowedFields = [
    'name',
    'date',
    'location',
    'distance',
    'capacity',
  ];

  const fields = Object.keys(data);

  if (fields.length === 0) {
    throw httpError(
      400,
      'Debes enviar al menos un campo para actualizar'
    );
  }

  // Evitar modificación de owner, status, registeredCount, etc.
  if (fields.some(field => !allowedFields.includes(field))) {
    throw httpError(
      400,
      'La solicitud contiene campos que no se pueden actualizar'
    );
  }

  const update = {};

  // Validar nombre
  if (data.name !== undefined) {
    if (
      typeof data.name !== 'string' ||
      data.name.trim().length < 2 ||
      data.name.trim().length > 150
    ) {
      throw httpError(
        400,
        'El nombre del evento debe tener entre 2 y 150 caracteres'
      );
    }

    update.name = data.name.trim();
  }

  // Validar lugar
  if (data.location !== undefined) {
    if (
      typeof data.location !== 'string' ||
      data.location.trim().length === 0 ||
      data.location.trim().length > 200
    ) {
      throw httpError(
        400,
        'El lugar del evento es invalido'
      );
    }

    update.location = data.location.trim();
  }

  // Validar fecha
  if (data.date !== undefined) {
    const eventDate = new Date(data.date);

    if (Number.isNaN(eventDate.getTime())) {
      throw httpError(
        400,
        'La fecha del evento es invalida'
      );
    }

    update.date = eventDate;
  }

  // Validar distancia
  if (data.distance !== undefined) {
    if (
      typeof data.distance !== 'number' ||
      !Number.isFinite(data.distance) ||
      data.distance <= 0
    ) {
      throw httpError(
        400,
        'La distancia debe ser mayor que cero'
      );
    }

    update.distance = data.distance;
  }

  // Validar cupo
  if (data.capacity !== undefined) {
    if (
      typeof data.capacity !== 'number' ||
      !Number.isSafeInteger(data.capacity) ||
      data.capacity < 1
    ) {
      throw httpError(
        400,
        'El cupo debe ser un numero entero mayor que cero'
      );
    }

    // No permitir un cupo menor al número de inscritos actuales
    if (data.capacity < existingEvent.registeredCount) {
      throw httpError(
        409,
        'El cupo no puede ser menor al numero de inscritos'
      );
    }

    update.capacity = data.capacity;
  }

  // Actualizar el evento
  const event = await Event.findOneAndUpdate(
    { _id: id, owner: ownerId,
      ...(update.capacity !== undefined ? { registeredCount: { $lte: update.capacity } } : {}) },
    {
      $set: update,
    },
    {
      returnDocument: 'after',
      runValidators: true,
    }
  )
    .select(PUBLIC_FIELDS)
    .lean();

  if (!event) throw httpError(409, 'El evento cambio; el cupo no puede ser menor al numero de inscritos');
  return event;
}

/**
 * RACE-33
 * Cancelar un evento sin eliminarlo.
 */
async function cancelEvent(id, ownerId) {
  objectId(id, 'ID de evento');
  objectId(ownerId, 'ID del organizador');

  const existingEvent = await Event.findById(id)
    .select('owner status')
    .lean();

  if (!existingEvent) {
    throw httpError(
      404,
      'Evento no encontrado'
    );
  }

  // Solo el dueño/organizador puede cancelarlo
  if (String(existingEvent.owner) !== ownerId) {
    throw httpError(
      403,
      'No tienes permiso para cancelar este evento'
    );
  }

  // Evitar cancelar dos veces
  if (existingEvent.status === 'cancelled') {
    throw httpError(
      409,
      'El evento ya esta cancelado'
    );
  }

  // Cancelación lógica: NO se elimina de MongoDB
  const event = await Event.findByIdAndUpdate(
    id,
    {
      $set: {
        status: 'cancelled',
      },
    },
    {
      returnDocument: 'after',
      runValidators: true,
    }
  )
    .select(PUBLIC_FIELDS)
    .lean();

  return event;
}

module.exports = {
  getExampleEvent,
  createEvent,
  listEvents,
  getEvent,
  updateEvent,
  cancelEvent,
};
