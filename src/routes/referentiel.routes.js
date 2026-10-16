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
const svc = require('../services/referentiel.service');
const { sendError } = require('../utils/http-error');
const v = require('../middleware/validate');

// Consultation : toute personne qui saisit les stocks, les actions ou gere le referentiel
const lecture = authorizeAny(['stocks', 'READ'], ['impompable', 'READ'], ['referentiel-stocks', 'READ'], ['actions-stocks', 'READ']);
// Modification : les droits fins (depot, exterieur) sont controles dans le service
const ecriture = authorizeAny(['impompable', 'WRITE'], ['referentiel-stocks', 'WRITE']);

router.get('/', lecture, async (req, res) => {
  try { res.json(await svc.getReferentiel(req.user)); } catch (e) { sendError(res, e); }
});
router.put('/depots', ecriture, v.referentielDepots, async (req, res) => {
  try { res.json(await svc.saveDepots(req.user, req.body.lignes, req.body.date_effet)); } catch (e) { sendError(res, e, 400); }
});
router.put('/besoins', ecriture, v.referentielBesoins, async (req, res) => {
  try { res.json(await svc.saveBesoins(req.user, req.body.besoins, req.body.date_effet)); } catch (e) { sendError(res, e, 400); }
});
router.put('/parametres', ecriture, v.referentielParametres, async (req, res) => {
  try { res.json(await svc.saveParametres(req.user, req.body)); } catch (e) { sendError(res, e, 400); }
});

router.put('/densites', ecriture, v.referentielDensites, async (req, res) => {
  try { res.json(await svc.saveDensites(req.user, req.body.densites)); } catch (e) { sendError(res, e, 400); }
});

module.exports = router;
