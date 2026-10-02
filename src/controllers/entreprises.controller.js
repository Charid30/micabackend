const svc = require('../services/entreprises.service');

exports.getAll = async (req, res) => {
  try { res.json(await svc.getAll()); }
  catch (e) { res.status(e.status || 500).json({ message: e.message }); }
};

exports.getById = async (req, res) => {
  try { res.json(await svc.getById(+req.params.id)); }
  catch (e) { res.status(e.status || 500).json({ message: e.message }); }
};

exports.create = async (req, res) => {
  try { res.status(201).json(await svc.create(req.body, req.user.id)); }
  catch (e) { res.status(e.status || 500).json({ message: e.message }); }
};

exports.update = async (req, res) => {
  try { res.json(await svc.update(+req.params.id, req.body, req.user.id)); }
  catch (e) { res.status(e.status || 500).json({ message: e.message }); }
};

exports.remove = async (req, res) => {
  try { await svc.remove(+req.params.id, req.user.id); res.json({ message: 'Entreprise supprimée.' }); }
  catch (e) { res.status(e.status || 500).json({ message: e.message }); }
};
