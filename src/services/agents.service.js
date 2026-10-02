const { Agent, Direction, Entreprise } = require('../models');

const include = [
  {
    model: Direction, as: 'direction', attributes: ['id', 'acronyme'],
    include: [{ model: Entreprise, as: 'entreprise', attributes: ['id', 'nom', 'acronyme'] }],
  },
];

const getAll = async () => {
  return Agent.findAll({
    where: { del: 0 },
    include,
    order: [['nom', 'ASC']],
  });
};

const getById = async (id) => {
  const agent = await Agent.findOne({ where: { id, del: 0 }, include });
  if (!agent) throw { status: 404, message: 'Agent introuvable.' };
  return agent;
};

const create = async (data, userId) => {
  const { direction_id, matricule, nom, prenoms } = data;
  if (!direction_id || !matricule || !nom) {
    throw { status: 400, message: 'Direction, matricule et nom sont requis.' };
  }
  return Agent.create({
    direction_id, matricule: matricule.trim(), nom: nom.trim(),
    prenoms: prenoms?.trim() || null,
    created_by: userId, updated_by: userId,
  });
};

const update = async (id, data, userId) => {
  const agent = await Agent.findOne({ where: { id, del: 0 } });
  if (!agent) throw { status: 404, message: 'Agent introuvable.' };
  const { direction_id, matricule, nom, prenoms } = data;
  await agent.update({
    direction_id: direction_id || agent.direction_id,
    matricule: matricule?.trim() || agent.matricule,
    nom: nom?.trim() || agent.nom,
    prenoms: prenoms?.trim() !== undefined ? prenoms?.trim() : agent.prenoms,
    updated_by: userId, updated_at: new Date(),
  });
  return agent;
};

const remove = async (id, userId) => {
  const agent = await Agent.findOne({ where: { id, del: 0 } });
  if (!agent) throw { status: 404, message: 'Agent introuvable.' };
  await agent.update({ del: 1, deleted_by: userId, deleted_at: new Date() });
};

module.exports = { getAll, getById, create, update, remove };
