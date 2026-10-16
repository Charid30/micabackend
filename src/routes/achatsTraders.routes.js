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
const controller = require('../controllers/achatsTraders.controller');

router.get('/semaine-courante', authorize('achats-traders', 'READ'), controller.getSemaineCourante);
router.post('/saisie', authorize('achats-traders', 'WRITE'), controller.postSaisie);

module.exports = router;
