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
// Profil de l'utilisateur connecte (aucune permission particuliere : chacun ne voit que son compte)
const express = require('express');
const router = express.Router();
const svc = require('../services/profil.service');
const { sendError } = require('../utils/http-error');
const v = require('../middleware/validate');

router.get('/', async (req, res) => {
  try { res.json(await svc.getProfil(req.user.id)); } catch (e) { sendError(res, e); }
});
router.put('/', v.profil, async (req, res) => {
  try { res.json(await svc.updateProfil(req.user.id, req.body)); } catch (e) { sendError(res, e, 400); }
});

// ── Sessions actives : appareils connectes au compte, fermeture a distance
const sessions = require('../services/session.service');
router.get('/sessions', async (req, res) => {
  try { res.json(await sessions.lister(req.user.id, req.sid)); } catch (e) { sendError(res, e); }
});
router.post('/sessions/fermer-autres', async (req, res) => {
  try { res.json(await sessions.fermerAutres(req.user.id, req.sid)); } catch (e) { sendError(res, e, 400); }
});
router.delete('/sessions/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: 'Identifiant invalide.' });
  try { res.json(await sessions.fermerUne(req.user.id, id, req.sid)); } catch (e) { sendError(res, e, 400); }
});

// ── Double authentification
const doubleAuth = require('../services/double-auth.service');
router.get('/2fa', async (req, res) => {
  try { res.json(await doubleAuth.etat(req.user)); } catch (e) { sendError(res, e); }
});
router.post('/2fa/initier', v.doubleAuthMotDePasse, async (req, res) => {
  try { res.json(await doubleAuth.initier(req.user.id, req.body.mot_de_passe)); } catch (e) { sendError(res, e, 400); }
});
router.post('/2fa/activer', v.codeDoubleAuth, async (req, res) => {
  try { res.json(await doubleAuth.activer(req.user.id, req.body.code)); } catch (e) { sendError(res, e, 400); }
});
router.post('/2fa/desactiver', v.doubleAuthMotDePasse, async (req, res) => {
  try { res.json(await doubleAuth.desactiver(req.user.id, req.body.mot_de_passe, req.body.code)); } catch (e) { sendError(res, e, 400); }
});
router.post('/2fa/codes-secours', v.doubleAuthMotDePasse, async (req, res) => {
  try { res.json(await doubleAuth.regenererCodes(req.user.id, req.body.mot_de_passe, req.body.code)); } catch (e) { sendError(res, e, 400); }
});

module.exports = router;
