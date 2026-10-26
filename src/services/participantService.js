const Event = require('../models/eventModel');
const Registration = require('../models/registrationModel');
const { objectId, pagination, httpError } = require('./queryValidation');
async function listParticipants(eventId, actorId, query = {}) {
  objectId(eventId, 'ID de evento');
  const { page, limit, skip } = pagination(query);
  const event = await Event.findById(eventId).select('owner').lean();
  if (!event) throw httpError(404, 'Evento no encontrado');
  if (String(event.owner) !== actorId) throw httpError(403, 'Solo el organizador puede consultar participantes');
  const rows = await Registration.find({ event: eventId, status: 'active' })
    .select('_id participant category status createdAt')
    .populate('participant', 'name').sort({ _id: 1 }).skip(skip).limit(limit).lean();
  const participants = rows.map(row => ({
    id: row._id, participant: row.participant ? { id: row.participant._id, name: row.participant.name } : null,
    category: row.category, status: row.status, createdAt: row.createdAt,
  }));
  return { participants, page, limit };
}
module.exports = { listParticipants };
