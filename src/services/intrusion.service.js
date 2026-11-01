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
// Detection d'intrusion et bannissement automatique.
//  - Attaque certaine (injection, outil de piratage, fichier sensible, jeton falsifie) : bannissement
//    a la premiere tentative.
//  - Comportement possible par accident (mots de passe, pages refusees, adresses inconnues) :
//    bannissement au-dela d'un seuil, un agent qui se trompe ne doit pas bloquer tout son bureau.
//  - Le bannissement est definitif jusqu'a sa levee par un administrateur (ecran Detection d'intrusion)
//    ou sur le serveur : npm run debannir -- <adresse IP>.
//  - Compte connecte auteur de l'attaque : suspendu (sauf le dernier administrateur actif).
//  - Seule l'adresse locale du serveur n'est jamais bannie : toutes les requetes passeraient pour
//    elle si Apache ne transmettait plus l'adresse du client, et l'API serait fermee a tout le monde.
const { Op } = require('sequelize');
const cron = require('node-cron');
const jwt = require('jsonwebtoken');
const { sequelize, SecuriteEvenement, IpBannie, Utilisateur } = require('../models');

const MINUTE = 60000;
const CONSERVATION_JOURS = 730;       // 2 ans, comme le journal d'audit
const RAFRAICHISSEMENT_MS = 30000;    // prise en compte d'une levee faite en ligne de commande
const DELAI_ALERTE_MS = MINUTE;       // au plus une notification par minute aux administrateurs

// Seuils des comportements possibles par accident
const SEUILS = {
  IDENTIFIANTS: { nombre: 8, fenetre: 15 * MINUTE },   // identifiants differents essayes depuis une adresse
  CONNEXIONS: { nombre: 30, fenetre: 15 * MINUTE },    // echecs de connexion, refus de la limite compris
  REFUS: { nombre: 10, fenetre: 10 * MINUTE },         // ecrans interdits differents pour un compte
  INCONNUES: { nombre: 30, fenetre: 5 * MINUTE },      // adresses inexistantes differentes (exploration)
  LIMITE: { nombre: 100, fenetre: 15 * MINUTE },       // requetes refusees par la limite de debit, sans session
};

