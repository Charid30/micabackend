const express = require('express');
const router = express.Router();
const { authorize } = require('../middleware/auth');
const chargementsController = require('../controllers/chargements.controller');

router.get('/semaine-courante', authorize('corridors', 'READ'), chargementsController.getSaisieData);
router.post('/saisie', authorize('corridors', 'WRITE'), chargementsController.saveSaisie);

module.exports = router;
