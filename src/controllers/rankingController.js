const rankingService = require('../services/rankingService');

async function getRanking(req, res) {
  res.json({ status: 'success', data: await rankingService.getRanking(req.params.id, req.query) });
}

module.exports = { getRanking };
