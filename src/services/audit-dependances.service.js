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
// Revue mensuelle des dépendances vulnérables (maintenance préventive) :
//  - le 1er de chaque mois à 08h00 (AUDIT_DEPENDANCES_CRON), « npm audit » de l'API et, si
//    AUDIT_DEPENDANCES_WEB_DIR est renseigné, du dossier source de la plateforme web ;
//  - chaque revue est inscrite au journal d'audit (auteur « Système ») : preuve de la revue pour les audits ;
//  - vulnérabilité trouvée ou revue impossible (pas d'accès à Internet…) : notification de mise à jour et
//    notification du navigateur aux administrateurs.
// Correction : mise à jour ciblée de la dépendance en cause ; jamais « npm audit fix --force ».
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const cron = require('node-cron');

const GRAVITES = ['critical', 'high', 'moderate', 'low'];
const LIBELLES = { critical: 'critique', high: 'élevée', moderate: 'moyenne', low: 'faible' };
let tache = null;

const projets = () => {
  const liste = [{ nom: 'API', dossier: path.resolve(__dirname, '../..') }];
  const web = process.env.AUDIT_DEPENDANCES_WEB_DIR;
  if (web && fs.existsSync(path.join(web, 'package-lock.json'))) liste.push({ nom: 'Plateforme web', dossier: path.resolve(web) });
  return liste;
};

// npm audit --json : code de sortie non nul dès qu'une vulnérabilité existe, on lit donc toujours la sortie
const auditer = (dossier) => new Promise((resolve) => {
  // Commande fixe, sans aucune donnée extérieure (le dossier est passé par cwd)
  const proc = spawn('npm audit --omit=dev --json', { cwd: dossier, shell: true, windowsHide: true });
  let sortie = '';
  const fin = setTimeout(() => proc.kill(), 120000);
  proc.stdout.on('data', (d) => { sortie += d; });
  proc.on('error', (e) => { clearTimeout(fin); resolve({ erreur: e.message }); });
  proc.on('close', () => {
    clearTimeout(fin);
    try {
      const j = JSON.parse(sortie);
      if (j.error) return resolve({ erreur: j.error.summary || 'npm audit a échoué' });
      const v = j.metadata?.vulnerabilities || {};
      const paquets = Object.values(j.vulnerabilities || {})
        .sort((a, b) => GRAVITES.indexOf(a.severity) - GRAVITES.indexOf(b.severity))
        .map((x) => `${x.name} (${LIBELLES[x.severity] || x.severity})`);
      resolve({ total: v.total || 0, compte: v, paquets });
    } catch {
      resolve({ erreur: 'réponse de npm audit illisible (accès à Internet ?)' });
    }
  });
});

const revue = async () => {
  const { JournalAction } = require('../models');
  const resultats = [];
  for (const p of projets()) resultats.push({ ...p, ...(await auditer(p.dossier)) });

  const lignes = resultats.map((r) => {
    if (r.erreur) return `${r.nom} : revue impossible (${r.erreur})`;
    if (!r.total) return `${r.nom} : aucune vulnérabilité connue`;
    const detail = GRAVITES.filter((g) => r.compte[g]).map((g) => `${r.compte[g]} ${LIBELLES[g]}`).join(', ');
    return `${r.nom} : ${r.total} vulnérabilité(s) (${detail}) – ${r.paquets.slice(0, 8).join(', ')}${r.paquets.length > 8 ? '…' : ''}`;
  });
  const alerte = resultats.some((r) => r.erreur || r.total);
  console.log(`[Dépendances] Revue mensuelle : ${lignes.join(' | ')}`);

  await JournalAction.create({
    utilisateur_id: null, username: 'Système', action: 'Revue des dépendances', module: 'Maintenance',
    route: 'TACHE revue-dependances', description: lignes.join(' ; ').slice(0, 500),
    statut_http: alerte ? 500 : 200, succes: alerte ? 0 : 1,
  }).catch((e) => console.error('[Dépendances] Journal :', e.message));

  if (alerte) await prevenirAdministrateurs(lignes).catch((e) => console.error('[Dépendances] Alerte :', e.message));
  return { alerte, lignes };
};

const prevenirAdministrateurs = async (lignes) => {
  const { sequelize, Message, MessageDestinataire } = require('../models');
  const notifications = require('./notifications.service');
  const ids = (await notifications.utilisateursActifs()).filter((u) => u.is_admin).map((u) => u.id);
  if (!ids.length) return;
  await sequelize.transaction(async (transaction) => {
    const m = await Message.create({
      titre: 'Revue mensuelle des dépendances : action requise',
      contenu: `${lignes.map((l) => `• ${l}`).join('\n')}\n\nMettre à jour la dépendance en cause de façon ciblée, tester, `
        + 'puis déployer une version corrective. Ne jamais utiliser « npm audit fix --force ».',
    }, { transaction });
    await MessageDestinataire.bulkCreate(ids.map((utilisateur_id) => ({ message_id: m.id, utilisateur_id })), { transaction });
  });
  require('./temps-reel.service').envoyerA(ids, 'message-recu');
  await notifications.alerterAdministrateurs({
    titre: 'Dépendances : action requise', corps: lignes.join(' ; ').slice(0, 180), url: '/administration/messages', tag: 'revue-dependances',
  });
};

const startAuditDependances = () => {
  const expression = process.env.AUDIT_DEPENDANCES_CRON || '0 0 8 1 * *';
  if (!cron.validate(expression)) return console.error(`[Dépendances] Expression cron invalide : ${expression}`);
  if (tache) tache.stop();
  tache = cron.schedule(expression, () => { revue().catch((e) => console.error('[Dépendances]', e.message)); }, { timezone: 'Africa/Ouagadougou' });
  console.log(`[Dépendances] Revue planifiée : ${expression}`);
};

module.exports = { startAuditDependances, revue };
