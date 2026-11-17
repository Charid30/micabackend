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
// Etat du systeme (administrateurs) : une page qui rassemble ce qu'un exploitant doit verifier
// (sauvegardes, revue des dependances, espace disque, base, sessions, securite, taches planifiees)
// et la liste des points a traiter. Lecture seule ; aucune valeur secrete n'est renvoyee.
const os = require('os');
const fs = require('fs');
const { Op } = require('sequelize');
const {
  sequelize, Utilisateur, JournalAction, SecuriteEvenement, IpBannie, RapportHebdo,
} = require('../models');
const sessions = require('./session.service');
const sauvegardes = require('./sauvegarde.service');

const demarreLe = new Date();
const JOUR = 86400000;

const espaceDisque = async (dossier) => {
  try {
    const cible = fs.existsSync(dossier) ? dossier : process.cwd();
    const s = await fs.promises.statfs(cible);
    const total = s.blocks * s.bsize;
    const libre = s.bavail * s.bsize;
    return { total, libre, libre_pct: total ? Math.round((libre / total) * 1000) / 10 : null };
  } catch {
    return null;
  }
};

const base = async () => {
  const [[v]] = await sequelize.query('SELECT VERSION() AS version');
  const [[t]] = await sequelize.query(
    `SELECT COUNT(*) AS tables, COALESCE(SUM(data_length + index_length), 0) AS taille
     FROM information_schema.TABLES WHERE table_schema = DATABASE()`);
  const [[m]] = await sequelize.query('SELECT name, applied_at FROM _migrations ORDER BY id DESC LIMIT 1');
  const fichiers = fs.readdirSync(require('path').join(__dirname, '../database/migrations')).filter((f) => /^\d+_.*\.js$/.test(f));
  const [appliquees] = await sequelize.query('SELECT name FROM _migrations');
  const noms = new Set(appliquees.map((r) => r.name));
  const enAttente = fichiers.map((f) => f.replace(/\.js$/, '')).filter((n) => !noms.has(n));
  return {
    version: v.version, tables: Number(t.tables), taille: Number(t.taille),
    derniere_migration: m ? { nom: m.name, le: m.applied_at } : null, migrations_en_attente: enAttente,
  };
};

const revueDependances = async () => {
  const r = await JournalAction.findOne({ where: { action: 'Revue des dépendances' }, order: [['id', 'DESC']] });
  return r ? { le: r.created_at, succes: !!r.succes, resultat: r.description } : null;
};

const comptes = async () => {
  const maintenant = new Date();
  const [actifs, admins, adminsSans2fa, suspendus, verrouilles] = await Promise.all([
    Utilisateur.count({ where: { del: 0 } }),
    Utilisateur.count({ where: { del: 0, is_admin: 1 } }),
    Utilisateur.count({ where: { del: 0, is_admin: 1, totp_active_le: null } }),
    Utilisateur.count({ where: { del: 0, suspendu_le: { [Op.ne]: null } } }),
    Utilisateur.unscoped().count({ where: { del: 0, locked_until: { [Op.gt]: maintenant } } }),
  ]);
  return { actifs, administrateurs: admins, administrateurs_sans_double_auth: adminsSans2fa, suspendus, verrouilles };
};

const securite = async () => {
  const depuis = new Date(Date.now() - JOUR);
  const [attaques24h, ipsBannies] = await Promise.all([
    SecuriteEvenement.count({ where: { created_at: { [Op.gte]: depuis } } }),
    IpBannie.count({ where: { actif: 1 } }),
  ]);
  return { attaques_24h: attaques24h, ips_bannies: ipsBannies };
};

const dernierRapport = async () => {
  const r = await RapportHebdo.findOne({ where: { statut: 'PUBLIE', del: 0 }, order: [['date_publication', 'DESC']] });
  return r ? { semaine: r.semaine_iso, annee: r.annee, publie_le: r.date_publication } : null;
};

