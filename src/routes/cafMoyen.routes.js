const express = require('express');
const router = express.Router();
const { authorize } = require('../middleware/auth');
const cafService = require('../services/cafMoyen.service');

router.get('/', authorize('caf_moyen', 'READ'), async (req, res) => {
  try {
    const annee = req.query.annee ? parseInt(req.query.annee) : null;
    res.json(await cafService.getData(annee));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/saisie', authorize('caf_moyen', 'WRITE'), async (req, res) => {
  try {
    const { entries } = req.body;
    if (!Array.isArray(entries)) return res.status(400).json({ message: 'entries doit être un tableau.' });
    res.json(await cafService.saveEntries(entries, req.user.id));
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;
