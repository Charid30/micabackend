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
// Menu Centrale SONABEL : situation quotidienne des stocks de combustible
const express = require('express');
const router = express.Router();
const { authorize } = require('../middleware/auth');
const service = require('../services/centrales.service');
const { sendError } = require('../utils/http-error');

router.get('/', authorize('centrales', 'READ'), async (req, res) => {
  try { res.json(await service.getJour(req.query.date)); } catch (e) { sendError(res, e, 400); }
});

router.get('/evolution', authorize('centrales', 'READ'), async (req, res) => {
  try { res.json(await service.getEvolution(req.query.au)); } catch (e) { sendError(res, e, 400); }
});

router.post('/saisie', authorize('centrales', 'WRITE'), async (req, res) => {
  try {
    const { date, lignes, parcs } = req.body || {};
    res.json(await service.saveJour(date, lignes, parcs, req.user.id));
  } catch (e) { sendError(res, e, 400); }
});

module.exports = router;
