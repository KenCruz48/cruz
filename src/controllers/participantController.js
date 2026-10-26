
const participantService = require('../services/participantService');

async function listParticipants(req, res) {
  const actor = req.user;

  res.json({
    status: 'success',
    data: await participantService.listParticipants(
      req.params.id,
      actor.id,
      req.query
    ),
  });
}

module.exports = { listParticipants };