// ── Signatures d'attaques
const SIGNATURES = [
  { type: 'INJECTION_SQL', libelle: 'Tentative d\'injection SQL', motifs: [
    /\bunion\b[\s/*+]+(all[\s/*+]+)?select\b/i,
    /\binformation_schema\b/i,
    /\b(pg_sleep|load_file|benchmark)\s*\(/i,
    /\bsleep\s*\(\s*\d/i,
    // Comparaison toujours vraie apres un guillemet ; « l'or monte = 3 % » est du francais, pas une attaque
    /['"`]\s*(or|and)\s+['"`][^'"`]{0,40}['"`]\s*(=|like)\s*['"`]/i,
    /['"`]\s*(or|and)\s+\d+\s*(=|like)\s*\d+/i,
    /['"`]\s*(or|and)\s+\w+\s*=\s*\w*\s*(--|#|\/\*)/i,
    /\bor\s+1\s*=\s*1\b/i,
    /['"]\s*;\s*(drop|delete|update|insert|alter|truncate)\s/i,
    /;\s*(drop|truncate)\s+table\b/i,
    /\binto\s+(out|dump)file\b/i,
  ] },
  { type: 'INJECTION_XSS', libelle: 'Tentative d\'injection de script', motifs: [
    /<\s*script\b/i,
    /<\s*(iframe|object|embed)\b/i,
    /<[^>]{0,200}\bon(error|load|click|mouseover|focus)\s*=/i,
    /\bjavascript:/i,
    /\bdocument\.(cookie|location)\b/i,
  ] },
  { type: 'TRAVERSEE', libelle: 'Accès à des fichiers du serveur', motifs: [
    /(\.\.[\\/]){2,}/,
    /[\\/]etc[\\/](passwd|shadow)\b/i,
    /[\\/]proc[\\/]self\b/i,
    /\b(win|boot)\.ini\b/i,
    /windows[\\/]system32/i,
  ] },
  { type: 'COMMANDE', libelle: 'Tentative d\'exécution de commande', motifs: [
    /(;|\||&&|`|\$\()\s*(wget|curl|bash|powershell|certutil|cat\s+\/|nc\s+-|whoami\b)/i,
    /\/bin\/(ba)?sh\b/i,
    /\bcmd\.exe\b/i,
    /\$\{jndi:/i,
    /(\{\{|\$\{)\s*7\s*\*\s*7\s*\}/,
  ] },
];
const CHEMINS_SENSIBLES = /(\.\.[\\/]|\.(php\d?|aspx?|jsp|cgi|env|git|svn|htaccess|htpasswd|bak|sql|ds_store)(\/|$)|wp-admin|wp-login|xmlrpc|phpmyadmin|actuator|cgi-bin|manager\/html|\.aws)/i;
const OUTILS = /\b(sqlmap|nikto|nmap|masscan|wpscan|acunetix|nessus|openvas|burpsuite|dirbuster|gobuster|feroxbuster|ffuf|nuclei|hydra|zgrab|havij|w3af|arachni)\b/i;
const CLES_DANGEREUSES = /^(__proto__|prototype|\$(ne|gt|gte|lt|lte|in|nin|or|and|where|regex|exists))$/;
const COMMENTAIRE_SQL = /['"]\s*(--|#|\/\*)/;           // identifiant du type  admin'--
// Secrets : jamais lus ni enregistres
const SECRET = /pass|mot_de_passe|^token$|^code$|jeton/i;
const MAX_CHAINES = 5000;

const ipDe = (req) => String(req.ip || '').replace(/^::ffff:/, '').slice(0, 45);
const estLocale = (ip) => !ip || ip === '127.0.0.1' || ip === '::1';

const decoder = (s) => {
  let v = String(s);
  for (let i = 0; i < 2; i++) { try { v = decodeURIComponent(v); } catch { break; } }
  return v;
};

// ── Adresses bannies : en memoire, relues regulierement
let bannies = new Set();

const chargerBannies = async () => {
  const rows = await IpBannie.findAll({ where: { actif: 1 }, attributes: ['ip'], raw: true });
  bannies = new Set(rows.map(r => r.ip));
};

// ── Compteurs par adresse ou par compte, sur une fenetre glissante
const compteurs = new Map();
const compter = (cle, seuil, valeur = null) => {
  const maintenant = Date.now();
  const lignes = (compteurs.get(cle) || []).filter(l => maintenant - l.t < seuil.fenetre);
  if (valeur === null || !lignes.some(l => l.v === valeur)) lignes.push({ t: maintenant, v: valeur });
  compteurs.set(cle, lignes);
  return lignes.length >= seuil.nombre;
};
const oublierCompteurs = (ip) => {
  for (const cle of compteurs.keys()) if (cle.endsWith(`:${ip}`)) compteurs.delete(cle);
};
const nettoyerCompteurs = () => {
  const maintenant = Date.now();
  for (const [cle, lignes] of compteurs) {
    const restantes = lignes.filter(l => maintenant - l.t < 15 * MINUTE);
    if (restantes.length) compteurs.set(cle, restantes); else compteurs.delete(cle);
  }
};

// ── Alerte aux administrateurs
let derniereAlerte = 0;
const alerter = (libelle, ip, mesure) => {
  if (Date.now() - derniereAlerte < DELAI_ALERTE_MS) return;
  derniereAlerte = Date.now();
  require('./notifications.service').alerterAdministrateurs({
    titre: 'Alerte de sécurité MICA', corps: `${libelle} depuis ${ip || 'une adresse inconnue'} : ${mesure}.`,
    url: '/administration/securite/intrusions', tag: 'securite',
  }).catch(e => console.error('[Intrusion] Alerte impossible :', e.message));
};

// Compte connecte auteur de l'attaque (le dernier administrateur actif n'est jamais suspendu)
const suspendre = async (utilisateurId, motif) => {
  const u = await Utilisateur.findOne({ where: { id: utilisateurId, del: 0 } });
  if (!u) return { username: null, suspendu: false };
  if (u.suspendu_le) return { username: u.username, suspendu: true };
  if (u.is_admin) {
    const autres = await Utilisateur.count({ where: { is_admin: 1, del: 0, suspendu_le: null, id: { [Op.ne]: u.id } } });
    if (!autres) return { username: u.username, suspendu: false };
  }
  await u.update({ suspendu_le: new Date(), suspendu_motif: motif.slice(0, 120) });
  return { username: u.username, suspendu: true };
};

// Enregistre l'attaque et applique les mesures. Ne leve jamais d'erreur : la securite ne doit pas casser l'API.
const sanctionner = async (req, { type, libelle, extrait = null }, utilisateurId = null) => {
  const ip = ipDe(req);
  const locale = estLocale(ip);
  if (!locale) bannies.add(ip);                    // effet immediat, avant meme l'ecriture en base
  try {
    const mesures = [];
    if (!locale) {
      await IpBannie.upsert({ ip, motif: libelle.slice(0, 120), banni_le: new Date(), actif: 1, leve_le: null, leve_par: null });
      mesures.push('adresse bannie');
    }
    let username = null;
    if (utilisateurId) {
      const r = await suspendre(utilisateurId, libelle);
      username = r.username;
      mesures.push(r.suspendu ? 'compte suspendu' : 'compte maintenu (dernier administrateur)');
    }
    const mesure = mesures.join(', ') || 'alerte seule (adresse du serveur)';
    await SecuriteEvenement.create({
      type, libelle, ip: ip || null, utilisateur_id: utilisateurId, username,
      route: `${req.method} ${req.originalUrl.split('?')[0]}`.slice(0, 255),
      extrait: extrait ? String(extrait).slice(0, 255) : null,
      navigateur: String(req.get('User-Agent') || '').slice(0, 255) || null,
      mesure,
    });
    console.warn(`[Intrusion] ${type} depuis ${ip} : ${mesure}`);
    alerter(libelle, ip, mesure);
  } catch (e) {
    console.error('[Intrusion] Enregistrement impossible :', e.message);
  }
};

const refuser = (res) => res.status(403).json({
  code: 'ACCES_BANNI', message: 'Accès bloqué pour raison de sécurité. Contactez l\'administrateur de la plateforme.',
});

// ── Analyse d'une requete
const chercher = (texte) => {
  for (const s of SIGNATURES) {
    const m = s.motifs.find(r => r.test(texte));
    if (m) return { type: s.type, libelle: s.libelle, extrait: texte.match(m)[0] };
  }
  return null;
};

// Parcourt les valeurs (et les cles) du corps de la requete, secrets exclus
const analyserValeur = (valeur) => {
  const pile = [valeur];
  let vues = 0;
  while (pile.length && vues < MAX_CHAINES) {
    const v = pile.pop();
    vues++;
    if (typeof v === 'string') {
      const r = chercher(v);
      if (r) return r;
    } else if (Array.isArray(v)) {
      pile.push(...v);
    } else if (v && typeof v === 'object') {
      for (const [k, sous] of Object.entries(v)) {
        if (CLES_DANGEREUSES.test(k)) return { type: 'INJECTION_OBJET', libelle: 'Requête forgée', extrait: k };
        if (!SECRET.test(k)) pile.push(sous);
      }
    }
  }
  return null;
};

// Jeton de session forge : l'API n'emet que du HS256 (un simple jeton expire ou ancien n'est pas une attaque)
const jetonForge = (req) => {
  const brut = /(?:^|;\s*)mica_token=([^;]+)/.exec(req.headers.cookie || '')?.[1]
    || (req.headers.authorization || '').replace(/^Bearer\s+/, '');
  if (!brut) return false;
  const entete = jwt.decode(decodeURIComponent(brut), { complete: true })?.header;
  return !!entete && entete.alg !== 'HS256';
};

const analyser = (req) => {
  const ua = req.get('User-Agent') || '';
  if (OUTILS.test(ua)) return { type: 'OUTIL', libelle: 'Outil de piratage détecté', extrait: ua };
  if (jetonForge(req)) return { type: 'JETON_FORGE', libelle: 'Jeton de session falsifié', extrait: null };
  const url = decoder(req.originalUrl);
  const chemin = url.split('?')[0];
  if (CHEMINS_SENSIBLES.test(chemin)) return { type: 'CHEMIN_SENSIBLE', libelle: 'Recherche de fichiers sensibles', extrait: chemin };
  const dansUrl = chercher(url);
  if (dansUrl) return dansUrl;
  if (typeof req.body?.username === 'string' && COMMENTAIRE_SQL.test(req.body.username)) {
    return { type: 'INJECTION_SQL', libelle: 'Tentative d\'injection SQL', extrait: req.body.username };
  }
  return req.body && typeof req.body === 'object' ? analyserValeur(req.body) : null;
};

// ── Middlewares
const bloquerBannis = (req, res, next) => (bannies.has(ipDe(req)) ? refuser(res) : next());

const detecter = async (req, res, next) => {
  const attaque = analyser(req);
  if (!attaque) return next();
  const { getSessionUserId } = require('../middleware/auth');
  await sanctionner(req, attaque, getSessionUserId(req));
  refuser(res);
};

// Reponses de l'API : pages interdites et adresses inexistantes a repetition
const surveillerReponses = (req, res, next) => {
  res.on('finish', () => {
    const route = `${req.method} ${req.originalUrl.split('?')[0].replace(/\/\d+(?=\/|$)/g, '/:id')}`;
    if (res.statusCode === 403 && req.user && compter(`refus:${req.user.id}`, SEUILS.REFUS, route)) {
      compteurs.delete(`refus:${req.user.id}`);
      sanctionner(req, { type: 'ACCES_INTERDITS', libelle: 'Accès répétés à des écrans interdits', extrait: route }, req.user.id);
    }
    if (res.statusCode === 404 && compter(`inconnues:${ipDe(req)}`, SEUILS.INCONNUES, route)) {
      sanctionner(req, { type: 'EXPLORATION', libelle: 'Exploration de l\'application', extrait: route }, req.user?.id || null);
    }
  });
  next();
};

// Echec de connexion (ou refus par la limite de tentatives) ; identifiant inconnu pour la limite
const echecConnexion = (req, identifiant = null) => {
  const ip = ipDe(req);
  const parIdentifiant = identifiant && compter(`identifiants:${ip}`, SEUILS.IDENTIFIANTS, identifiant.toLowerCase());
  const parNombre = compter(`connexions:${ip}`, SEUILS.CONNEXIONS);
  if (parIdentifiant || parNombre) {
    sanctionner(req, { type: 'FORCE_BRUTE', libelle: 'Attaque sur les mots de passe', extrait: identifiant });
  }
};

// Requete sans session refusee par la limite de debit
const limiteDepassee = (req) => {
  if (compter(`limite:${ipDe(req)}`, SEUILS.LIMITE)) {
    sanctionner(req, { type: 'SATURATION', libelle: 'Requêtes massives', extrait: null });
  }
};

// ── Administration
const consulter = async ({ page = 1, taille = 50 }) => {
  const limite = Math.min(Math.max(parseInt(taille, 10) || 50, 10), 200);
  const p = Math.max(parseInt(page, 10) || 1, 1);
  const { rows, count } = await SecuriteEvenement.findAndCountAll({ order: [['created_at', 'DESC'], ['id', 'DESC']], limit: limite, offset: (p - 1) * limite });
  const [ips, comptes, recents] = await Promise.all([
    IpBannie.findAll({ where: { actif: 1 }, order: [['banni_le', 'DESC']] }),
    Utilisateur.findAll({ where: { del: 0, suspendu_le: { [Op.ne]: null } }, attributes: ['id', 'username', 'suspendu_le', 'suspendu_motif'], order: [['suspendu_le', 'DESC']] }),
    SecuriteEvenement.count({ where: { created_at: { [Op.gte]: new Date(Date.now() - 86400000) } } }),
  ]);
  return { total: count, page: p, pages: Math.max(Math.ceil(count / limite), 1), recents, evenements: rows, ips, comptes };
};

const leverBannissement = async (id, user) => {
  const b = await IpBannie.findOne({ where: { id, actif: 1 } });
  if (!b) throw { status: 404, message: 'Bannissement introuvable.' };
  await b.update({ actif: 0, leve_le: new Date(), leve_par: user.username });
  bannies.delete(b.ip);
  oublierCompteurs(b.ip);
  return { message: `Adresse ${b.ip} débloquée.` };
};

const reactiverCompte = async (id) => {
  const u = await Utilisateur.findOne({ where: { id, del: 0, suspendu_le: { [Op.ne]: null } } });
  if (!u) throw { status: 404, message: 'Compte suspendu introuvable.' };
  await u.update({ suspendu_le: null, suspendu_motif: null });
  compteurs.delete(`refus:${u.id}`);
  return { message: `Compte ${u.username} réactivé.` };
};

// Demarrage : adresses bannies, relecture reguliere, purge de l'historique (chaque nuit a 03h30)
const startIntrusion = async () => {
  await chargerBannies();
  setInterval(() => {
    chargerBannies().catch(e => console.error('[Intrusion] Relecture impossible :', e.message));
    nettoyerCompteurs();
  }, RAFRAICHISSEMENT_MS).unref();
  cron.schedule('0 30 3 * * *', () => {
    SecuriteEvenement.destroy({ where: { created_at: { [Op.lt]: new Date(Date.now() - CONSERVATION_JOURS * 86400000) } } })
      .catch(e => console.error('[Intrusion] Purge impossible :', e.message));
  }, { timezone: 'Africa/Ouagadougou' });
  console.log(`[Intrusion] Détection active, ${bannies.size} adresse(s) bannie(s)`);
};

module.exports = {
  bloquerBannis, detecter, surveillerReponses, echecConnexion, limiteDepassee,
  consulter, leverBannissement, reactiverCompte, startIntrusion, analyser, chargerBannies,
};
