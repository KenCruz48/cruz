const express = require('express');
const eventController = require('../controllers/eventController');
const authMiddleware = require('../middlewares/authMiddleware');

const router = express.Router();

router.get('/example', eventController.getExampleEvent);

router.post(
  '/',
  authMiddleware,
  eventController.createEvent
);

router.get('/', eventController.listEvents);

router.get(
  '/:id/ranking',
  require('../controllers/rankingController').getRanking
);

router.get(
  '/:id/participants',
  authMiddleware,
  require('../controllers/participantController').listParticipants
);

// RACE-33 - Cancelar evento
router.patch(
  '/:id/cancel',
  authMiddleware,
  eventController.cancelEvent
);

// RACE-33 - Actualizar evento
router.patch(
  '/:id',
  authMiddleware,
  eventController.updateEvent
);

router.get('/:id', eventController.getEvent);

module.exports = router;