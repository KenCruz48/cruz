const express = require('express');
const registrationController =
  require('../controllers/registrationController');
const authMiddleware =
  require('../middlewares/authMiddleware');

const router = express.Router();

/**
 * RACE-14
 * Registrar una inscripción.
 */
router.post(
  '/',
  authMiddleware,
  registrationController.createRegistration
);

/**
 * Cancelación existente.
 */
router.delete(
  '/:id',
  registrationController.cancelRegistration
);

module.exports = router;