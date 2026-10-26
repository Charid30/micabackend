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
const ctrl = require('../controllers/directions.controller');
const { authorize } = require('../middleware/auth');
const v = require('../middleware/validate');

// Structures : lecture et écriture réservées au module administration
router.use((req, res, next) =>
  authorize('administration', ['GET', 'HEAD'].includes(req.method) ? 'READ' : 'WRITE')(req, res, next));

router.get('/', ctrl.getAll);
router.get('/entreprise/:entrepriseId', ctrl.getByEntreprise);
router.post('/', v.direction(false), ctrl.create);
router.put('/:id', v.direction(true), ctrl.update);
router.delete('/:id', v.idParam, ctrl.remove);

module.exports = router;
