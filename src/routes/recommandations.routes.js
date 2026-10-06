const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const recoService = require('../services/recommandations.service');

router.get('/semaine-courante', authenticate, async (req, res) => {
  try {
    res.json(await recoService.getSaisieData(req.user.id));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/saisie', authenticate, async (req, res) => {
  try {
    const { rapport_id, ...data } = req.body;
    res.json(await recoService.saveSaisie(rapport_id, data, req.user.id));
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;
