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
// Sauvegarde automatique de la base MySQL
//  - chaque nuit (SAUVEGARDE_CRON, 02h00 par defaut) : mysqldump compresse (.sql.gz) dans SAUVEGARDE_DIR
//  - au demarrage : rattrapage si la derniere sauvegarde reussie a plus de 26 h (serveur arrete la nuit)
//  - une copie par semaine dans SAUVEGARDE_DIR/hebdo et, si configure, dans SAUVEGARDE_DIR_SECONDAIRE
//    (autre disque ou partage reseau : protege contre la perte du disque principal)
//  - conservation : SAUVEGARDE_RETENTION_JOURS (30) pour les quotidiennes, SAUVEGARDE_HEBDO_SEMAINES (12)
//  - le mot de passe MySQL est transmis par variable d'environnement (MYSQL_PWD), jamais en argument
// Restauration (manuelle, sur le serveur) : voir docs dans la page Administration > Sauvegardes.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { spawn } = require('child_process');
const cron = require('node-cron');
const { Op } = require('sequelize');
const { Sauvegarde } = require('../models');

const JOUR = 86400000;
const DELAI_ALERTE_H = 26;            // au-dela, la sauvegarde nocturne est consideree manquee

const config = () => {
  const racine = path.resolve(__dirname, '..', '..');
  const mysqldumpXampp = 'C:\\xampp\\mysql\\bin\\mysqldump.exe';
  return {
    dossier: path.resolve(racine, process.env.SAUVEGARDE_DIR || 'storage/sauvegardes'),
    secondaire: process.env.SAUVEGARDE_DIR_SECONDAIRE ? path.resolve(process.env.SAUVEGARDE_DIR_SECONDAIRE) : null,
    mysqldump: process.env.MYSQLDUMP_PATH || (process.platform === 'win32' && fs.existsSync(mysqldumpXampp) ? mysqldumpXampp : 'mysqldump'),
    retentionJours: parseInt(process.env.SAUVEGARDE_RETENTION_JOURS, 10) || 30,
    hebdoSemaines: parseInt(process.env.SAUVEGARDE_HEBDO_SEMAINES, 10) || 12,
    cron: process.env.SAUVEGARDE_CRON || '0 0 2 * * *',
  };
};

let enCours = false;

const horodatage = (d = new Date()) => {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
};

// mysqldump -> gzip -> fichier ; verifie la fin du dump (« Dump completed »)
const dump = (fichier, cfg) => new Promise((resolve, reject) => {
  const args = [
    '--single-transaction', '--routines', '--triggers', '--events', '--default-character-set=utf8mb4',
    '-h', process.env.DB_HOST || 'localhost', '-P', String(process.env.DB_PORT || 3306),
    '-u', process.env.DB_USER || 'root', process.env.DB_NAME || 'mica_db',
  ];
  const proc = spawn(cfg.mysqldump, args, { env: { ...process.env, MYSQL_PWD: process.env.DB_PASSWORD || '' }, windowsHide: true });
  const sortie = fs.createWriteStream(fichier);
  const gzip = zlib.createGzip({ level: 9 });
  let fin = '';
  let erreurs = '';
  proc.stdout.on('data', (c) => { fin = (fin + c.toString('utf8')).slice(-200); });
  proc.stdout.pipe(gzip).pipe(sortie);
  proc.stderr.on('data', (c) => { erreurs += c.toString(); });
  proc.on('error', (e) => reject(new Error(`mysqldump introuvable ou non executable (${cfg.mysqldump}) : ${e.message}`)));
  let code = null; let ferme = false;
  const terminer = () => {
    if (code === null || !ferme) return;
    if (code !== 0) return reject(new Error(`mysqldump a echoue (code ${code}) : ${erreurs.trim().slice(0, 300)}`));
    if (!/Dump completed/.test(fin)) return reject(new Error('Sauvegarde incomplete : fin du dump absente.'));
    resolve();
  };
  proc.on('close', (c) => { code = c; terminer(); });
  sortie.on('close', () => { ferme = true; terminer(); });
});

// Suppression des sauvegardes au-dela de la duree de conservation
const rotation = (dossier, maxAgeJours) => {
  if (!fs.existsSync(dossier)) return;
  const limite = Date.now() - maxAgeJours * JOUR;
  for (const f of fs.readdirSync(dossier)) {
    if (!/^mica_db_.*\.sql\.gz$/.test(f)) continue;
    const p = path.join(dossier, f);
    if (fs.statSync(p).mtimeMs < limite) fs.unlinkSync(p);
  }
};

// Une copie hebdomadaire : si aucune copie de moins de 7 jours dans le dossier hebdo
const copieHebdoNecessaire = (dossierHebdo) => {
  if (!fs.existsSync(dossierHebdo)) return true;
  return !fs.readdirSync(dossierHebdo).some(f => /\.sql\.gz$/.test(f)
    && fs.statSync(path.join(dossierHebdo, f)).mtimeMs > Date.now() - 7 * JOUR);
};

