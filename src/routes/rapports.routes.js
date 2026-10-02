const express = require('express');
const router = express.Router();
const { authorize } = require('../middleware/auth');
const controller = require('../controllers/rapports.controller');

// Lecture : tout utilisateur authentifié peut voir les rapports
router.get('/liste', controller.getListe);
router.get('/:id/apercu', controller.getApercu);

// Archivage : réservé aux utilisateurs avec permission WRITE sur rapports
router.post('/:id/archiver', authorize('rapports', 'WRITE'), controller.archiver);

module.exports = router;
