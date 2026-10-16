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
const { authorizeAny } = require('../middleware/auth');
const stocksController = require('../controllers/stocks.controller');
const v = require('../middleware/validate');

// Lecture : saisie des stocks ou redaction des actions (DSTA)
router.get('/semaine-courante', authorizeAny(['stocks', 'READ'], ['actions-stocks', 'READ']), stocksController.getSaisieData);
// Ecriture : chaque champ est controle selon le droit correspondant (voir stocks.controller)
router.post('/saisie', authorizeAny(['stocks', 'WRITE'], ['actions-stocks', 'WRITE']), v.saisieStocks, stocksController.saveSaisie);

module.exports = router;
