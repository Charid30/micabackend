const express = require('express');
const router = express.Router();
const { authorize } = require('../middleware/auth');
const veilleMarcheController = require('../controllers/veilleMarche.controller');

router.get('/semaine-courante', authorize('veille-marche', 'READ'), veilleMarcheController.getSaisieData);
router.post('/saisie', authorize('veille-marche', 'WRITE'), veilleMarcheController.saveSaisie);

module.exports = router;
