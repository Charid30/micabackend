const express = require('express');
const router = express.Router();
const { authorize } = require('../middleware/auth');
const camionsController = require('../controllers/camions.controller');

router.get('/semaine-courante', authorize('temps-attente', 'READ'), camionsController.getSaisieData);
router.get('/analyse-mensuelle', authorize('temps-attente', 'READ'), camionsController.getAnalyseMensuelle);
router.post('/saisie', authorize('temps-attente', 'WRITE'), camionsController.saveSaisie);

module.exports = router;
