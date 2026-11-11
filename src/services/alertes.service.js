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
// Alertes de l'onglet « Alertes » (version telephone), selon les droits du compte :
//  - stocks     : depot x produit sous l'objectif d'autonomie (droit tableau de bord)
//  - saisies    : saisies quotidiennes du jour non faites, pour les ecrans ou le compte saisit
//  - securite   : adresses bannies et comptes suspendus des 7 derniers jours (administrateurs)
//  - information: dernier rapport publie (droit rapports)
// Chaque rubrique est independante : une erreur dans l'une n'empeche pas les autres.
const { Op } = require('sequelize');
const { RapportHebdo, IpBannie, Utilisateur } = require('../models');

const aDroit = (u, module, action, depotId = null) => !!u.is_admin || (u.permissions || []).some(p =>
  !p.del && p.module === module && (action === 'READ' ? ['READ', 'WRITE'].includes(p.action) : p.action === 'WRITE')
  && (!depotId || !p.depot_id || p.depot_id === depotId));

const SEPT_JOURS = 7 * 24 * 3600 * 1000;

const rubrique = async (nom, fn) => {
  try { return await fn(); } catch (e) { console.error(`[Alertes] ${nom} :`, e.message); return []; }
};

// Cache par compte (60 s) : le calcul (autonomie, saisies manquantes) est couteux et l'onglet est
// relu a chaque ouverture ; des appels repetes ne doivent pas pouvoir charger le serveur
const CACHE_MS = 60 * 1000;
const cache = new Map(); // utilisateur -> { t, droits, alertes }

async function alertesUtilisateur(user) {
  // La cle inclut les droits : un changement de droits ou d'interim n'attend pas l'expiration
  const droits = `${user.is_admin ? 1 : 0}|${(user.permissions || []).map(p => `${p.module}:${p.action}:${p.depot_id || ''}`).sort().join(',')}`;
  const c = cache.get(user.id);
  if (c && c.droits === droits && Date.now() - c.t < CACHE_MS) return c.alertes;
  const alertes = await calculer(user);
  if (cache.size > 500) cache.clear(); // borne memoire (nombre de comptes actifs tres inferieur)
  cache.set(user.id, { t: Date.now(), droits, alertes });
  return alertes;
}

async function calculer(user) {
  const [stocks, saisies, securite, information] = await Promise.all([
    rubrique('stocks', async () => {
      if (!aDroit(user, 'dashboard', 'READ')) return [];
      const s = await require('./dashboard.service').getSynthese();
      return (s.alertes || []).slice(0, 12).map(a => ({
        categorie: 'stocks',
        niveau: a.couleur === 'rouge' ? 'critique' : 'attention',
        titre: `${a.produit} sous le seuil`,
        texte: `${a.depot} : ${a.autonomie === null ? '—' : Math.round(a.autonomie)} jour(s) d'autonomie (objectif ${a.seuil} j).`,
        quand: null,
        url: '/dashboard',
      }));
    }),
    rubrique('saisies', async () => {
      const manquantes = await require('./notifications.service').saisiesManquantes();
      return manquantes.filter(m => aDroit(user, m.droit, 'WRITE', m.depot_id)).map(m => ({
        categorie: 'saisies',
        niveau: 'attention',
        titre: 'Saisie manquante',
        texte: `${m.libelle} : non saisi aujourd'hui.`,
        quand: null,
        url: m.url,
      }));
    }),
    rubrique('securite', async () => {
      if (!user.is_admin) return [];
      const depuis = new Date(Date.now() - SEPT_JOURS);
      const [ips, comptes] = await Promise.all([
        IpBannie.findAll({ where: { actif: 1, banni_le: { [Op.gte]: depuis } }, order: [['banni_le', 'DESC']], limit: 10 }),
        Utilisateur.findAll({ where: { del: 0, suspendu_le: { [Op.gte]: depuis } }, attributes: ['username', 'suspendu_le', 'suspendu_motif'], order: [['suspendu_le', 'DESC']], limit: 10 }),
      ]);
      return [
        ...ips.map(b => ({ categorie: 'securite', niveau: 'critique', titre: 'Adresse bannie', texte: `${b.ip} : ${b.motif}.`, quand: b.banni_le, url: '/administration/securite/intrusions' })),
        ...comptes.map(c => ({ categorie: 'securite', niveau: 'critique', titre: 'Compte suspendu', texte: `${c.username}${c.suspendu_motif ? ' : ' + c.suspendu_motif : ''}.`, quand: c.suspendu_le, url: '/administration/securite/intrusions' })),
      ];
    }),
    rubrique('information', async () => {
      if (!aDroit(user, 'rapports', 'READ')) return [];
      const r = await RapportHebdo.findOne({ where: { statut: 'PUBLIE', del: 0 }, order: [['date_fin', 'DESC']] });
      if (!r) return [];
      const quand = r.date_publication || r.updated_at;
      if (quand && Date.now() - new Date(quand).getTime() > SEPT_JOURS) return [];
      return [{
        categorie: 'information', niveau: 'information', titre: 'Rapport publié',
        texte: `Le rapport de la semaine ${r.semaine_iso} est disponible en PDF.`, quand, url: '/rapports',
      }];
    }),
  ]);
  // Critiques d'abord, puis attention, puis information
  const ordre = { critique: 0, attention: 1, information: 2 };
  return [...securite, ...stocks, ...saisies, ...information].sort((a, b) => ordre[a.niveau] - ordre[b.niveau]);
}

module.exports = { alertesUtilisateur };
