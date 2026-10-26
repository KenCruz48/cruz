const authService = require('../services/authService');
async function login(req, res) {
  res.json({ status: 'success', data: await authService.login(req.body) });
}
module.exports = { login };
