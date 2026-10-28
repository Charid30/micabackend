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
const bcrypt = require('bcryptjs');
const { Utilisateur, Agent, Direction, Entreprise, Permission } = require('../models');
const { validatePasswordStrength } = require('./auth.service');

const MODULES = [
  'stocks', 'impompable', 'referentiel-stocks', 'actions-stocks', 'corridors', 'depots-int', 'temps-attente',
  'veille-marche', 'veille-geo', 'achats-traders', 'encours-livraison', 'ventes',
  'tresorerie', 'tresorerie-lignes', 'recommandations', 'caf_moyen',
  'rapports', 'administration', 'parametres',
];

// Droits reserves a une personne designee : jamais accordes en ecriture par un profil type,
// l'administrateur les attribue nominativement (ecran Utilisateurs > permissions)
const MODULES_DESIGNES = ['impompable', 'referentiel-stocks', 'actions-stocks', 'tresorerie-lignes'];

const PROFILS = {
  ADMIN: { is_admin: true, permissions: [] },
  GESTIONNAIRE: {
    is_admin: false,
    permissions: MODULES.filter(m => m !== 'administration').map(m => ({
      module: m, action: m === 'rapports' || MODULES_DESIGNES.includes(m) ? 'READ' : 'WRITE',
    })),
  },
  LECTEUR: {
    is_admin: false,
    permissions: MODULES.filter(m => m !== 'administration').map(m => ({ module: m, action: 'READ' })),
  },
};

const _include = [
  {
    model: Agent, as: 'agent', attributes: ['id', 'matricule', 'nom', 'prenoms'],
    include: [{
      model: Direction, as: 'direction', attributes: ['id', 'acronyme'],
      include: [{ model: Entreprise, as: 'entreprise', attributes: ['id', 'acronyme'] }],
    }],
  },
  { model: Permission, as: 'permissions', where: { del: 0 }, required: false },
];

const getAll = async () => {
  return Utilisateur.findAll({
    where: { del: 0 },
    include: _include,
    order: [[{ model: Agent, as: 'agent' }, 'nom', 'ASC']],
  });
};

const getById = async (id) => {
  const u = await Utilisateur.findOne({ where: { id, del: 0 }, include: _include });
  if (!u) throw { status: 404, message: 'Utilisateur introuvable.' };
  return u;
};

const create = async (data, userId) => {
  const { agent_id, username, email, tel, password, profil, must_change_password } = data;
  if (!agent_id || !username || !email || !password) {
    throw { status: 400, message: 'Agent, username, email et mot de passe sont requis.' };
  }
  validatePasswordStrength(password);
  const hash = await bcrypt.hash(password, 10);
  const profilData = PROFILS[profil] || PROFILS.LECTEUR;

  const user = await Utilisateur.create({
    agent_id, username: username.trim(), email: email.trim(),
    tel: tel?.trim() || null, password: hash,
    is_admin: profilData.is_admin ? 1 : 0,
    must_change_password: must_change_password ? 1 : 0,
    created_by: userId, updated_by: userId,
  });
  delete user.dataValues.password; // ne jamais renvoyer le hash au client

  if (profilData.permissions.length > 0) {
    await Permission.bulkCreate(
      profilData.permissions.map(p => ({
        utilisateur_id: user.id, module: p.module, action: p.action,
        created_by: userId, updated_by: userId,
      }))
    );
  }
  return user;
};

const update = async (id, data, userId) => {
  const u = await Utilisateur.findOne({ where: { id, del: 0 } });
  if (!u) throw { status: 404, message: 'Utilisateur introuvable.' };
  const updates = {};
  if (data.username) updates.username = data.username.trim();
  if (data.email) updates.email = data.email.trim();
  if (data.tel !== undefined) updates.tel = data.tel?.trim() || null;
  if (data.is_admin !== undefined) updates.is_admin = data.is_admin ? 1 : 0;
  updates.updated_by = userId;
  updates.updated_at = new Date();
  await u.update(updates);
  return u;
};

const resetPassword = async (id, newPassword, userId, mustChangePassword = false) => {
  const u = await Utilisateur.findOne({ where: { id, del: 0 } });
  if (!u) throw { status: 404, message: 'Utilisateur introuvable.' };
  validatePasswordStrength(newPassword);
  const hash = await bcrypt.hash(newPassword, 10);
  const now = new Date();
  // password_changed_at invalide les sessions ouvertes avec l'ancien mot de passe ; on lève aussi un éventuel verrouillage
  await u.update({
    password: hash, must_change_password: mustChangePassword ? 1 : 0,
    password_changed_at: now, failed_login_attempts: 0, locked_until: null,
    updated_by: userId, updated_at: now,
  });
};

const toggleActif = async (id, userId) => {
  const u = await Utilisateur.findOne({ where: { id, del: 0 } });
  if (!u) throw { status: 404, message: 'Utilisateur introuvable.' };
  const newVal = u.del === 0 ? 1 : 0;
  // we use a separate "actif" semantic: del=1 means désactivé, del=0 means actif
  // Actually let's use is_admin as a proxy - no, use del but careful
  // Better: add actif logic as del flag for now
  await u.update({ del: newVal, updated_by: userId, updated_at: new Date() });
};

const remove = async (id, userId) => {
  const u = await Utilisateur.findOne({ where: { id, del: 0 } });
  if (!u) throw { status: 404, message: 'Utilisateur introuvable.' };
  await u.update({ del: 1, deleted_by: userId, deleted_at: new Date() });
};

const getPermissions = async (userId) => {
  return Permission.findAll({ where: { utilisateur_id: userId } });
};

const savePermissions = async (utilisateurId, permissionsData, userId) => {
  const inconnu = permissionsData.find(p => !MODULES.includes(p.module));
  if (inconnu) throw { status: 400, message: `Module inconnu : ${String(inconnu.module).slice(0, 50)}` };
  await Permission.destroy({ where: { utilisateur_id: utilisateurId } });

  const toInsert = permissionsData.filter(p => p.action && p.action !== 'NONE');
  if (toInsert.length > 0) {
    await Permission.bulkCreate(
      toInsert.map(p => ({
        utilisateur_id: utilisateurId,
        module: p.module,
        action: p.action,
        depot_id: p.depot_id || null,
        created_by: userId, updated_by: userId,
      }))
    );
  }
};

module.exports = { getAll, getById, create, update, resetPassword, toggleActif, remove, getPermissions, savePermissions, MODULES };
