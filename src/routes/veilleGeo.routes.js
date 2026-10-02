const express = require('express');
const router = express.Router();
const { authorize } = require('../middleware/auth');
const veilleGeoController = require('../controllers/veilleGeo.controller');

router.get('/semaine-courante', authorize('veille-geo', 'READ'), veilleGeoController.getSaisieData);
router.post('/saisie', authorize('veille-geo', 'WRITE'), veilleGeoController.saveSaisie);

module.exports = router;
