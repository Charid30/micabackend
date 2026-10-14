const svc = require('../services/agents.service');
const { sendError } = require('../utils/http-error');

exports.getAll = async (req, res) => {
  try { res.json(await svc.getAll()); }
  catch (e) { sendError(res, e); }
};

exports.getById = async (req, res) => {
  try { res.json(await svc.getById(+req.params.id)); }
  catch (e) { sendError(res, e); }
};

exports.create = async (req, res) => {
  try { res.status(201).json(await svc.create(req.body, req.user.id)); }
  catch (e) { sendError(res, e); }
};

exports.update = async (req, res) => {
  try { res.json(await svc.update(+req.params.id, req.body, req.user.id)); }
  catch (e) { sendError(res, e); }
};

exports.remove = async (req, res) => {
  try { await svc.remove(+req.params.id, req.user.id); res.json({ message: 'Agent supprimé.' }); }
  catch (e) { sendError(res, e); }
};
