const authService = require('../services/authService');
const participantService = require('../services/participantService');
const { httpError } = require('../services/queryValidation');
async function listParticipants(req, res) {
  // RACE-42 will supply a reusable middleware. Until then use RACE-41's
  // validator locally to keep the participants endpoint authenticated.
  const match = /^Bearer ([^\s]+)$/i.exec(req.headers.authorization || '');
  if (!match) throw httpError(401, 'Token Bearer obligatorio');
  const actor = await authService.authenticate(match[1]);
  res.json({ status: 'success', data: await participantService.listParticipants(req.params.id, actor.id, req.query) });
}
module.exports = { listParticipants };