/** Points a traiter, du plus grave au moins grave */
const pointsATraiter = (e) => {
  const p = [];
  const ajouter = (niveau, texte, lien = null) => p.push({ niveau, texte, lien });

  if (e.sauvegardes.alerte) ajouter('erreur', e.sauvegardes.alerte, '/administration/securite/sauvegardes');
  if (!e.sauvegardes.configuration.secondaire) {
    ajouter('attention', 'Aucune copie des sauvegardes hors du serveur : renseignez SAUVEGARDE_DIR_SECONDAIRE.');
  }
  if (e.disque?.libre_pct !== null && e.disque?.libre_pct !== undefined) {
    if (e.disque.libre_pct < 10) ajouter('erreur', `Espace disque presque plein : ${e.disque.libre_pct} % libre.`);
    else if (e.disque.libre_pct < 20) ajouter('attention', `Espace disque à surveiller : ${e.disque.libre_pct} % libre.`);
  }
  if (e.base.migrations_en_attente.length) {
    ajouter('erreur', `Migration${e.base.migrations_en_attente.length > 1 ? 's' : ''} non appliquée${e.base.migrations_en_attente.length > 1 ? 's' : ''} : ${e.base.migrations_en_attente.join(', ')} (npm run migrate).`);
  }
  const rd = e.dependances.derniere;
  if (!rd) ajouter('attention', 'Aucune revue des dépendances enregistrée : lancez-la depuis cette page.');
  else if (!rd.succes) ajouter('erreur', `Dernière revue des dépendances : ${rd.resultat}`);
  else if (Date.now() - new Date(rd.le).getTime() > 35 * JOUR) ajouter('attention', 'La dernière revue des dépendances date de plus d\'un mois.');
  if (!e.dependances.plateforme_web_auditee) {
    ajouter('attention', 'La plateforme web n\'est pas incluse dans la revue des dépendances : renseignez AUDIT_DEPENDANCES_WEB_DIR.');
  }
  if (e.comptes.administrateurs_sans_double_auth) {
    const n = e.comptes.administrateurs_sans_double_auth;
    ajouter('attention', `${n} administrateur${n > 1 ? 's' : ''} sans double authentification.`, '/administration/utilisateurs');
  }
  if (e.comptes.suspendus) {
    ajouter('attention', `${e.comptes.suspendus} compte${e.comptes.suspendus > 1 ? 's' : ''} suspendu${e.comptes.suspendus > 1 ? 's' : ''} par la détection d'intrusion.`, '/administration/securite/intrusions');
  }
  if (e.securite.attaques_24h) {
    ajouter('info', `${e.securite.attaques_24h} attaque${e.securite.attaques_24h > 1 ? 's' : ''} bloquée${e.securite.attaques_24h > 1 ? 's' : ''} ces dernières 24 heures.`, '/administration/securite/intrusions');
  }
  if (e.application.environnement === 'production' && !e.application.cors_explicite) {
    ajouter('info', 'CORS_ORIGIN n\'est pas renseignée : indiquez https://indicateur.sonabhy.bf dans le .env.');
  }
  if (e.rapports.dernier && Date.now() - new Date(e.rapports.dernier.publie_le).getTime() > 8 * JOUR) {
    ajouter('attention', 'Aucun rapport hebdomadaire publié depuis plus de 8 jours.', '/rapports');
  }
  if (!e.notifications.mobile) ajouter('info', 'Notifications des téléphones désactivées : clé Firebase absente.');
  const ordre = { erreur: 0, attention: 1, info: 2 };
  return p.sort((a, b) => ordre[a.niveau] - ordre[b.niveau]);
};

const etat = async (sidCourant) => {
  const sauv = await sauvegardes.getEtat();
  const [b, disque, derniere, cpt, sec, rapport, actives] = await Promise.all([
    base(), espaceDisque(sauv.configuration.dossier), revueDependances(), comptes(), securite(), dernierRapport(),
    sessions.listerToutes(sidCourant),
  ]);
  const webDir = process.env.AUDIT_DEPENDANCES_WEB_DIR;
  const e = {
    genere_le: new Date(),
    application: {
      version_api: require('../../package.json').version,
      node: process.version,
      environnement: process.env.NODE_ENV || 'development',
      demarree_le: demarreLe,
      memoire_api: process.memoryUsage().rss,
      cors_explicite: !!process.env.CORS_ORIGIN,
    },
    serveur: {
      systeme: `${os.type()} ${os.release()}`,
      demarre_depuis_s: Math.round(os.uptime()),
      memoire_totale: os.totalmem(), memoire_libre: os.freemem(),
      processeurs: os.cpus().length,
      charge: os.platform() === 'win32' ? null : os.loadavg().map((x) => Math.round(x * 100) / 100),
    },
    disque,
    base: b,
    sauvegardes: sauv,
    dependances: {
      derniere, planification: process.env.AUDIT_DEPENDANCES_CRON || '0 0 8 1 * *',
      plateforme_web_auditee: !!(webDir && fs.existsSync(require('path').join(webDir, 'package-lock.json'))),
    },
    rapports: { dernier: rapport, publication: process.env.PUBLICATION_CRON || null },
    comptes: cpt,
    sessions: {
      actives: actives.length,
      comptes_connectes: new Set(actives.map((s) => s.utilisateur_id)).size,
      ecrans_ouverts: require('./temps-reel.service').comptesEnLigne().size,
      liste: actives,
    },
    securite: sec,
    notifications: { navigateur: true, mobile: require('./fcm.service').actif() },
  };
  e.points = pointsATraiter(e);
  return e;
};

// Revue des dependances lancee a la demande (une a la fois)
let revueEnCours = false;
const lancerRevue = async () => {
  if (revueEnCours) throw { status: 409, message: 'Une revue est déjà en cours.' };
  revueEnCours = true;
  try { return await require('./audit-dependances.service').revue(); } finally { revueEnCours = false; }
};

module.exports = { etat, lancerRevue };