const lancerSauvegarde = async (origine = 'PLANIFIEE', userId = null) => {
  if (enCours) throw { status: 409, message: 'Une sauvegarde est déjà en cours.' };
  enCours = true;
  const cfg = config();
  const debut = Date.now();
  const nom = `mica_db_${horodatage()}.sql.gz`;
  const fichier = path.join(cfg.dossier, nom);
  try {
    fs.mkdirSync(cfg.dossier, { recursive: true });
    await dump(fichier, cfg);
    const taille = fs.statSync(fichier).size;

    // Copie hebdomadaire (dossier hebdo + dossier secondaire)
    let copieSecondaire = false;
    const hebdo = path.join(cfg.dossier, 'hebdo');
    if (copieHebdoNecessaire(hebdo)) {
      fs.mkdirSync(hebdo, { recursive: true });
      fs.copyFileSync(fichier, path.join(hebdo, nom));
      if (cfg.secondaire) {
        try {
          fs.mkdirSync(cfg.secondaire, { recursive: true });
          fs.copyFileSync(fichier, path.join(cfg.secondaire, nom));
          rotation(cfg.secondaire, cfg.hebdoSemaines * 7);
          copieSecondaire = true;
        } catch (e) {
          console.error('[Sauvegarde] Copie secondaire impossible :', e.message);
        }
      }
    }
    rotation(cfg.dossier, cfg.retentionJours);
    rotation(hebdo, cfg.hebdoSemaines * 7);

    const ligne = await Sauvegarde.create({
      fichier: nom, taille, statut: 'OK', origine, duree_ms: Date.now() - debut,
      copie_secondaire: copieSecondaire ? 1 : 0, created_by: userId,
      message: copieSecondaire ? 'Copie hebdomadaire effectuée (dossier secondaire).' : null,
    });
    console.log(`[Sauvegarde] ${nom} (${Math.round(taille / 1024)} Ko) en ${Date.now() - debut} ms`);
    return ligne;
  } catch (err) {
    try { if (fs.existsSync(fichier)) fs.unlinkSync(fichier); } catch { /* fichier partiel */ }
    console.error('[Sauvegarde] ECHEC :', err.message);
    return Sauvegarde.create({
      fichier: null, statut: 'ECHEC', origine, duree_ms: Date.now() - debut,
      message: String(err.message || err).slice(0, 500), created_by: userId,
    });
  } finally {
    enCours = false;
  }
};

// Etat pour l'administration : derniere sauvegarde reussie, alerte si trop ancienne ou en echec
const getEtat = async () => {
  const cfg = config();
  const [derniereOk, derniere] = await Promise.all([
    Sauvegarde.findOne({ where: { statut: 'OK' }, order: [['created_at', 'DESC']] }),
    Sauvegarde.findOne({ order: [['created_at', 'DESC']] }),
  ]);
  const ageH = derniereOk ? (Date.now() - new Date(derniereOk.created_at).getTime()) / 3600000 : null;
  let alerte = null;
  if (!derniereOk) alerte = 'Aucune sauvegarde réussie à ce jour.';
  else if (derniere && derniere.statut === 'ECHEC') alerte = `La dernière sauvegarde a échoué : ${derniere.message || 'erreur inconnue'}`;
  else if (ageH > DELAI_ALERTE_H) alerte = `Dernière sauvegarde réussie il y a ${Math.floor(ageH / 24)} jour(s).`;
  return {
    alerte, en_cours: enCours,
    derniere_reussie: derniereOk ? { le: derniereOk.created_at, fichier: derniereOk.fichier, taille: Number(derniereOk.taille) } : null,
    configuration: {
      dossier: cfg.dossier, secondaire: cfg.secondaire, retention_jours: cfg.retentionJours,
      hebdo_semaines: cfg.hebdoSemaines, planification: cfg.cron,
    },
  };
};

const getHistorique = async () => {
  const rows = await Sauvegarde.findAll({ order: [['created_at', 'DESC']], limit: 30 });
  return rows.map(r => ({
    id: r.id, le: r.created_at, statut: r.statut, origine: r.origine, fichier: r.fichier,
    taille: r.taille === null ? null : Number(r.taille), duree_ms: r.duree_ms, message: r.message,
    copie_secondaire: !!r.copie_secondaire,
  }));
};

let tache = null;
const startSauvegardes = async () => {
  const cfg = config();
  if (!cron.validate(cfg.cron)) {
    console.error(`[Sauvegarde] Expression cron invalide : ${cfg.cron}`);
    return;
  }
  if (tache) tache.stop();
  tache = cron.schedule(cfg.cron, () => { lancerSauvegarde('PLANIFIEE').catch(() => {}); }, { timezone: 'Africa/Ouagadougou' });
  console.log(`[Sauvegarde] Planifiée : ${cfg.cron} -> ${cfg.dossier}`);
  // Rattrapage : serveur arrete au moment de la sauvegarde nocturne
  const derniere = await Sauvegarde.findOne({ where: { statut: 'OK' }, order: [['created_at', 'DESC']] });
  if (!derniere || Date.now() - new Date(derniere.created_at).getTime() > DELAI_ALERTE_H * 3600000) {
    setTimeout(() => { lancerSauvegarde('RATTRAPAGE').catch(() => {}); }, 30000);   // apres le demarrage
  }
};

module.exports = { lancerSauvegarde, getEtat, getHistorique, startSauvegardes };
