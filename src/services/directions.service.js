const { Direction, Entreprise } = require('../models');

const include = [{ model: Entreprise, as: 'entreprise', attributes: ['id', 'nom', 'acronyme'] }];

const getAll = async () => {
  return Direction.findAll({
    where: { del: 0 },
    include,
    order: [['acronyme', 'ASC']],
  });
};

const getByEntreprise = async (entrepriseId) => {
  return Direction.findAll({
    where: { del: 0, entreprise_id: entrepriseId },
    order: [['acronyme', 'ASC']],
  });
};

const create = async (data, userId) => {
  const { entreprise_id, acronyme, description } = data;
  if (!entreprise_id || !acronyme) throw { status: 400, message: 'Entreprise et acronyme sont requis.' };
  return Direction.create({
    entreprise_id, acronyme: acronyme.trim().toUpperCase(),
    description: description?.trim() || null,
    created_by: userId, updated_by: userId,
  });
};

const update = async (id, data, userId) => {
  const d = await Direction.findOne({ where: { id, del: 0 } });
  if (!d) throw { status: 404, message: 'Direction introuvable.' };
  await d.update({
    entreprise_id: data.entreprise_id || d.entreprise_id,
    acronyme: data.acronyme?.trim().toUpperCase() || d.acronyme,
    description: data.description?.trim() !== undefined ? data.description?.trim() : d.description,
    updated_by: userId, updated_at: new Date(),
  });
  return d;
};

const remove = async (id, userId) => {
  const d = await Direction.findOne({ where: { id, del: 0 } });
  if (!d) throw { status: 404, message: 'Direction introuvable.' };
  await d.update({ del: 1, deleted_by: userId, deleted_at: new Date() });
};

module.exports = { getAll, getByEntreprise, create, update, remove };
