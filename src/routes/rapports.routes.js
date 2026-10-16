/* ==================================================================
 *  Auteur : BATIONO Ulrich Rachid Kévin
 *           Expert en Sécurité Informatique
 *           Développeur FullStack
 *           Tel: +226 51 57 82 89 // 66 72 02 32
 *           Whatsapp: +226 51 57 82 89
 *           Mail: bkevin@sonabhy.bf // bationor10@gmail.com
 *  Projet : MICA – SONABHY
 * ================================================================== */
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

// Suppression (brouillon ou publie) : administrateurs uniquement
const adminSeulement = (req, res, next) => (req.user?.is_admin ? next() : res.status(403).json({ message: 'Accès réservé aux administrateurs.' }));
router.delete('/:id', adminSeulement, v.idParam, controller.supprimer);

module.exports = router;
