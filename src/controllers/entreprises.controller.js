/* ==================================================================
 *  Auteur : BATIONO Ulrich Rachid Kévin
 *           Expert en Sécurité Informatique
 *           Développeur FullStack
 *           Tel: +226 51 57 82 89 // 66 72 02 32
 *           Whatsapp: +226 51 57 82 89
 *           Mail: bkevin@sonabhy.bf // bationor10@gmail.com
 *  Projet : MICA – SONABHY
 * ================================================================== */
const svc = require('../services/entreprises.service');
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
  try { await svc.remove(+req.params.id, req.user.id); res.json({ message: 'Entreprise supprimée.' }); }
  catch (e) { sendError(res, e); }
};
