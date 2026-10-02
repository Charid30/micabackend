const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const jwtConfig = require('../config/jwt');
const { Utilisateur, Agent, Direction, Entreprise, Permission } = require('../models');

const _userIncludes = [
  {
    model: Agent, as: 'agent',
    include: [{ model: Direction, as: 'direction', include: [{ model: Entreprise, as: 'entreprise' }] }],
  },
  { model: Permission, as: 'permissions', required: false },
];

const login = async (identifiant, password) => {
  const user = await Utilisateur.findOne({
    where: {
      del: 0,
      [Op.or]: [{ username: identifiant }, { email: identifiant }],
    },
    include: _userIncludes,
  });

  if (!user) throw { status: 401, message: 'Identifiant ou mot de passe incorrect.' };

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) throw { status: 401, message: 'Identifiant ou mot de passe incorrect.' };

  const token = jwt.sign(
    { id: user.id, username: user.username },
    jwtConfig.secret,
    { expiresIn: jwtConfig.expiresIn }
  );

  return {
    token,
    utilisateur: {
      id: user.id,
      username: user.username,
      email: user.email,
      is_admin: user.is_admin,
      agent: user.agent,
      permissions: user.permissions,
    },
  };
};

const getMe = async (userId) => {
  return Utilisateur.findOne({
    where: { id: userId, del: 0 },
    include: _userIncludes,
  });
};

const changePassword = async (userId, ancienMotDePasse, nouveauMotDePasse) => {
  if (!nouveauMotDePasse || nouveauMotDePasse.length < 8) {
    throw { status: 400, message: 'Le nouveau mot de passe doit contenir au moins 8 caractères.' };
  }

  const user = await Utilisateur.findByPk(userId);
  if (!user) throw { status: 404, message: 'Utilisateur introuvable.' };

  const valid = await bcrypt.compare(ancienMotDePasse, user.password);
  if (!valid) throw { status: 400, message: 'Ancien mot de passe incorrect.' };

  const hash = await bcrypt.hash(nouveauMotDePasse, 10);
  await user.update({ password: hash, updated_by: userId, updated_at: new Date() });
};

module.exports = { login, getMe, changePassword };
