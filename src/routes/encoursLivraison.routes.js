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
// Menu Encours : planning de livraison des fournisseurs et besoins par produit
const express = require('express');
const router = express.Router();
const { authorize } = require('../middleware/auth');
const service = require('../services/encoursLivraison.service');
const { sendError } = require('../utils/http-error');

router.get('/semaine-courante', authorize('encours-livraison', 'READ'), async (req, res) => {
  try { res.json(await service.getSaisieData(req.user.id)); } catch (e) { sendError(res, e); }
});

router.post('/saisie', authorize('encours-livraison', 'WRITE'), async (req, res) => {
  try {
    const { rapport_id, lignes, besoins } = req.body || {};
    if (!Number.isInteger(Number(rapport_id)) || Number(rapport_id) <= 0) return res.status(400).json({ message: 'rapport_id est requis.' });
    res.json(await service.saveSaisie(Number(rapport_id), lignes, besoins || {}, req.user.id));
  } catch (e) { sendError(res, e, 400); }
});

// Fournisseur absent de la liste : ajout depuis l'ecran (droit d'ecriture sur Encours)
router.post('/fournisseurs', authorize('encours-livraison', 'WRITE'), async (req, res) => {
  try { res.status(201).json(await service.ajouterFournisseur(req.body?.libelle, req.user.id)); } catch (e) { sendError(res, e, 400); }
});

module.exports = router;
