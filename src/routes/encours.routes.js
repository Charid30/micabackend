const express = require('express');
const router = express.Router();
const { authorize } = require('../middleware/auth');
const encoursController = require('../controllers/encours.controller');

router.get('/semaine-courante', authorize('depots-int', 'READ'), encoursController.getSaisieData);
router.post('/saisie', authorize('depots-int', 'WRITE'), encoursController.saveSaisie);

module.exports = router;
