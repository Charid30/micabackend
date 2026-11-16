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
// Messages ciblés : un administrateur écrit à un ou plusieurs comptes. Le message s'affiche dans une
// fenêtre à la prochaine connexion du destinataire (aussitôt s'il est connecté) et reste affiché
// jusqu'au clic sur « Marquer comme lu », qui enregistre l'accusé de lecture (date, heure, adresse).
const { Op } = require('sequelize');
const { sequelize, Message, MessageDestinataire, Utilisateur, Agent } = require('../models');
const tempsReel = require('./temps-reel.service');

const TITRE_MAX = 150;
const CONTENU_MAX = 2000;
const DESTINATAIRES_MAX = 500;

const erreur = (status, message) => Object.assign(new Error(message), { status, isBusiness: true });
const nomComplet = (u) => (u?.agent ? `${u.agent.nom} ${u.agent.prenoms}`.trim() : null) || u?.username || '—';
const avecAgent = (as) => ({ model: Utilisateur, as, attributes: ['id', 'username'], include: [{ model: Agent, as: 'agent', attributes: ['nom', 'prenoms'] }] });

const texte = (v, max, libelle) => {
  const t = typeof v === 'string' ? v.replace(/\r\n/g, '\n').trim() : '';
  if (!t) throw erreur(400, `${libelle} est obligatoire.`);
  if (t.length > max) throw erreur(400, `${libelle} ne doit pas dépasser ${max} caractères.`);
  return t;
};

/** Envoi d'un message à une liste de comptes (identifiants), par un administrateur */
const envoyer = async (auteur, corps = {}) => {
  const titre = texte(corps.titre, TITRE_MAX, 'Le titre');
  const contenu = texte(corps.contenu, CONTENU_MAX, 'Le message');
  const brut = Array.isArray(corps.destinataires) ? corps.destinataires : [];
  const ids = [...new Set(brut.map(Number))].filter((n) => Number.isInteger(n) && n > 0);
  if (!ids.length) throw erreur(400, 'Choisissez au moins un destinataire.');
  if (ids.length !== brut.length || ids.length > DESTINATAIRES_MAX) throw erreur(400, 'Liste de destinataires invalide.');

  const comptes = await Utilisateur.findAll({ where: { id: ids, del: 0 }, attributes: ['id'] });
  if (comptes.length !== ids.length) throw erreur(400, 'Un des destinataires n\'existe pas ou a été supprimé.');

  const message = await sequelize.transaction(async (transaction) => {
    const m = await Message.create({ titre, contenu, created_by: auteur.id, updated_by: auteur.id }, { transaction });
    await MessageDestinataire.bulkCreate(ids.map((utilisateur_id) => ({ message_id: m.id, utilisateur_id })), { transaction });
    return m;
  });
  tempsReel.envoyerA(ids, 'message-recu');   // affichage immédiat pour les comptes connectés
  return { id: message.id, destinataires: ids.length };
};

/** Messages envoyés, avec l'accusé de lecture de chaque destinataire (100 derniers) */
const lister = async () => {
  const lignes = await Message.findAll({
    where: { del: 0 },
    include: [
      avecAgent('auteur'),
      { model: MessageDestinataire, as: 'destinataires', include: [avecAgent('utilisateur')] },
    ],
    order: [['created_at', 'DESC'], ['id', 'DESC']],
    limit: 100,
  });
  return lignes.map((m) => {
    const destinataires = m.destinataires
      .map((d) => ({ id: d.utilisateur_id, nom: nomComplet(d.utilisateur), identifiant: d.utilisateur?.username || null, lu_le: d.lu_le }))
      .sort((a, b) => (a.lu_le ? 1 : 0) - (b.lu_le ? 1 : 0) || a.nom.localeCompare(b.nom, 'fr'));
    return {
      id: m.id, titre: m.titre, contenu: m.contenu, envoye_le: m.created_at, auteur: nomComplet(m.auteur),
      total: destinataires.length, lus: destinataires.filter((d) => d.lu_le).length, destinataires,
    };
  });
};

/** Retrait d'un message : il n'est plus présenté aux destinataires qui ne l'ont pas encore lu */
const retirer = async (auteur, id) => {
  const m = await Message.findOne({ where: { id, del: 0 }, include: [{ model: MessageDestinataire, as: 'destinataires', attributes: ['utilisateur_id', 'lu_le'] }] });
  if (!m) throw erreur(404, 'Message introuvable.');
  await m.update({ del: 1, deleted_at: new Date(), deleted_by: auteur.id });
  tempsReel.envoyerA(m.destinataires.filter((d) => !d.lu_le).map((d) => d.utilisateur_id), 'message-recu');
  return { id: m.id };
};

