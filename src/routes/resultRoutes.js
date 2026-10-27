const express =
  require('express');

const resultController =
  require('../controllers/resultController');

const authMiddleware =
  require('../middlewares/authMiddleware');

const router =
  express.Router();

/**
 * RACE-19
 * Registrar tiempo y resultado.
 */
router.post(
  '/',
  authMiddleware,
  resultController.createResult
);

module.exports = router;