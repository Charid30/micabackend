const express = require('express');
const router = express.Router();
const { authorize } = require('../middleware/auth');
const controller = require('../controllers/achatsTraders.controller');

router.get('/semaine-courante', authorize('achats-traders', 'READ'), controller.getSemaineCourante);
router.post('/saisie', authorize('achats-traders', 'WRITE'), controller.postSaisie);

module.exports = router;
