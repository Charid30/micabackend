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
// Notifications push web : chaque utilisateur connecte gere l'abonnement de son navigateur
const express = require('express');
const router = express.Router();
const { sendError } = require('../utils/http-error');
const service = require('../services/notifications.service');

router.get('/cle-publique', (req, res) => {
  try { res.json(service.getClePublique()); } catch (e) { sendError(res, e); }
});

router.post('/abonnement', async (req, res) => {
  try { res.json(await service.abonner(req.user, req.body?.abonnement, req.get('User-Agent'))); }
  catch (e) { sendError(res, e, 400); }
});

router.delete('/abonnement', async (req, res) => {
  try { res.json(await service.desabonner(req.user, req.body?.endpoint)); }
  catch (e) { sendError(res, e, 400); }
});

router.post('/test', async (req, res) => {
  try { res.json(await service.tester(req.user)); } catch (e) { sendError(res, e, 400); }
});

module.exports = router;
