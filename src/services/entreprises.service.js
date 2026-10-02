const { Entreprise, Direction } = require('../models');

const getAll = async () => {
  return Entreprise.findAll({
    where: { del: 0 },
    include: [{ model: Direction, as: 'directions', where: { del: 0 }, required: false, attributes: ['id', 'acronyme', 'description'] }],
    order: [['nom', 'ASC']],
  });
};

const getById = async (id) => {
  const e = await Entreprise.findOne({
    where: { id, del: 0 },
    include: [{ model: Direction, as: 'directions', where: { del: 0 }, required: false }],
  });
  if (!e) throw { status: 404, message: 'Entreprise introuvable.' };
  return e;
};

const create = async (data, userId) => {
  const { nom, acronyme, description } = data;
  if (!nom || !acronyme) throw { status: 400, message: 'Nom et acronyme sont requis.' };
  return Entreprise.create({
    nom: nom.trim(), acronyme: acronyme.trim().toUpperCase(),
    description: description?.trim() || null,
    created_by: userId, updated_by: userId,
  });
};

const update = async (id, data, userId) => {
  const e = await Entreprise.findOne({ where: { id, del: 0 } });
  if (!e) throw { status: 404, message: 'Entreprise introuvable.' };
  await e.update({
    nom: data.nom?.trim() || e.nom,
    acronyme: data.acronyme?.trim().toUpperCase() || e.acronyme,
    description: data.description?.trim() !== undefined ? data.description?.trim() : e.description,
    updated_by: userId, updated_at: new Date(),
  });
  return e;
};

const remove = async (id, userId) => {
  const e = await Entreprise.findOne({ where: { id, del: 0 } });
  if (!e) throw { status: 404, message: 'Entreprise introuvable.' };
  await e.update({ del: 1, deleted_by: userId, deleted_at: new Date() });
};

module.exports = { getAll, getById, create, update, remove };
