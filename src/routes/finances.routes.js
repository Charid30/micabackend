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
const { authorize, authorizeAny } = require('../middleware/auth');
const tresoService = require('../services/tresorerie.service');
const { sendError } = require('../utils/http-error');
const v = require('../middleware/validate');

const droitsDe = (user) => {
  const perms = user.permissions ?? [];
  const peut = (module) => user.is_admin || perms.some(p => p.module === module && p.action === 'WRITE');
  return { saisie: peut('tresorerie'), lignes: peut('tresorerie-lignes') };
};

// ── Saisie hebdomadaire
router.get('/semaine-courante', authorizeAny(['tresorerie', 'READ'], ['tresorerie-lignes', 'READ']), async (req, res) => {
  try {
    res.json(await tresoService.getSaisieData(req.user, droitsDe(req.user)));
  } catch (err) {
    sendError(res, err);
  }
});

router.post('/saisie', authorize('tresorerie', 'WRITE'), v.saisieTresorerie, async (req, res) => {
  try {
    res.json(await tresoService.saveSaisie(req.body.rapport_id, req.body.lignes, req.user));
  } catch (err) {
    sendError(res, err, 400);
  }
});

// ── Paramétrage des lignes (ajout, libellé, ordre, désactivation : pas de suppression pour garder l'historique)
router.get('/lignes', authorizeAny(['tresorerie', 'READ'], ['tresorerie-lignes', 'READ']), async (req, res) => {
  try { res.json(await tresoService.getLignes()); } catch (err) { sendError(res, err); }
});
router.post('/lignes', authorize('tresorerie-lignes', 'WRITE'), v.ligneTresorerie(false), async (req, res) => {
  try { res.status(201).json(await tresoService.createLigne(req.body, req.user)); } catch (err) { sendError(res, err, 400); }
});
router.put('/lignes/:id', authorize('tresorerie-lignes', 'WRITE'), v.ligneTresorerie(true), async (req, res) => {
  try { res.json(await tresoService.updateLigne(req.params.id, req.body, req.user)); } catch (err) { sendError(res, err, 400); }
});

module.exports = router;
