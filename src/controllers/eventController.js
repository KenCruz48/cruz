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

module.exports = {
  getExampleEvent,
  createEvent,

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