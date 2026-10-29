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
// Notifications push web (standard Web Push, cles VAPID) :
//  - rapport publie : tous ceux qui peuvent consulter les rapports ;
//  - rappel du soir (20h30 par defaut) : saisies quotidiennes du jour non faites, envoye a ceux qui
//    ont le droit de les saisir (un agent de depot n'est prevenu que pour son depot). Une seule
//    notification par personne, qui liste ce qui manque.
// Cles VAPID : VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY (/ VAPID_SUBJECT) dans .env ; a defaut, elles
// sont creees au premier demarrage dans secrets/vapid.json (a conserver : si elles changent,
// chaque utilisateur doit reactiver les notifications).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const webpush = require('web-push');
const { Op } = require('sequelize');
const {
  PushAbonnement, Utilisateur, Permission, Parametre, Depot, StockDepot, CamionDepot,
} = require('../models');
const frequence = require('./frequence.service');

const FICHIER_CLES = path.join(__dirname, '../../secrets/vapid.json');

let cles = null;
const chargerCles = () => {
  if (cles) return cles;
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    cles = { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
  } else if (fs.existsSync(FICHIER_CLES)) {
    cles = JSON.parse(fs.readFileSync(FICHIER_CLES, 'utf8'));
  } else {
    cles = webpush.generateVAPIDKeys();
    fs.mkdirSync(path.dirname(FICHIER_CLES), { recursive: true });
    fs.writeFileSync(FICHIER_CLES, JSON.stringify(cles, null, 2), { mode: 0o600 });
    console.log('[Push] Cles VAPID creees dans secrets/vapid.json');
  }
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:bkevin@sonabhy.bf', cles.publicKey, cles.privateKey);
  return cles;
};

const hash = (endpoint) => crypto.createHash('sha256').update(endpoint).digest('hex');

const getClePublique = () => ({ cle: chargerCles().publicKey });

// ── Abonnements (un par navigateur ; il suit l'utilisateur connecte sur ce navigateur)
const abonner = async (user, abonnement, navigateur) => {
  const endpoint = abonnement?.endpoint;
  const { p256dh, auth } = abonnement?.keys || {};
  if (typeof endpoint !== 'string' || !/^https:\/\//.test(endpoint) || endpoint.length > 700
    || typeof p256dh !== 'string' || p256dh.length > 255 || typeof auth !== 'string' || auth.length > 100) {
    throw { status: 400, message: 'Abonnement invalide.' };
  }
  const valeurs = {
    utilisateur_id: user.id, endpoint, p256dh, auth, navigateur: String(navigateur || '').slice(0, 255) || null,
    del: 0, deleted_at: null, deleted_by: null, updated_by: user.id, updated_at: new Date(),
  };
  const existant = await PushAbonnement.findOne({ where: { endpoint_hash: hash(endpoint) } });
  if (existant) await existant.update(valeurs);
  else await PushAbonnement.create({ ...valeurs, endpoint_hash: hash(endpoint), created_by: user.id });
  return { message: 'Notifications activées sur ce navigateur.' };
};

const desabonner = async (user, endpoint) => {
  if (typeof endpoint !== 'string') throw { status: 400, message: 'Abonnement invalide.' };
  await PushAbonnement.update({ del: 1, deleted_at: new Date(), deleted_by: user.id },
    { where: { endpoint_hash: hash(endpoint), utilisateur_id: user.id, del: 0 } });
  return { message: 'Notifications désactivées sur ce navigateur.' };
};

// ── Envoi
// payload : { titre, corps, url, tag }
const envoyer = async (utilisateurIds, payload) => {
  if (!utilisateurIds.length) return 0;
  chargerCles();
  const abonnements = await PushAbonnement.findAll({ where: { utilisateur_id: utilisateurIds, del: 0 } });
  const message = JSON.stringify(payload);
  let envoyes = 0;
  await Promise.allSettled(abonnements.map(async (a) => {
    try {
      await webpush.sendNotification({ endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } }, message,
        { TTL: 12 * 3600, urgency: 'high' });
      envoyes++;
      await a.update({ dernier_envoi_at: new Date() });
    } catch (e) {
      // Abonnement expire ou retire par l'utilisateur dans son navigateur : on l'oublie
      if (e.statusCode === 404 || e.statusCode === 410) await a.update({ del: 1, deleted_at: new Date() });
      else console.error(`[Push] Echec d'envoi (${e.statusCode || e.message})`);
    }
  }));
  return envoyes;
};

// Utilisateurs actifs avec leurs droits
const utilisateursActifs = () => Utilisateur.findAll({
  where: { del: 0 },
  attributes: ['id', 'is_admin'],
  include: [{ model: Permission, as: 'permissions', where: { del: 0 }, required: false }],
});

const aDroit = (u, module, action, depotId = null) => u.is_admin || (u.permissions || []).some(p =>
  p.module === module && (action === 'READ' ? ['READ', 'WRITE'].includes(p.action) : p.action === 'WRITE')
  && (!depotId || !p.depot_id || p.depot_id === depotId));

const dateFr = (d) => String(d).split('-').reverse().join('/');

// ── Rapport publie
const notifierRapportPublie = async (rapport) => {
  try {
    const ids = (await utilisateursActifs()).filter(u => aDroit(u, 'rapports', 'READ')).map(u => u.id);
    const n = await envoyer(ids, {
      titre: `Rapport semaine ${rapport.semaine_iso}/${rapport.annee} disponible`,
      corps: `Le rapport du ${dateFr(rapport.date_debut)} au ${dateFr(rapport.date_fin)} est publié.`,
      url: '/rapports', tag: `rapport-${rapport.id}`,
    });
    console.log(`[Push] Rapport semaine ${rapport.semaine_iso} : ${n} notification(s) envoyee(s)`);
  } catch (e) { console.error('[Push] Rapport publie :', e.message); }
};

