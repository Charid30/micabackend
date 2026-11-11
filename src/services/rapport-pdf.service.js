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
// PDF d'un rapport hebdomadaire fabrique par le serveur (application mobile, et publication).
//
// Le document est celui du bouton « Télécharger le PDF » de la plateforme : le Chrome du serveur
// ouvre la page Rapports (?impression=ID) avec une session ouverte pour le demandeur, la page
// construit le document (window.__micaRapportPdf) et la session est fermee aussitot.
// Le document d'un rapport PUBLIE ne change plus : il est garde dans storage/rapports et sert
// ensuite a chaque demande. Le PDF est imprime a chaque demande, avec le nom du demandeur en pied.
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const { RapportHebdo, Utilisateur, Agent, Permission } = require('../models');
const { imprimer, avecPage } = require('./pdf.service');

const DOSSIER = path.join(__dirname, '..', '..', 'storage', 'rapports');
const DELAI_CAPTURE_MS = 60000;
const enCours = new Map(); // rapport -> promesse : deux demandes simultanees ne capturent qu'une fois

const fichierCache = (id) => path.join(DOSSIER, `rapport_${parseInt(id, 10)}.json`);

// Adresse de la plateforme vue depuis le serveur (en production, l'Apache de la meme machine)
const adressePlateforme = () => String(process.env.PDF_FRONTEND_URL || process.env.CORS_ORIGIN || 'http://localhost:4200').replace(/\/+$/, '');

const auteur = (u) => {
  const nom = [u?.agent?.prenoms, u?.agent?.nom ? String(u.agent.nom).toUpperCase() : null].filter(Boolean).join(' ').trim();
  return (nom || u?.username || 'utilisateur inconnu').slice(0, 120);
};

/** Ouvre la page du rapport dans le Chrome du serveur et renvoie { html, fichier } */
async function capturer(rapportId, user) {
  const { issueToken, getMe } = require('./auth.service');
  const { revoquer } = require('./session.service');
  const base = adressePlateforme();
  // Profil attendu par la plateforme (garde d'acces et menus), comme apres une connexion
  const profil = await getMe(user.id);
  const token = await issueToken(user, '127.0.0.1');
  const { sid } = jwt.decode(token);
  try {
    return await avecPage(async (page) => {
      // Seule la plateforme est joignable : aucune ressource externe (polices...) n'est chargee
      await page.setRequestInterception(true);
      page.on('request', (r) => {
        const u = r.url();
        if (u.startsWith(base) || u.startsWith('data:') || u.startsWith('blob:') || new URL(u).hostname === new URL(base).hostname) r.continue();
        else r.abort();
      });
      await page.setViewport({ width: 1280, height: 900 });
      await page.setCookie({ name: 'mica_token', value: token, url: base, httpOnly: true, sameSite: 'Strict', secure: base.startsWith('https:') });
      await page.evaluateOnNewDocument((p) => { try { localStorage.setItem('mica_user', p); } catch { /* sans stockage */ } }, JSON.stringify(profil));
      await page.goto(`${base}/rapports?impression=${parseInt(rapportId, 10)}`, { waitUntil: 'domcontentloaded', timeout: DELAI_CAPTURE_MS });
      await page.waitForFunction(() => (window).__micaRapportPdf, { timeout: DELAI_CAPTURE_MS });
      const r = await page.evaluate(() => (window).__micaRapportPdf);
      if (r?.erreur) throw new Error(r.erreur);
      if (!r?.html || !/^\s*<!doctype html>/i.test(r.html)) throw new Error('Document du rapport invalide.');
      return { html: r.html, fichier: r.fichier };
    });
  } finally {
    await revoquer(sid).catch(() => {});
  }
}

/** Document du rapport : celui garde pour un rapport publie, sinon capture */
async function documentDuRapport(rapport, user) {
  const cache = fichierCache(rapport.id);
  if (rapport.statut === 'PUBLIE' && fs.existsSync(cache)) {
    try { return JSON.parse(fs.readFileSync(cache, 'utf8')); } catch { /* fichier abime : recapture */ }
  }
  const cle = `${rapport.id}:${rapport.statut}`;
  if (!enCours.has(cle)) {
    enCours.set(cle, capturer(rapport.id, user).then((doc) => {
      if (rapport.statut === 'PUBLIE') {
        fs.mkdirSync(DOSSIER, { recursive: true });
        fs.writeFileSync(cache, JSON.stringify({ ...doc, capture_le: new Date().toISOString() }));
      }
      return doc;
    }).finally(() => enCours.delete(cle)));
  }
  return enCours.get(cle);
}

/** PDF du rapport pour ce compte (nom du demandeur en pied de page) */
async function pdfDuRapport(rapportId, user) {
  const rapport = await RapportHebdo.findOne({ where: { id: rapportId, del: 0 } });
  if (!rapport) throw { status: 404, message: 'Rapport introuvable.' };
  const doc = await documentDuRapport(rapport, user);
  const pdf = await imprimer(doc.html, {
    pied: `MICA – SONABHY · imprimé par ${auteur(user)} le ${new Date().toLocaleString('fr-FR', { timeZone: 'Africa/Ouagadougou' })}`,
  });
  return { pdf, fichier: doc.fichier || `rapport_semaine_${rapport.semaine_iso}_${rapport.annee}.pdf` };
}

/** A la publication : document prepare d'avance (premiere demande instantanee). Jamais bloquant. */
function preparerALaPublication(rapport, utilisateurId = null) {
  setImmediate(async () => {
    try {
      // Compte de la publication, sinon un administrateur actif (publication automatique du vendredi)
      const include = [{ model: Agent, as: 'agent' }, { model: Permission, as: 'permissions', required: false }];
      const user = (utilisateurId && await Utilisateur.findOne({ where: { id: utilisateurId, del: 0, suspendu_le: null }, include }))
        || await Utilisateur.findOne({ where: { is_admin: 1, del: 0, suspendu_le: null }, include, order: [['id', 'ASC']] });
      if (!user) return;
      const r = await RapportHebdo.findByPk(rapport.id);
      if (r?.statut === 'PUBLIE') await documentDuRapport(r, user);
      console.log(`[PDF] Document du rapport semaine ${rapport.semaine_iso}/${rapport.annee} enregistré.`);
    } catch (e) {
      console.error('[PDF] Préparation à la publication :', e.message);
    }
  });
}

/** Rapport supprime : son document garde est retire */
function oublier(rapportId) {
  fs.rm(fichierCache(rapportId), { force: true }, () => {});
}

module.exports = { pdfDuRapport, preparerALaPublication, oublier };
