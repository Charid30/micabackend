const express = require('express');
const router = express.Router();
const { authorize, authorizeAny } = require('../middleware/auth');
const stocksController = require('../controllers/stocks.controller');

router.get('/semaine-courante', authorize('stocks', 'READ'), stocksController.getSaisieData);
// Autorisé si l'utilisateur a stocks:WRITE OU impompable:WRITE
router.post('/saisie', authorizeAny(['stocks', 'WRITE'], ['impompable', 'WRITE']), stocksController.saveSaisie);

module.exports = router;
