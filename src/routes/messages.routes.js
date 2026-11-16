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
// Messages ciblés : lecture par chaque compte connecté ; envoi, suivi et retrait par les administrateurs
const express = require('express');
const router = express.Router();
const v = require('../middleware/validate');
const { sendError } = require('../utils/http-error');
const service = require('../services/messages.service');

// ── Compte connecté : ses messages non lus et l'accusé de lecture
router.get('/a-lire', async (req, res) => {
  try { res.json(await service.aLire(req.user)); } catch (e) { sendError(res, e); }
});
router.post('/:id/lu', v.idParam, async (req, res) => {
  try { res.json(await service.marquerLu(req.user, req.params.id, req.ip)); } catch (e) { sendError(res, e, 400); }
});

// ── Administrateurs
router.use((req, res, next) => (req.user?.is_admin ? next() : res.status(403).json({ message: 'Accès réservé aux administrateurs.' })));

router.get('/', async (req, res) => {
  try { res.json(await service.lister()); } catch (e) { sendError(res, e); }
});
router.post('/', async (req, res) => {
  try { res.status(201).json(await service.envoyer(req.user, req.body)); } catch (e) { sendError(res, e, 400); }
});
router.delete('/:id', v.idParam, async (req, res) => {
  try { res.json(await service.retirer(req.user, req.params.id)); } catch (e) { sendError(res, e, 400); }
});

module.exports = router;
