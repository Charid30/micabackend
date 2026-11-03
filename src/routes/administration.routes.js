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
// Administration technique (administrateurs uniquement) : sauvegardes et journal d'audit
const express = require('express');
const router = express.Router();
const sauvegardes = require('../services/sauvegarde.service');
const journal = require('../services/journal.service');
const { sendError } = require('../utils/http-error');

router.use((req, res, next) => (req.user?.is_admin ? next() : res.status(403).json({ message: 'Accès réservé aux administrateurs.' })));

// ── Sauvegardes
router.get('/sauvegardes', async (req, res) => {
  try { res.json({ etat: await sauvegardes.getEtat(), historique: await sauvegardes.getHistorique() }); } catch (e) { sendError(res, e); }
});
router.get('/sauvegardes/etat', async (req, res) => {
  try { res.json(await sauvegardes.getEtat()); } catch (e) { sendError(res, e); }
});
router.post('/sauvegardes', async (req, res) => {
  try {
    const s = await sauvegardes.lancerSauvegarde('MANUELLE', req.user.id);
    if (s.statut !== 'OK') return res.status(500).json({ message: `Échec de la sauvegarde : ${s.message}` });
    res.status(201).json({ message: `Sauvegarde ${s.fichier} réalisée.` });
  } catch (e) { sendError(res, e); }
});

// ── Interims : droits d'un agent absent confies a un autre compte
const interims = require('../services/interim.service');
const repondre = (action) => async (req, res) => { try { res.json(await action(req)); } catch (e) { sendError(res, e, 400); } };
router.get('/interims', repondre(() => interims.lister()));
router.get('/interims/titulaire/:id/droits', repondre(req => interims.droitsDuTitulaire(req.params.id)));
router.post('/interims', repondre(req => interims.creer(req.body, req.user.id)));
router.put('/interims/:id', repondre(req => interims.modifier(req.params.id, req.body, req.user.id)));
router.post('/interims/:id/arreter', repondre(req => interims.arreter(req.params.id, req.user.id)));

// ── Journal d'audit
router.get('/journal', async (req, res) => {
  try { res.json(await journal.rechercher(req.query)); } catch (e) { sendError(res, e); }
});

// ── Double authentification d'un utilisateur (telephone et codes de secours perdus)
router.post('/utilisateurs/:id/reinitialiser-2fa', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!(id > 0)) return res.status(400).json({ message: 'Identifiant invalide.' });
    res.json(await require('../services/double-auth.service').reinitialiser(req.user.id, id));
  } catch (e) { sendError(res, e, 400); }
});

// ── Detection d'intrusion : attaques detectees, adresses bannies, comptes suspendus
const intrusion = require('../services/intrusion.service');
router.get('/intrusions', async (req, res) => {
  try { res.json(await intrusion.consulter(req.query)); } catch (e) { sendError(res, e); }
});
router.delete('/intrusions/ip/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!(id > 0)) return res.status(400).json({ message: 'Identifiant invalide.' });
    res.json(await intrusion.leverBannissement(id, req.user));
  } catch (e) { sendError(res, e, 400); }
});
router.post('/intrusions/compte/:id/reactiver', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!(id > 0)) return res.status(400).json({ message: 'Identifiant invalide.' });
    res.json(await intrusion.reactiverCompte(id));
  } catch (e) { sendError(res, e, 400); }
});

// ── Reglages de securite (double authentification, validite des mots de passe)
const securite = require('../services/securite.service');
const v = require('../middleware/validate');
router.get('/securite', async (req, res) => {
  try { res.json(await securite.getReglages()); } catch (e) { sendError(res, e); }
});
router.put('/securite', v.reglagesSecurite, async (req, res) => {
  try { res.json(await securite.saveReglages(req.body, req.user.id)); } catch (e) { sendError(res, e, 400); }
});

module.exports = router;
