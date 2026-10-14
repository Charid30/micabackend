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

const issueToken = (user) => jwt.sign(
  { id: user.id, username: user.username },
  jwtConfig.secret,
  { expiresIn: jwtConfig.expiresIn, algorithm: 'HS256' }
);

// Verrouillage du compte après plusieurs échecs (protège contre la force brute distribuée sur plusieurs IP)
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;
const INVALID_CREDENTIALS = { status: 401, message: 'Identifiant ou mot de passe incorrect.' };
// Hash factice : le temps de réponse est le même que le compte existe ou non (pas d'énumération des comptes)
const DUMMY_HASH = bcrypt.hashSync('compte-inexistant', 10);

const login = async (identifiant, password) => {
  const user = await Utilisateur.scope('withPassword').findOne({
    where: {
      del: 0,
      [Op.or]: [{ username: identifiant }, { email: identifiant }],
    },
    include: _userIncludes,
  });

  if (!user) {
    await bcrypt.compare(password, DUMMY_HASH);
    throw INVALID_CREDENTIALS;
  }

  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    const minutes = Math.ceil((new Date(user.locked_until) - new Date()) / 60000);
    throw { status: 423, message: `Compte temporairement verrouillé suite à plusieurs échecs. Réessayez dans ${minutes} minute(s).` };
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    const attempts = (user.failed_login_attempts || 0) + 1;
    if (attempts >= MAX_FAILED_ATTEMPTS) {
      await user.update({ failed_login_attempts: 0, locked_until: new Date(Date.now() + LOCK_DURATION_MS) });
      throw { status: 423, message: 'Trop de tentatives échouées. Compte verrouillé pendant 15 minutes.' };
    }
    await user.update({ failed_login_attempts: attempts });
    throw INVALID_CREDENTIALS;
  }

  if (user.failed_login_attempts || user.locked_until) {
    await user.update({ failed_login_attempts: 0, locked_until: null });
  }

  return {
    token: issueToken(user),
    utilisateur: {
      id: user.id,
      username: user.username,
      email: user.email,
      is_admin: user.is_admin,
      must_change_password: !!user.must_change_password,
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

function validatePasswordStrength(password) {
  if (typeof password !== 'string' || password.length > 128)
    throw { status: 400, message: 'Mot de passe invalide.' };
  if (password.length < 8)
    throw { status: 400, message: 'Le mot de passe doit contenir au moins 8 caractères.' };
  if (!/[A-Z]/.test(password))
    throw { status: 400, message: 'Le mot de passe doit contenir au moins une lettre majuscule.' };
  if (!/[0-9]/.test(password))
    throw { status: 400, message: 'Le mot de passe doit contenir au moins un chiffre.' };
  if (!/[^A-Za-z0-9]/.test(password))
    throw { status: 400, message: 'Le mot de passe doit contenir au moins un caractère spécial (ex : @, #, !, %).' };
}

const changePassword = async (userId, ancienMotDePasse, nouveauMotDePasse) => {
  validatePasswordStrength(nouveauMotDePasse);

  const user = await Utilisateur.scope('withPassword').findByPk(userId);
  if (!user) throw { status: 404, message: 'Utilisateur introuvable.' };

  const valid = await bcrypt.compare(String(ancienMotDePasse), user.password);
  if (!valid) throw { status: 400, message: 'Ancien mot de passe incorrect.' };

  const hash = await bcrypt.hash(nouveauMotDePasse, 10);
  const now = new Date();
  await user.update({ password: hash, password_changed_at: now, updated_by: userId, updated_at: now });
};

const forcedChangePassword = async (userId, newPassword) => {
  validatePasswordStrength(newPassword);
  const user = await Utilisateur.findByPk(userId);
  if (!user) throw { status: 404, message: 'Utilisateur introuvable.' };
  const hash = await bcrypt.hash(newPassword, 10);
  const now = new Date();
  await user.update({ password: hash, must_change_password: 0, password_changed_at: now, updated_by: userId, updated_at: now });
};

module.exports = { login, getMe, changePassword, forcedChangePassword, validatePasswordStrength, issueToken };
