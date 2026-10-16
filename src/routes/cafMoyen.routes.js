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
const { authorize } = require('../middleware/auth');
const cafService = require('../services/cafMoyen.service');
const { sendError } = require('../utils/http-error');

router.get('/', authorize('caf_moyen', 'READ'), async (req, res) => {
  try {
    const annee = req.query.annee ? parseInt(req.query.annee) : null;
    res.json(await cafService.getData(annee));
  } catch (err) {
    console.error('[CAF_MOYEN]', err);
    sendError(res, err);
  }
});

router.post('/saisie', authorize('caf_moyen', 'WRITE'), async (req, res) => {
  try {
    const { entries } = req.body;
    if (!Array.isArray(entries)) return res.status(400).json({ message: 'entries doit être un tableau.' });
    res.json(await cafService.saveEntries(entries, req.user.id));
  } catch (err) {
    sendError(res, err, 400);
  }
});

module.exports = router;
