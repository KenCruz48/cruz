const mongoose = require('mongoose');
const Event = require('../models/eventModel');
const { httpError, objectId, pagination } = require('./queryValidation');

const PODIUM_LIMIT = 100;

// RACE-19 owns result creation. This reader accepts only finished results with
// integer millisecond times and valid, active registrations for this event.
function buildPipeline(eventId, category, skip, limit) {
  const event = new mongoose.Types.ObjectId(eventId);
  const registrationFilter = { event, status: 'active' };
  if (category) registrationFilter.category = new mongoose.Types.ObjectId(category);
  return [
    { $match: { event, status: 'finished', timeMs: { $type: 'number', $gt: 0, $lte: Number.MAX_SAFE_INTEGER } } },
    { $match: { $expr: { $eq: ['$timeMs', { $trunc: '$timeMs' }] } } },
    { $sort: { updatedAt: -1, _id: -1 } },
    { $group: { _id: '$registration', result: { $first: '$$ROOT' } } },
    { $replaceRoot: { newRoot: '$result' } },
    { $lookup: { from: 'registrations', localField: 'registration', foreignField: '_id',
      pipeline: [{ $match: registrationFilter }], as: 'registrationData' } },
    { $unwind: '$registrationData' },
    { $lookup: { from: 'users', localField: 'registrationData.participant', foreignField: '_id',
      pipeline: [{ $project: { name: 1 } }], as: 'participantData' } },
    { $unwind: '$participantData' },
    { $project: { _id: 0, registrationId: '$registrationData._id',
      participant: { id: '$participantData._id', name: '$participantData.name' },
      category: '$registrationData.category', timeMs: 1 } },
    { $setWindowFields: { sortBy: { timeMs: 1 }, output: { rank: { $rank: {} } } } },
    { $sort: { timeMs: 1, 'participant.id': 1, registrationId: 1 } },
    { $facet: {
      ranking: [{ $skip: skip }, { $limit: limit }],
      podium: [{ $match: { rank: { $lte: 3 } } }, { $limit: PODIUM_LIMIT }],
      metadata: [{ $group: { _id: null, total: { $sum: 1 },
        podiumCount: { $sum: { $cond: [{ $lte: ['$rank', 3] }, 1, 0] } } } }],
    } },
  ];
}

async function getRanking(eventId, query = {}) {
  objectId(eventId, 'ID de evento');
  const { page, limit, skip } = pagination(query);
  if (query.category !== undefined) objectId(query.category, 'ID de categoria');
  if (!(await Event.exists({ _id: eventId }))) throw httpError(404, 'Evento no encontrado');
  const [result] = await mongoose.connection.collection('results')
    .aggregate(buildPipeline(eventId, query.category, skip, limit), { maxTimeMS: 10000 }).toArray();
  const { total = 0, podiumCount = 0 } = result?.metadata?.[0] || {};
  return {
    eventId, category: query.category || null, page, limit, total,
    ranking: result?.ranking || [], podium: result?.podium || [],
    podiumCount, podiumTruncated: podiumCount > PODIUM_LIMIT,
    rules: { timeUnit: 'milliseconds', ties: 'competition', podium: 'rank <= 3', podiumLimit: PODIUM_LIMIT },
  };
}

module.exports = { getRanking, buildPipeline };
