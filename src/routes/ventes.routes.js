const express = require('express');
const router = express.Router();
const { authorize } = require('../middleware/auth');
const controller = require('../controllers/ventes.controller');

router.get('/semaine-courante', authorize('ventes', 'READ'), controller.getSemaineCourante);
router.post('/saisie', authorize('ventes', 'WRITE'), controller.postSaisie);

module.exports = router;