// ── Saisies quotidiennes du jour non faites
// Module de frequence -> droit requis et ecran de saisie
const ECRANS = {
  'stocks-int': { droit: 'stocks', url: '/saisie/stocks/interieurs' },
  'stocks-ext': { droit: 'stocks', url: '/saisie/stocks/exterieurs' },
  corridors: { droit: 'corridors', url: '/saisie/corridors' },
  'depots-int': { droit: 'depots-int', url: '/saisie/depots-int' },
  'temps-attente': { droit: 'temps-attente', url: '/saisie/temps-attente' },
  'veille-marche': { droit: 'veille-marche', url: '/saisie/veille-marche' },
  'veille-geo': { droit: 'veille-geo', url: '/saisie/veille-geo' },
  ventes: { droit: 'ventes', url: '/saisie/ventes' },
  tresorerie: { droit: 'tresorerie', url: '/saisie/tresorerie' },
  recommandations: { droit: 'recommandations', url: '/saisie/recommandations' },
  'encours-livraison': { droit: 'encours-livraison', url: '/saisie/encours-livraison' },
};

// Liste de ce qui manque aujourd'hui : [{ libelle, droit, depot_id, url }]
const saisiesManquantes = async () => {
  const jour = frequence.aujourdhui();
  const manquantes = [];
  for (const m of frequence.MODULES) {
    const ecran = ECRANS[m.code];
    if (!ecran || !m.model || await frequence.frequenceDe(m.code) !== 'QUOTIDIEN') continue;
    const parDepot = m.code === 'stocks-int' || m.code === 'stocks-ext' || m.code === 'depots-int';
    if (!parDepot) {
      if (!await m.model.findOne({ where: { date_saisie: jour, del: 0 }, attributes: ['id'] })) {
        manquantes.push({ libelle: m.libelle, droit: ecran.droit, depot_id: null, url: ecran.url });
      }
      continue;
    }
    const type = m.code === 'stocks-ext' ? 'EXTERIEUR' : 'INTERIEUR';
    const depots = await Depot.findAll({ where: { type, del: 0 }, attributes: ['id', 'libelle'] });
    const Model = m.code === 'depots-int' ? CamionDepot : StockDepot;
    const saisis = new Set((await Model.findAll({
      where: { date_saisie: jour, del: 0, depot_id: { [Op.in]: depots.map(d => d.id) } }, attributes: ['depot_id'],
    })).map(r => r.depot_id));
    for (const d of depots.filter(x => !saisis.has(x.id))) {
      const titre = m.code === 'depots-int' ? 'Dépôts intérieurs' : 'Stocks';
      manquantes.push({ libelle: `${titre} – ${d.libelle}`, droit: ecran.droit, depot_id: d.id, url: ecran.url });
    }
  }
  return manquantes;
};

const joursDuRappel = async () => {
  const p = await Parametre.findOne({ where: { cle: 'NOTIF_SAISIE_JOURS', del: 0 } });
  return String(p?.valeur ?? '1,2,3,4,5,6,7').split(',').map(s => Number(s.trim())).filter(Boolean);
};

const rappelerSaisiesManquantes = async ({ force = false } = {}) => {
  try {
    const jourIso = new Date().getUTCDay() || 7;            // Ouagadougou = UTC+0
    if (!force && !(await joursDuRappel()).includes(jourIso)) return { envoyes: 0, manquantes: [] };
    const manquantes = await saisiesManquantes();
    if (!manquantes.length) {
      console.log('[Push] Rappel du soir : toutes les saisies du jour sont faites');
      return { envoyes: 0, manquantes };
    }
    let envoyes = 0;
    for (const u of await utilisateursActifs()) {
      const siennes = manquantes.filter(x => aDroit(u, x.droit, 'WRITE', x.depot_id));
      if (!siennes.length) continue;
      const liste = siennes.slice(0, 4).map(x => x.libelle).join(', ') + (siennes.length > 4 ? ` et ${siennes.length - 4} autre(s)` : '');
      envoyes += await envoyer([u.id], {
        titre: siennes.length > 1 ? `${siennes.length} saisies du jour non renseignées` : 'Saisie du jour non renseignée',
        corps: liste,
        url: siennes[0].url, tag: `saisies-${frequence.aujourdhui()}`,
      });
    }
    console.log(`[Push] Rappel du soir : ${manquantes.length} saisie(s) manquante(s), ${envoyes} notification(s) envoyee(s)`);
    return { envoyes, manquantes };
  } catch (e) {
    console.error('[Push] Rappel du soir :', e.message);
    return { envoyes: 0, manquantes: [] };
  }
};

// Notification d'essai envoyee a l'utilisateur lui-meme (ecran Mon profil)
const tester = async (user) => {
  const n = await envoyer([user.id], {
    titre: 'Notifications MICA', corps: 'Les notifications fonctionnent sur ce navigateur.', url: '/profil', tag: 'essai',
  });
  if (!n) throw { status: 400, message: 'Aucun navigateur abonné n\'a pu être joint. Réactivez les notifications.' };
  return { message: `Notification d'essai envoyée (${n} navigateur${n > 1 ? 's' : ''}).` };
};

module.exports = {
  getClePublique, abonner, desabonner, envoyer, notifierRapportPublie,
  saisiesManquantes, rappelerSaisiesManquantes, tester, chargerCles,
};
