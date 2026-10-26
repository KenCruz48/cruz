
const authService = require('../services/authService');

function unauthorized(message = 'Autenticación requerida') {
  return Object.assign(new Error(message), { status: 401 });
}

async function authMiddleware(req, res, next) {
  const authorization = req.headers.authorization || '';
  const match = /^Bearer ([^\s]+)$/i.exec(authorization);

  if (!match) {
    return next(unauthorized('Token Bearer obligatorio'));
  }

  try {
    const user = await authService.authenticate(match[1]);
    req.user = user;
    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = authMiddleware;
