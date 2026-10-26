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
const { Depot } = require('../models');
const { authenticate, writeRequires } = require('../middleware/auth');
const { sendError } = require('../utils/http-error');
const v = require('../middleware/validate');

const FIELDS = ['code', 'libelle', 'type', 'pays'];

router.use(authenticate);
// Lecture : tout utilisateur connecté (écrans de saisie) ; écriture : permission parametres:WRITE
router.use(writeRequires('parametres'));

router.get('/', async (req, res) => {
  try {
    const data = await Depot.findAll({ where: { del: 0 }, order: [['type', 'ASC'], ['code', 'ASC']] });
    res.json(data);
  } catch (e) { sendError(res, e); }
});

router.post('/', v.reference(false, v.depotExtra), async (req, res) => {
  try {
    const item = await Depot.create({ ...v.pick(req.body, FIELDS), created_by: req.user.id, updated_by: req.user.id });
    res.status(201).json(item);
  } catch (e) { sendError(res, e, 400); }
});

router.put('/:id', v.reference(true, v.depotExtra), async (req, res) => {
  try {
    const item = await Depot.findOne({ where: { id: req.params.id, del: 0 } });
    if (!item) return res.status(404).json({ message: 'Dépôt introuvable' });
    await item.update({ ...v.pick(req.body, FIELDS), updated_by: req.user.id });
    res.json(item);
  } catch (e) { sendError(res, e, 400); }
});

router.delete('/:id', v.idParam, async (req, res) => {
  try {
    const item = await Depot.findOne({ where: { id: req.params.id, del: 0 } });
    if (!item) return res.status(404).json({ message: 'Dépôt introuvable' });
    await item.update({ del: 1, deleted_by: req.user.id, deleted_at: new Date() });
    res.json({ message: 'Supprimé' });
  } catch (e) { sendError(res, e, 400); }
});

module.exports = router;
