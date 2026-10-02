const express = require('express');
const router = express.Router();
const { Marketeur } = require('../models');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const data = await Marketeur.findAll({ where: { del: 0 }, order: [['code', 'ASC']] });
    res.json(data);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.post('/', async (req, res) => {
  try {
    const m = await Marketeur.create({ ...req.body, created_by: req.user.id, updated_by: req.user.id });
    res.status(201).json(m);
  } catch (e) { res.status(400).json({ message: e.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const m = await Marketeur.findOne({ where: { id: req.params.id, del: 0 } });
    if (!m) return res.status(404).json({ message: 'Marketeur introuvable' });
    await m.update({ ...req.body, updated_by: req.user.id });
    res.json(m);
  } catch (e) { res.status(400).json({ message: e.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const m = await Marketeur.findOne({ where: { id: req.params.id, del: 0 } });
    if (!m) return res.status(404).json({ message: 'Marketeur introuvable' });
    await m.update({ del: 1, deleted_by: req.user.id, deleted_at: new Date() });
    res.json({ message: 'Supprimé' });
  } catch (e) { res.status(400).json({ message: e.message }); }
});

module.exports = router;
