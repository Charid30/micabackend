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
const dashboardController = require('../controllers/dashboard.controller');

router.get('/synthese', authorize('dashboard', 'READ'), dashboardController.getSynthese);

// Suivi des saisies : qui a saisi quoi et quand, retards par depot (?jours=7, 31 au plus) ; droit dedie
// Relance des agents dont une saisie du jour manque (notification de mise à jour + notification du navigateur)
router.post('/saisies/relancer', authorize('suivi-saisies', 'READ'), async (req, res) => {
  try { res.json(await require('../services/messages.service').relancerRetardataires(req.user)); }
  catch (e) { require('../utils/http-error').sendError(res, e, 400); }
});

router.get('/saisies', authorize('suivi-saisies', 'READ'), async (req, res) => {
  try {
    res.json(await require('../services/suivi-saisies.service').getSuivi({ jours: req.query.jours }));
  } catch (e) {
    console.error('[Dashboard] Suivi des saisies :', e.message);
    require('../utils/http-error').sendError(res, e);
  }
});

module.exports = router;
