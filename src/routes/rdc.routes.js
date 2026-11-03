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
// Menu RDC : un droit par pays (rdc-ghana, rdc-benin, rdc-cote-ivoire) ; les destinations sont gerees par les administrateurs
const express = require('express');
const router = express.Router();
const { authorize } = require('../middleware/auth');
const service = require('../services/rdc.service');
const { sendError } = require('../utils/http-error');

const droit = (action) => (req, res, next) => {
  if (!service.PAYS[req.params.pays]) return res.status(404).json({ message: 'Pays inconnu.' });
  return authorize(`rdc-${req.params.pays}`, action)(req, res, next);
};

const adminSeul = (req, res, next) => (req.user.is_admin ? next() : res.status(403).json({ message: 'Accès réservé aux administrateurs.' }));

const repondre = (action) => async (req, res) => {
  try { res.json(await action(req)); } catch (e) { sendError(res, e, 400); }
};

router.get('/:pays', droit('READ'), repondre(req => service.getEtat(req.params.pays, req.query.date)));
router.post('/:pays/etat', droit('WRITE'), repondre(req => service.saveEtat(req.params.pays, req.body || {}, req.user.id)));

router.get('/:pays/chargements', droit('READ'), repondre(req => service.getChargements(req.params.pays, req.query.date)));
router.post('/:pays/chargements', droit('WRITE'), repondre(req => service.ajouterChargement(req.params.pays, req.body, req.user.id)));
router.put('/:pays/chargements/:id', droit('WRITE'), repondre(req => service.modifierChargement(req.params.pays, req.params.id, req.body, req.user.id)));
router.delete('/:pays/chargements/:id', droit('WRITE'), repondre(req => service.supprimerChargement(req.params.pays, req.params.id, req.user.id)));

router.get('/:pays/receptions', droit('READ'), repondre(req => service.getReceptions(req.params.pays)));
router.post('/:pays/receptions', droit('WRITE'), repondre(req => service.ajouterReception(req.params.pays, req.body, req.user.id)));
router.put('/:pays/receptions/:id', droit('WRITE'), repondre(req => service.modifierReception(req.params.pays, req.params.id, req.body, req.user.id)));
router.delete('/:pays/receptions/:id', droit('WRITE'), repondre(req => service.supprimerReception(req.params.pays, req.params.id, req.user.id)));

router.post('/:pays/destinations', adminSeul, repondre(req => service.ajouterDestination(req.params.pays, req.body, req.user.id)));
router.put('/:pays/destinations/:id', adminSeul, repondre(req => service.modifierDestination(req.params.pays, req.params.id, req.body, req.user.id)));

module.exports = router;
