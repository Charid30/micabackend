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
// Interims : un compte recoit, du premier au dernier jour inclus, les droits propres d'un agent absent.
//  - les droits sont lus a chaque requete : ils s'arretent seuls a la fin, sans rien retirer ;
//  - seuls les droits propres du titulaire passent (pas ceux d'un autre interim, jamais les droits administrateur) ;
//  - chaque droit recu porte interim_de : le journal d'audit l'indique quand il a servi.
const { Op } = require('sequelize');
const { Interim, Permission, Depot, Utilisateur, Agent } = require('../models');
const { aujourdhui } = require('./frequence.service');
const { MODULES } = require('./utilisateurs.service');
const { LIBELLES } = require('./profil.service');

const DUREE_MAX_JOURS = 366;
const erreur = (message, status = 400) => ({ status, message });

const nomDe = (u) => {
  const nom = [u?.agent?.prenoms, u?.agent?.nom].filter(Boolean).join(' ');
  return nom || u?.username || '';
};
const avecAgent = (as) => ({ model: Utilisateur, as, attributes: ['id', 'username', 'is_admin', 'del'], include: [{ model: Agent, as: 'agent', attributes: ['nom', 'prenoms'] }] });

const exclus = (i) => String(i.modules_exclus || '').split(',').filter(Boolean);

// Interims en cours un jour donne (fin incluse), non arretes
const enCoursLe = (jour) => ({ del: 0, termine_le: null, date_debut: { [Op.lte]: jour }, date_fin: { [Op.gte]: jour } });

/** Droits recus par interim, par compte : { permissions, interims } */
const droitsRecus = async (utilisateurIds, { depot = false } = {}) => {
  const ids = [...new Set(utilisateurIds)].filter(Boolean);
  if (!ids.length) return new Map();
  const interims = await Interim.findAll({ where: { ...enCoursLe(aujourdhui()), interimaire_id: ids }, include: [avecAgent('titulaire')] });
  const valides = interims.filter(i => i.titulaire && !i.titulaire.del && !i.titulaire.is_admin);
  if (!valides.length) return new Map();
  const permissions = await Permission.findAll({
    where: { utilisateur_id: valides.map(i => i.titulaire_id), del: 0 },
    include: depot ? [{ model: Depot, as: 'depot', attributes: ['id', 'code', 'libelle', 'type'], required: false }] : [],
  });
  const resultat = new Map();
  for (const i of valides) {
    const recu = resultat.get(i.interimaire_id) || { permissions: [], interims: [] };
    const sauf = exclus(i);
    const titulaire = nomDe(i.titulaire);
    permissions.filter(p => p.utilisateur_id === i.titulaire_id && p.action !== 'NONE' && !sauf.includes(p.module)).forEach((p) => {
      recu.permissions.push({ ...p.get({ plain: true }), interim_de: titulaire, interim_id: i.id });
    });
    recu.interims.push({ id: i.id, titulaire, date_fin: i.date_fin });
    resultat.set(i.interimaire_id, recu);
  }
  return resultat;
};

// Ajoute les droits recus aux droits propres d'un compte charge avec ses permissions
const completer = (user, recu) => {
  const toutes = [...(user.permissions || []), ...(recu?.permissions || [])];
  user.dataValues.permissions = toutes;
  user.permissions = toutes;
  user.dataValues.interims = recu?.interims || [];
  user.interims = user.dataValues.interims;
  return user;
};

const completerUtilisateur = async (user, options) => (user ? completer(user, (await droitsRecus([user.id], options)).get(user.id)) : user);

const completerUtilisateurs = async (users, options) => {
  const recus = await droitsRecus(users.map(u => u.id), options);
  users.forEach(u => completer(u, recus.get(u.id)));
  return users;
};

// ── Administration
const statutDe = (i, jour = aujourdhui()) => {
  if (i.termine_le) return new Date(i.termine_le).toISOString().split('T')[0] < i.date_debut ? 'ANNULE' : 'ARRETE';
  if (i.date_debut > jour) return 'A_VENIR';
  if (i.date_fin < jour) return 'TERMINE';
  return 'EN_COURS';
};

const presenter = (i) => ({
  id: i.id, titulaire_id: i.titulaire_id, titulaire: nomDe(i.titulaire), interimaire_id: i.interimaire_id, interimaire: nomDe(i.interimaire),
  date_debut: i.date_debut, date_fin: i.date_fin, motif: i.motif, modules_exclus: exclus(i), termine_le: i.termine_le, statut: statutDe(i),
});

const lister = async () => {
  const rows = await Interim.findAll({ where: { del: 0 }, include: [avecAgent('titulaire'), avecAgent('interimaire')], order: [['date_debut', 'DESC'], ['id', 'DESC']], limit: 300 });
  return { aujourdhui: aujourdhui(), interims: rows.map(presenter) };
};

/** Droits propres d'un compte, proposes a la delegation */
const droitsDuTitulaire = async (id) => {
  const u = await Utilisateur.findOne({ where: { id: Number(id) || 0, del: 0 }, attributes: ['id', 'is_admin'] });
  if (!u) throw erreur('Compte introuvable.', 404);
  if (u.is_admin) return { administrateur: true, droits: [] };
  const permissions = await Permission.findAll({
    where: { utilisateur_id: u.id, del: 0, action: { [Op.ne]: 'NONE' } },
    include: [{ model: Depot, as: 'depot', attributes: ['libelle'], required: false }],
  });
  return {
    administrateur: false,
    droits: permissions.map(p => ({
      module: p.module, libelle: LIBELLES[p.module] || p.module, action: p.action, depot: p.depot?.libelle || null,
    })).sort((a, b) => a.libelle.localeCompare(b.libelle, 'fr')),
  };
};

