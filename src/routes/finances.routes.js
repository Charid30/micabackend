const express = require('express');
const router = express.Router();
const { authorize } = require('../middleware/auth');
const tresoService = require('../services/tresorerie.service');

router.get('/semaine-courante', authorize('tresorerie', 'READ'), async (req, res) => {
  try {
    res.json(await tresoService.getSaisieData(req.user.id));
  } catch (err) {
    console.error('[TRESORERIE]', err);
    res.status(500).json({ message: err.message });
  }
});

router.post('/saisie', authorize('tresorerie', 'WRITE'), async (req, res) => {
  try {
    const { rapport_id, lignes } = req.body;
    if (!rapport_id || !Array.isArray(lignes)) {
      return res.status(400).json({ message: 'rapport_id et lignes sont requis.' });
    }
    res.json(await tresoService.saveSaisie(rapport_id, lignes, req.user.id));
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;
