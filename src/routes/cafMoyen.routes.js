const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const cafService = require('../services/cafMoyen.service');

router.get('/', authenticate, async (req, res) => {
  try {
    const annee = req.query.annee ? parseInt(req.query.annee) : null;
    res.json(await cafService.getData(annee));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/saisie', authenticate, async (req, res) => {
  try {
    const { entries } = req.body;
    res.json(await cafService.saveEntries(entries, req.user.id));
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;
