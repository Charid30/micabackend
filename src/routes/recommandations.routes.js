const express = require('express');
const router = express.Router();
const { authorize } = require('../middleware/auth');
const recoService = require('../services/recommandations.service');

router.get('/semaine-courante', authorize('recommandations', 'READ'), async (req, res) => {
  try {
    res.json(await recoService.getSaisieData(req.user.id));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/saisie', authorize('recommandations', 'WRITE'), async (req, res) => {
  try {
    const { rapport_id, tendance_generale, risques_majeurs, impact_sonabhy, recommandations } = req.body;
    if (!rapport_id) return res.status(400).json({ message: 'rapport_id est requis.' });
    res.json(await recoService.saveSaisie(rapport_id,
      { tendance_generale, risques_majeurs, impact_sonabhy, recommandations }, req.user.id));
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;
