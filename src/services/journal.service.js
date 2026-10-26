/* ==================================================================
 *  Auteur : BATIONO Ulrich Rachid Kévin
 *           Expert en Sécurité Informatique
 *           Développeur FullStack
 *           Tel: +226 51 57 82 89 // 66 72 02 32
 *           Whatsapp: +226 51 57 82 89
 *           Mail: bkevin@sonabhy.bf // bationor10@gmail.com
 *  Projet : MICA – SONABHY
 * ================================================================== */
// Journal d'audit : toutes les actions d'ecriture (creation, modification, suppression, archivage)
// sont enregistrees automatiquement par le middleware « journaliser » : qui, quoi, quand, depuis ou.
// Les secrets (mots de passe, codes, jetons) ne sont jamais enregistres.
const { Op } = require('sequelize');
const cron = require('node-cron');
const { JournalAction, Utilisateur } = require('../models');

const CONSERVATION_JOURS = 730;   // 2 ans
const METHODES = { POST: 'Création', PUT: 'Modification', PATCH: 'Modification', DELETE: 'Suppression' };
const MODULES = {
  stocks: 'Stocks dépôts', 'referentiel-stocks': 'Référentiel stocks', finances: 'Trésorerie', corridors: 'Corridors',
  encours: 'Dépôts intérieurs', camions: "Temps d'attente", 'veille-marche': 'Veille marché', 'veille-geo': 'Veille géopolitique',
  'achats-traders': 'Achats traders', ventes: 'Ventes', recommandations: 'Recommandations', 'caf-moyen': 'CAF moyen',
  rapports: 'Rapports', utilisateurs: 'Comptes utilisateurs', agents: 'Agents', directions: 'Directions',
  entreprises: 'Entreprises', parametres: 'Paramètres', produits: 'Produits', depots: 'Dépôts', fournisseurs: 'Fournisseurs',
  marketeurs: 'Marketeurs', profil: 'Mon profil', auth: 'Authentification', administration: 'Administration',
};
// Routes non journalisees ici : connexion / deconnexion (historique des connexions dedie)
const IGNOREES = ['/api/auth/login', '/api/auth/logout', '/api/auth/login/2fa'];
const SECRET = /pass|mot_de_passe|secret|token|jeton|code/i;

// Resume lisible et sans secret du corps de la requete (2000 caracteres maximum)
const resumer = (valeur, profondeur = 0) => {
  if (valeur === null || valeur === undefined) return valeur;
  if (Array.isArray(valeur)) return profondeur > 0 ? `${valeur.length} élément(s)` : valeur.slice(0, 5).map(v => resumer(v, profondeur + 1)).concat(valeur.length > 5 ? [`… ${valeur.length} au total`] : []);
  if (typeof valeur === 'object') {
    if (profondeur > 1) return '{…}';
    const o = {};
    for (const [k, v] of Object.entries(valeur)) o[k] = SECRET.test(k) ? '••••' : resumer(v, profondeur + 1);
    return o;
  }
  if (typeof valeur === 'string') return valeur.length > 120 ? valeur.slice(0, 120) + '…' : valeur;
  return valeur;
};

const libelleAction = (methode, chemin) => {
  if (/\/archiver$/.test(chemin)) return 'Archivage';
  if (/change-password|reset-password/.test(chemin)) return 'Mot de passe';
  if (/2fa/.test(chemin)) return 'Double authentification';
  if (/\/permissions$/.test(chemin)) return 'Permissions';
  if (/\/sauvegardes/.test(chemin)) return 'Sauvegarde';
  return METHODES[methode] || methode;
};

// Middleware : enregistre l'action a la fin de la reponse (l'utilisateur est alors identifie)
const journaliser = (req, res, next) => {
  if (!METHODES[req.method]) return next();
  const chemin = req.originalUrl.split('?')[0];
  if (IGNOREES.includes(chemin)) return next();
  res.on('finish', () => {
    if (!req.user) return;                         // requete refusee avant authentification
    const segments = chemin.replace(/^\/api\//, '').split('/');
    const module = MODULES[segments[0]] || segments[0];
    const id = segments.find(s => /^\d+$/.test(s));
    let details = null;
    try { details = req.body && Object.keys(req.body).length ? JSON.stringify(resumer(req.body)).slice(0, 2000) : null; } catch { details = null; }
    JournalAction.create({
      utilisateur_id: req.user.id, username: req.user.username,
      action: libelleAction(req.method, chemin), module, route: `${req.method} ${chemin}`.slice(0, 255),
      cible: id ? `n° ${id}` : null, details, statut_http: res.statusCode, succes: res.statusCode < 400 ? 1 : 0,
      ip: String(req.ip || '').replace(/^::ffff:/, '').slice(0, 45) || null,
    }).catch(err => console.error('[Journal] Enregistrement impossible :', err.message));
  });
  next();
};

// Consultation (administrateurs) : filtres et pagination
const rechercher = async ({ utilisateur_id, module, action, du, au, succes, page = 1, taille = 50 }) => {
  const where = {};
  if (utilisateur_id) where.utilisateur_id = utilisateur_id;
  if (module) where.module = module;
  if (action) where.action = action;
  if (succes === '0' || succes === '1') where.succes = Number(succes);
  if (du || au) {
    where.created_at = {};
    if (du) where.created_at[Op.gte] = new Date(`${du}T00:00:00`);
    if (au) where.created_at[Op.lte] = new Date(`${au}T23:59:59`);
  }
  const limite = Math.min(Math.max(parseInt(taille, 10) || 50, 10), 200);
  const p = Math.max(parseInt(page, 10) || 1, 1);
  const { rows, count } = await JournalAction.findAndCountAll({ where, order: [['created_at', 'DESC'], ['id', 'DESC']], limit: limite, offset: (p - 1) * limite });
  const [modules, utilisateurs] = await Promise.all([
    JournalAction.findAll({ attributes: ['module'], group: ['module'], order: [['module', 'ASC']], raw: true }),
    Utilisateur.findAll({ attributes: ['id', 'username'], where: { del: 0 }, order: [['username', 'ASC']] }),
  ]);
  return {
    total: count, page: p, pages: Math.max(Math.ceil(count / limite), 1),
    lignes: rows.map(r => ({
      id: r.id, le: r.created_at, utilisateur: r.username, action: r.action, module: r.module, cible: r.cible,
      route: r.route, details: r.details, statut: r.statut_http, succes: !!r.succes, ip: r.ip,
    })),
    filtres: { modules: modules.map(m => m.module), utilisateurs: utilisateurs.map(u => ({ id: u.id, username: u.username })) },
  };
};

// Purge des entrees de plus de 2 ans (chaque nuit a 03h00)
const startPurgeJournal = () => {
  cron.schedule('0 0 3 * * *', () => {
    JournalAction.destroy({ where: { created_at: { [Op.lt]: new Date(Date.now() - CONSERVATION_JOURS * 86400000) } } })
      .catch(err => console.error('[Journal] Purge impossible :', err.message));
  }, { timezone: 'Africa/Ouagadougou' });
};

module.exports = { journaliser, rechercher, startPurgeJournal };
