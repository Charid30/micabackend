const bcrypt = require('bcryptjs');
const { Utilisateur, Agent, Direction, Entreprise, Permission } = require('../models');

const MODULES = [
  'stocks', 'impompable', 'corridors', 'depots-int', 'temps-attente',
  'veille-marche', 'veille-geo', 'achats-traders', 'ventes',
  'rapports', 'administration', 'parametres',
];

const PROFILS = {
  ADMIN: { is_admin: true, permissions: [] },
  GESTIONNAIRE: {
    is_admin: false,
    permissions: MODULES.filter(m => m !== 'administration').map(m => ({
      module: m, action: m === 'rapports' ? 'READ' : 'WRITE',
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
  const { agent_id, username, email, tel, password, profil } = data;
  if (!agent_id || !username || !email || !password) {
    throw { status: 400, message: 'Agent, username, email et mot de passe sont requis.' };
  }
  const hash = await bcrypt.hash(password, 10);
  const profilData = PROFILS[profil] || PROFILS.LECTEUR;

  const user = await Utilisateur.create({
    agent_id, username: username.trim(), email: email.trim(),
    tel: tel?.trim() || null, password: hash,
    is_admin: profilData.is_admin ? 1 : 0,
    created_by: userId, updated_by: userId,
  });

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

const resetPassword = async (id, newPassword, userId) => {
  const u = await Utilisateur.findOne({ where: { id, del: 0 } });
  if (!u) throw { status: 404, message: 'Utilisateur introuvable.' };
  const hash = await bcrypt.hash(newPassword, 10);
  await u.update({ password: hash, updated_by: userId, updated_at: new Date() });
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
  // Hard delete — les permissions sont entièrement recréées à chaque sauvegarde
  await Permission.destroy({ where: { utilisateur_id: utilisateurId } });

  const toInsert = permissionsData.filter(p => p.action && p.action !== 'NONE');
  if (toInsert.length > 0) {
    await Permission.bulkCreate(
      toInsert.map(p => ({
        utilisateur_id: utilisateurId,
        module: p.module,
        action: p.action,
        created_by: userId, updated_by: userId,
      }))
    );
  }
};

module.exports = { getAll, getById, create, update, resetPassword, toggleActif, remove, getPermissions, savePermissions, MODULES };
