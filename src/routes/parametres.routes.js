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
const { Parametre, ParametreAlerte, Produit } = require('../models');
const { authenticate, writeRequires } = require('../middleware/auth');
const { sendError } = require('../utils/http-error');
const v = require('../middleware/validate');

router.use(authenticate);
// Lecture : tout utilisateur connecté ; modification : permission parametres:WRITE
router.use(writeRequires('parametres'));

// ── Paramètres généraux (clé/valeur) ─────────────────────────
router.get('/', async (req, res) => {
  try {
    const data = await Parametre.findAll({ order: [['cle', 'ASC']] });
    res.json(data);
  } catch (e) { sendError(res, e); }
});

router.put('/:id', v.parametre, async (req, res) => {
  try {
    const p = await Parametre.findByPk(req.params.id);
    if (!p) return res.status(404).json({ message: 'Paramètre introuvable' });
    // Reglages de securite : uniquement par Parametres > Securite (administrateurs)
    if (require('../services/securite.service').CLES_SECURITE.includes(p.cle)) {
      return res.status(403).json({ message: 'Réglage de sécurité : modifiable par un administrateur dans Paramètres > Sécurité.' });
    }
    if (p.cle.startsWith('FREQUENCE_')) {
      return res.status(400).json({ message: 'Fréquence de saisie : modifiable dans Paramètres > Fréquences de saisie.' });
    }
    await p.update({ valeur: req.body.valeur });
    res.json(p);
  } catch (e) { sendError(res, e, 400); }
});

// ── Alertes (seuils par produit) ──────────────────────────────
router.get('/alertes', async (req, res) => {
  try {
    const data = await ParametreAlerte.findAll({
      include: [{ model: Produit, as: 'produit' }],
      order: [[{ model: Produit, as: 'produit' }, 'code', 'ASC']],
    });
    res.json(data);
  } catch (e) { sendError(res, e); }
});

router.put('/alertes/:id', v.alerte, async (req, res) => {
  try {
    const a = await ParametreAlerte.findByPk(req.params.id);
    if (!a) return res.status(404).json({ message: 'Alerte introuvable' });
    await a.update(v.pick(req.body, ['seuil_jours', 'actif']));
    res.json(a);
  } catch (e) { sendError(res, e, 400); }
});

module.exports = router;
