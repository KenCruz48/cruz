function getExampleEvent() {
  return {
    id: 1,
    name: 'Carrera de ejemplo',
    distance: '5K',
    status: 'active',
  };
}

const Event = require('../models/eventModel');
const { httpError, objectId, pagination } = require('./queryValidation');
const PUBLIC_FIELDS = '_id name date location distance capacity registeredCount status createdAt updatedAt';
async function listEvents(query = {}) {
  const { page, limit, skip } = pagination(query);
  const filter = {};
  if (query.status !== undefined) {
    if (!['active', 'cancelled'].includes(query.status)) throw httpError(400, 'Estado invalido');
    filter.status = query.status;
  }
  const events = await Event.find(filter).select(PUBLIC_FIELDS).sort({ date: 1, _id: 1 }).skip(skip).limit(limit).lean();
  return { events, page, limit };
}
async function getEvent(id) {
  objectId(id, 'ID de evento');
  const event = await Event.findById(id).select(PUBLIC_FIELDS).lean();
  if (!event) throw httpError(404, 'Evento no encontrado');
  return event;
}
module.exports = { getExampleEvent, listEvents, getEvent };
