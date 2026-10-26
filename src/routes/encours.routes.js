/* ==================================================================
 *  Auteur : BATIONO Ulrich Rachid Kévin
 *           Expert en Sécurité Informatique
 *           Développeur FullStack
 *           Tel: +226 51 57 82 89 // 66 72 02 32
 *           Whatsapp: +226 51 57 82 89
 *           Mail: bkevin@sonabhy.bf // bationor10@gmail.com
 *  Projet : MICA – SONABHY
 *  Merci
 * ================================================================== */
const express = require('express');
const router = express.Router();
const { authorize } = require('../middleware/auth');
const encoursController = require('../controllers/encours.controller');

router.get('/semaine-courante', authorize('depots-int', 'READ'), encoursController.getSaisieData);
router.post('/saisie', authorize('depots-int', 'WRITE'), encoursController.saveSaisie);

module.exports = router;
