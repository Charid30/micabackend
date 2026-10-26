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
// Frequences de saisie des menus (Parametres > Frequences de saisie)
// Lecture : tout utilisateur connecte (ecrans de saisie) ; modification : permission parametres:WRITE
const express = require('express');
const router = express.Router();
const { authenticate, writeRequires } = require('../middleware/auth');
const { sendError } = require('../utils/http-error');
const { getFrequences, saveFrequences } = require('../services/frequence.service');

router.use(authenticate);
router.use(writeRequires('parametres'));

router.get('/', async (req, res) => {
  try { res.json(await getFrequences()); } catch (e) { sendError(res, e); }
});

router.put('/', async (req, res) => {
  try {
    if (!req.body || typeof req.body.frequences !== 'object' || Array.isArray(req.body.frequences)) {
      return res.status(400).json({ message: 'Données invalides.' });
    }
    res.json(await saveFrequences(req.body.frequences, req.user.id));
  } catch (e) { sendError(res, e, 400); }
});

module.exports = router;
