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

// Application mobile : abonnement du telephone aux notifications (jeton Firebase)
const jetonValide = (j) => typeof j === 'string' && j.length >= 20 && j.length <= 512 && /^[\w:.\-]+$/.test(j);
router.post('/mobile', async (req, res) => {
  try {
    const { jeton, plateforme, appareil } = req.body || {};
    if (!jetonValide(jeton)) return res.status(400).json({ message: 'Jeton de notification invalide.' });
    res.json(await require('../services/fcm.service').enregistrer(req.user, { jeton, plateforme, appareil }));
  } catch (e) { sendError(res, e, 400); }
});
router.delete('/mobile', async (req, res) => {
  try {
    const { jeton } = req.body || {};
    if (!jetonValide(jeton)) return res.status(400).json({ message: 'Jeton de notification invalide.' });
    res.json(await require('../services/fcm.service').retirer(req.user, jeton));
  } catch (e) { sendError(res, e, 400); }
});

// Alertes du compte (onglet « Alertes » sur telephone) : stocks, saisies du jour, securite, rapport publie
router.get('/alertes', async (req, res) => {
  try { res.json(await require('../services/alertes.service').alertesUtilisateur(req.user)); } catch (e) { sendError(res, e); }
});

router.post('/test', async (req, res) => {
  try { res.json(await service.tester(req.user)); } catch (e) { sendError(res, e, 400); }
});

module.exports = router;