/** Messages non lus du compte connecté, du plus ancien au plus récent */
const aLire = async (user) => {
  const lignes = await MessageDestinataire.findAll({
    where: { utilisateur_id: user.id, lu_le: null },
    include: [{ model: Message, as: 'message', where: { del: 0 }, include: [avecAgent('auteur')] }],
    order: [[{ model: Message, as: 'message' }, 'created_at', 'ASC']],
  });
  return lignes.map((d) => ({
    id: d.message.id, titre: d.message.titre, contenu: d.message.contenu,
    envoye_le: d.message.created_at, auteur: nomComplet(d.message.auteur),
  }));
};

/** Accusé de lecture : enregistré une seule fois (le premier clic fait foi) */
const marquerLu = async (user, messageId, ip) => {
  const d = await MessageDestinataire.findOne({
    where: { message_id: messageId, utilisateur_id: user.id },
    include: [{ model: Message, as: 'message', where: { del: 0 }, attributes: ['id'] }],
  });
  if (!d) throw erreur(404, 'Message introuvable.');
  if (!d.lu_le) await d.update({ lu_le: new Date(Math.floor(Date.now() / 1000) * 1000), lu_ip: ip ? String(ip).replace(/^::ffff:/, '').slice(0, 45) : null });
  return { id: messageId, lu_le: d.lu_le };
};

// ── Relance des retardataires (écran Suivi des saisies)
// Chaque agent chargé d'une saisie du jour non faite reçoit une notification de mise à jour listant SES saisies
// (droit d'écriture sur le menu et, pour les stocks, sur le dépôt ; intérims compris). Les administrateurs ne
// sont pas relancés. Une relance au plus tous les quarts d'heure, pour ne pas harceler les agents.
const DELAI_RELANCE_MS = 15 * 60 * 1000;
let derniereRelance = 0;
const heureFr = (d) => d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Ouagadougou' }).replace(':', 'h');

const relancerRetardataires = async (auteur) => {
  const maintenant = Date.now();
  if (maintenant - derniereRelance < DELAI_RELANCE_MS) {
    throw erreur(429, `Une relance a déjà été envoyée à ${heureFr(new Date(derniereRelance))}. Nouvelle relance possible à ${heureFr(new Date(derniereRelance + DELAI_RELANCE_MS))}.`);
  }
  const notifications = require('./notifications.service');
  const manquantes = await notifications.manquantesDuJour();
  if (!manquantes.length) throw erreur(400, 'Toutes les saisies attendues aujourd\'hui sont faites : personne à relancer.');

  const jour = new Date().toLocaleDateString('fr-FR', { timeZone: 'Africa/Ouagadougou' });
  const envois = [];
  const couvertes = new Set();
  for (const u of await notifications.utilisateursActifs()) {
    if (u.is_admin || u.id === auteur.id) continue;
    const siennes = manquantes.filter((x) => notifications.aDroit(u, x.droit, 'WRITE', x.depot_id));
    if (!siennes.length) continue;
    siennes.forEach((x) => couvertes.add(x));
    envois.push({ id: u.id, siennes });
  }
  if (!envois.length) throw erreur(400, 'Aucun agent n\'a le droit de saisie sur les saisies manquantes : attribuez les droits correspondants.');

  derniereRelance = maintenant;
  await sequelize.transaction(async (transaction) => {
    for (const e of envois) {
      const n = e.siennes.length;
      const m = await Message.create({
        titre: n > 1 ? `${n} saisies du jour à effectuer` : 'Saisie du jour à effectuer',
        contenu: `Les saisies suivantes ne sont pas encore renseignées pour aujourd'hui (${jour}) :\n`
          + e.siennes.map((x) => `• ${x.libelle}`).join('\n')
          + '\n\nMerci de les effectuer dès que possible.',
        created_by: auteur.id, updated_by: auteur.id,
      }, { transaction });
      await MessageDestinataire.create({ message_id: m.id, utilisateur_id: e.id }, { transaction });
    }
  });
  const ids = envois.map((e) => e.id);
  tempsReel.envoyerA(ids, 'message-recu');
  tempsReel.diffuser('messages');
  for (const e of envois) {   // notification du navigateur, en plus de la fenêtre dans l'application
    notifications.envoyer([e.id], {
      titre: 'Saisies du jour à effectuer', corps: e.siennes.slice(0, 4).map((x) => x.libelle).join(', '),
      url: e.siennes[0].url, tag: `relance-${new Date().toISOString().slice(0, 10)}`,
    }).catch(() => {});
  }
  const comptes = await Utilisateur.findAll({ where: { id: ids }, attributes: ['id', 'username'], include: [{ model: Agent, as: 'agent', attributes: ['nom', 'prenoms'] }] });
  return {
    personnes: ids.length,
    saisies: manquantes.length,
    sans_responsable: manquantes.filter((x) => !couvertes.has(x)).map((x) => x.libelle),
    noms: comptes.map(nomComplet).sort((a, b) => a.localeCompare(b, 'fr')),
  };
};

module.exports = { envoyer, lister, retirer, aLire, marquerLu, relancerRetardataires, TITRE_MAX, CONTENU_MAX };
