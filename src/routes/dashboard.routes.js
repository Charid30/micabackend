const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboard.controller');

router.get('/synthese', dashboardController.getSynthese);

module.exports = router;
