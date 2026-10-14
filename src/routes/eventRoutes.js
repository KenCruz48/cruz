const express = require('express');
const eventController = require('../controllers/eventController');

const router = express.Router();

router.get('/example', eventController.getExampleEvent);
router.get('/', eventController.listEvents);
router.get('/:id/participants', require('../controllers/participantController').listParticipants);
router.get('/:id', eventController.getEvent);

module.exports = router;
