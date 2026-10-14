const express = require('express');
const router = express.Router();
const { Marketeur } = require('../models');
const { authenticate, writeRequires } = require('../middleware/auth');
const { sendError } = require('../utils/http-error');
const v = require('../middleware/validate');

const FIELDS = ['code', 'libelle'];

router.use(authenticate);
// Lecture : tout utilisateur connecté (écrans de saisie) ; écriture : permission parametres:WRITE
router.use(writeRequires('parametres'));

router.get('/', async (req, res) => {
  try {
    const data = await Marketeur.findAll({ where: { del: 0 }, order: [['code', 'ASC']] });
    res.json(data);
  } catch (e) { sendError(res, e); }
});

router.post('/', v.reference(false, []), async (req, res) => {
  try {
    const item = await Marketeur.create({ ...v.pick(req.body, FIELDS), created_by: req.user.id, updated_by: req.user.id });
    res.status(201).json(item);
  } catch (e) { sendError(res, e, 400); }
});

router.put('/:id', v.reference(true, []), async (req, res) => {
  try {
    const item = await Marketeur.findOne({ where: { id: req.params.id, del: 0 } });
    if (!item) return res.status(404).json({ message: 'Marketeur introuvable' });
    await item.update({ ...v.pick(req.body, FIELDS), updated_by: req.user.id });
    res.json(item);
  } catch (e) { sendError(res, e, 400); }
});

router.delete('/:id', v.idParam, async (req, res) => {
  try {
    const item = await Marketeur.findOne({ where: { id: req.params.id, del: 0 } });
    if (!item) return res.status(404).json({ message: 'Marketeur introuvable' });
    await item.update({ del: 1, deleted_by: req.user.id, deleted_at: new Date() });
    res.json({ message: 'Supprimé' });
  } catch (e) { sendError(res, e, 400); }
});

module.exports = router;
