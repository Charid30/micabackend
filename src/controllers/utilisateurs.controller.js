const svc = require('../services/utilisateurs.service');
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

exports.resetPassword = async (req, res) => {
  const { password, must_change_password } = req.body;
  if (!password) return res.status(400).json({ message: 'Nouveau mot de passe requis.' });
  try { await svc.resetPassword(+req.params.id, password, req.user.id, !!must_change_password); res.json({ message: 'Mot de passe réinitialisé.' }); }
  catch (e) { sendError(res, e); }
};

exports.remove = async (req, res) => {
  try { await svc.remove(+req.params.id, req.user.id); res.json({ message: 'Utilisateur supprimé.' }); }
  catch (e) { sendError(res, e); }
};

exports.getPermissions = async (req, res) => {
  try { res.json(await svc.getPermissions(+req.params.id)); }
  catch (e) { sendError(res, e); }
};

exports.savePermissions = async (req, res) => {
  const { permissions } = req.body;
  if (!Array.isArray(permissions)) return res.status(400).json({ message: 'Format invalide.' });
  try { await svc.savePermissions(+req.params.id, permissions, req.user.id); res.json({ message: 'Permissions enregistrées.' }); }
  catch (e) { sendError(res, e); }
};

exports.getModules = async (req, res) => {
  res.json(svc.MODULES);
};
