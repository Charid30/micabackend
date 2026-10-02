const express = require('express');
const router = express.Router();
const { Parametre, ParametreAlerte, Produit } = require('../models');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

// ── Paramètres généraux (clé/valeur) ─────────────────────────
router.get('/', async (req, res) => {
  try {
    const data = await Parametre.findAll({ order: [['cle', 'ASC']] });
    res.json(data);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const p = await Parametre.findByPk(req.params.id);
    if (!p) return res.status(404).json({ message: 'Paramètre introuvable' });
    await p.update({ valeur: req.body.valeur });
    res.json(p);
  } catch (e) { res.status(400).json({ message: e.message }); }
});

// ── Alertes (seuils par produit) ──────────────────────────────
router.get('/alertes', async (req, res) => {
  try {
    const data = await ParametreAlerte.findAll({
      include: [{ model: Produit, as: 'produit' }],
      order: [[{ model: Produit, as: 'produit' }, 'code', 'ASC']],
    });
    res.json(data);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.put('/alertes/:id', async (req, res) => {
  try {
    const a = await ParametreAlerte.findByPk(req.params.id);
    if (!a) return res.status(404).json({ message: 'Alerte introuvable' });
    await a.update({ seuil_jours: req.body.seuil_jours, actif: req.body.actif });
    res.json(a);
  } catch (e) { res.status(400).json({ message: e.message }); }
});

module.exports = router;
