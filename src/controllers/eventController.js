const eventService = require('../services/eventService');

function getExampleEvent(req, res) {
  const event = eventService.getExampleEvent();

  res.status(200).json({
    status: 'success',
    data: event,
  });
}

module.exports = {
  getExampleEvent,
  async listEvents(req, res) {
    res.json({ status: 'success', data: await eventService.listEvents(req.query) });
  },
  async getEvent(req, res) {
    res.json({ status: 'success', data: await eventService.getEvent(req.params.id) });
  },
};
