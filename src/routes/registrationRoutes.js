
const express = require('express');
const registrationController = require('../controllers/registrationController');

const router = express.Router();

router.delete('/:id', registrationController.cancelRegistration);

module.exports = router;
