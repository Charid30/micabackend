const express = require('express');
const router = express.Router();
const { authorize } = require('../middleware/auth');
const controller = require('../controllers/rapports.controller');
const v = require('../middleware/validate');

// Lecture : tout utilisateur authentifié peut voir les rapports
router.get('/liste', controller.getListe);
router.get('/:id/apercu', v.idParam, controller.getApercu);
// Export Excel au format du classeur Indicateurs.xlsx (onglets Autonomie et Treso)
router.get('/:id/export-excel', v.idParam, controller.exportExcel);

// Archivage : réservé aux utilisateurs avec permission WRITE sur rapports
router.post('/:id/archiver', authorize('rapports', 'WRITE'), controller.archiver);

module.exports = router;
