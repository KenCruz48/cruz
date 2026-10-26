const authService = require('../services/authService');
const registrationService =
  require('../services/registrationService');
const cancellationService =
  require('../services/registrationCancellationService');
const {
  httpError,
} = require('../services/queryValidation');

/**
 * RACE-14
 * Crear una inscripción.
 *
 * La autenticación de esta ruta la realiza
 * authMiddleware y deja el usuario en req.user.
 */
async function createRegistration(req, res) {
  const registration =
    await registrationService.createRegistration(
      req.body,
      req.user.id
    );

  res.status(201).json({
    status: 'success',
    message: 'Inscripción registrada correctamente',
    data: registration,
  });
}

/**
 * Cancelación existente.
 * Se conserva para no alterar funcionalidad
 * implementada anteriormente.
 */
async function cancelRegistration(req, res) {
  const match = /^Bearer ([^\s]+)$/i.exec(
    req.headers.authorization || ''
  );

  if (!match) {
    throw httpError(
      401,
      'Token Bearer obligatorio'
    );
  }

  const actor =
    await authService.authenticate(match[1]);

  const registration =
    await cancellationService.cancelRegistration(
      req.params.id,
      actor.id
    );

  res.status(200).json({
    status: 'success',
    message: 'Inscripción cancelada correctamente',
    data: registration,
  });
}

module.exports = {
  createRegistration,
  cancelRegistration,
};