const verifierDate = (date, libelle) => {
  const d = new Date(`${date}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date)) || Number.isNaN(d.getTime()) || d.toISOString().split('T')[0] !== date) throw erreur(`${libelle} invalide.`);
  return date;
};

const compteActif = async (id, libelle) => {
  const u = await Utilisateur.findOne({ where: { id: Number(id) || 0, del: 0 }, include: [{ model: Agent, as: 'agent', attributes: ['nom', 'prenoms'] }] });
  if (!u) throw erreur(`${libelle} : compte introuvable.`);
  return u;
};

// Periodes qui se chevauchent, hors interim modifie
const chevauche = (debut, fin, sauf) => ({
  del: 0, termine_le: null, date_debut: { [Op.lte]: fin }, date_fin: { [Op.gte]: debut }, ...(sauf ? { id: { [Op.ne]: sauf } } : {}),
});

const valider = async (corps, existant = null) => {
  const titulaire = await compteActif(existant ? existant.titulaire_id : corps?.titulaire_id, 'Titulaire');
  const interimaire = await compteActif(existant ? existant.interimaire_id : corps?.interimaire_id, 'Intérimaire');
  if (titulaire.id === interimaire.id) throw erreur('Le titulaire et l\'intérimaire doivent être deux comptes différents.');
  if (titulaire.is_admin) throw erreur('Le titulaire est administrateur : ses droits ne se transmettent pas par intérim.');
  if (interimaire.is_admin) throw erreur('L\'intérimaire est administrateur : il a déjà tous les droits.');

  const jour = aujourdhui();
  const debut = existant && statutDe(existant) === 'EN_COURS' ? existant.date_debut : verifierDate(corps?.date_debut, 'Date de début');
  const fin = verifierDate(corps?.date_fin, 'Date de fin');
  if (debut !== existant?.date_debut && debut < jour) throw erreur('La date de début ne peut pas être passée.');
  if (fin < debut) throw erreur('La date de fin précède la date de début.');
  if (fin < jour) throw erreur('La date de fin ne peut pas être passée.');
  if ((new Date(fin) - new Date(debut)) / 86400000 > DUREE_MAX_JOURS) throw erreur(`Un intérim dure au plus ${DUREE_MAX_JOURS} jours.`);

  const propres = (await Permission.findAll({ where: { utilisateur_id: titulaire.id, del: 0, action: { [Op.ne]: 'NONE' } }, attributes: ['module'] })).map(p => p.module);
  if (!propres.length) throw erreur('Le titulaire n\'a aucun droit à confier.');
  const sauf = [...new Set(Array.isArray(corps?.modules_exclus) ? corps.modules_exclus : [])];
  if (sauf.some(m => !MODULES.includes(m) || !propres.includes(m))) throw erreur('Droit inconnu pour ce titulaire.');
  if (propres.every(m => sauf.includes(m))) throw erreur('Laissez au moins un droit à l\'intérimaire.');

  const id = existant?.id;
  const [dejaRemplace, interimaireAbsent, titulaireOccupe] = await Promise.all([
    Interim.findOne({ where: { ...chevauche(debut, fin, id), titulaire_id: titulaire.id } }),
    Interim.findOne({ where: { ...chevauche(debut, fin, id), titulaire_id: interimaire.id } }),
    Interim.findOne({ where: { ...chevauche(debut, fin, id), interimaire_id: titulaire.id } }),
  ]);
  if (dejaRemplace) throw erreur(`${nomDe(titulaire)} a déjà un intérim sur cette période.`);
  if (interimaireAbsent) throw erreur(`${nomDe(interimaire)} est lui-même absent sur cette période.`);
  if (titulaireOccupe) throw erreur(`${nomDe(titulaire)} assure déjà un intérim sur cette période.`);

  return { titulaire_id: titulaire.id, interimaire_id: interimaire.id, date_debut: debut, date_fin: fin,
    motif: typeof corps?.motif === 'string' && corps.motif.trim() ? corps.motif.trim().slice(0, 255) : null,
    modules_exclus: sauf.length ? sauf.join(',') : null };
};

const creer = async (corps, userId) => {
  const i = await Interim.create({ ...(await valider(corps)), created_by: userId });
  return { message: 'Intérim enregistré.', id: i.id };
};

const interimDe = async (id) => {
  const i = await Interim.findOne({ where: { id: Number(id) || 0, del: 0 } });
  if (!i) throw erreur('Intérim introuvable.', 404);
  return i;
};

const modifier = async (id, corps, userId) => {
  const i = await interimDe(id);
  if (!['A_VENIR', 'EN_COURS'].includes(statutDe(i))) throw erreur('Cet intérim est terminé : il ne peut plus être modifié.');
  const valeurs = await valider(corps, i);
  await i.update({ ...valeurs, updated_by: userId, updated_at: new Date() });
  return { message: 'Intérim modifié.' };
};

const arreter = async (id, userId) => {
  const i = await interimDe(id);
  if (!['A_VENIR', 'EN_COURS'].includes(statutDe(i))) throw erreur('Cet intérim est déjà terminé.');
  await i.update({ termine_le: new Date(), termine_by: userId, updated_by: userId, updated_at: new Date() });
  return { message: statutDe(i) === 'ANNULE' ? 'Intérim annulé.' : 'Intérim arrêté.' };
};

module.exports = { completerUtilisateur, completerUtilisateurs, lister, droitsDuTitulaire, creer, modifier, arreter };
