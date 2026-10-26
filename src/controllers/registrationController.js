
const authService = require('../services/authService');
const registrationService = require('../services/registrationCancellationService');
const { httpError } = require('../services/queryValidation');

async function cancelRegistration(req, res) {
  const match = /^Bearer ([^\s]+)$/i.exec(
    req.headers.authorization || '',
  );

  if (!match) {
    throw httpError(401, 'Token Bearer obligatorio');
  }

  const actor = await authService.authenticate(match[1]);

  const registration = await registrationService.cancelRegistration(
    req.params.id,
    actor.id,
  );

  res.status(200).json({
    status: 'success',
    message: 'Inscripción cancelada correctamente',
    data: registration,
  });
}

module.exports = { cancelRegistration };
