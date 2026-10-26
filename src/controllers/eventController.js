const eventService = require('../services/eventService');

function getExampleEvent(req, res) {
  const event = eventService.getExampleEvent();

  res.status(200).json({
    status: 'success',
    data: event,
  });
}

async function createEvent(req, res) {
  const event = await eventService.createEvent(
    req.body,
    req.user.id
  );

  res.status(201).json({
    status: 'success',
    message: 'Evento creado correctamente',
    data: event,
  });
}

// RACE-33 - Actualizar un evento existente
async function updateEvent(req, res) {
  const event = await eventService.updateEvent(
    req.params.id,
    req.body,
    req.user.id
  );

  res.status(200).json({
    status: 'success',
    message: 'Evento actualizado correctamente',
    data: event,
  });
}

// RACE-33 - Cancelar un evento sin eliminarlo
async function cancelEvent(req, res) {
  const event = await eventService.cancelEvent(
    req.params.id,
    req.user.id
  );

  res.status(200).json({
    status: 'success',
    message: 'Evento cancelado correctamente',
    data: event,
  });
}

module.exports = {
  getExampleEvent,
  createEvent,
  updateEvent,
  cancelEvent,

  async listEvents(req, res) {
    res.json({
      status: 'success',
      data: await eventService.listEvents(req.query),
    });
  },

  async getEvent(req, res) {
    res.json({
      status: 'success',
      data: await eventService.getEvent(req.params.id),
    });
  },
};