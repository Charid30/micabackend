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
// Notifications push de l'application mobile, via Firebase Cloud Messaging (API HTTP v1).
//
// Compte de service Firebase : fichier JSON SECRET, jamais versionné ni servi par l'API,
// dans secrets/firebase-service-account.json (ou chemin FIREBASE_SERVICE_ACCOUNT du .env).
// Sans ce fichier, rien n'est envoyé aux téléphones (les notifications du navigateur continuent).
//
// Jeton d'accès Google : JWT signé RS256 avec la clé du compte de service, échangé contre un
// jeton OAuth (valable 1 h, gardé 50 min). Aucune bibliothèque Google supplémentaire.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { PushMobile } = require('../models');

const FICHIER = process.env.FIREBASE_SERVICE_ACCOUNT || path.join(__dirname, '..', '..', 'secrets', 'firebase-service-account.json');
let compte; // { project_id, client_email, private_key } ; null = non configuré
let acces = { jeton: null, expire: 0 };

const hash = (t) => crypto.createHash('sha256').update(String(t)).digest('hex');

function compteService() {
  if (compte !== undefined) return compte;
  try {
    const c = JSON.parse(fs.readFileSync(FICHIER, 'utf8'));
    compte = c.project_id && c.client_email && c.private_key ? c : null;
    if (!compte) console.error('[FCM] Compte de service incomplet : notifications mobiles désactivées.');
  } catch {
    compte = null;
    console.log('[FCM] Pas de compte de service Firebase : notifications mobiles désactivées.');
  }
  return compte;
}

const actif = () => !!compteService();

async function jetonAcces() {
  if (acces.jeton && Date.now() < acces.expire) return acces.jeton;
  const c = compteService();
  const maintenant = Math.floor(Date.now() / 1000);
  const assertion = jwt.sign({
    iss: c.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: maintenant,
    exp: maintenant + 3600,
  }, c.private_key, { algorithm: 'RS256' });
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
    signal: AbortSignal.timeout(15000),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error(`jeton Google refusé (${r.status} ${j.error || ''})`);
  acces = { jeton: j.access_token, expire: Date.now() + 50 * 60 * 1000 };
  return acces.jeton;
}

/** Téléphone du compte connecté : enregistré, ou rattaché à ce compte s'il servait à un autre */
async function enregistrer(user, { jeton, plateforme, appareil }) {
  const h = hash(jeton);
  const valeurs = {
    utilisateur_id: user.id, jeton, plateforme: plateforme === 'ios' ? 'ios' : 'android',
    appareil: appareil ? String(appareil).slice(0, 120) : null, vu_le: new Date(),
  };
  const existant = await PushMobile.findOne({ where: { jeton_hash: h } });
  if (existant) await existant.update(valeurs);
  else await PushMobile.create({ ...valeurs, jeton_hash: h });
  return { message: 'Notifications activées sur ce téléphone.', actif: actif() };
}

/** Déconnexion : le téléphone ne reçoit plus les notifications de ce compte */
async function retirer(user, jeton) {
  await PushMobile.destroy({ where: { jeton_hash: hash(jeton), utilisateur_id: user.id } });
  return { message: 'Notifications désactivées sur ce téléphone.' };
}

// Écran de l'application ouvert au toucher de la notification (adresse de la plateforme)
const ecranDe = (url = '') => {
  if (/^\/rapports/.test(url)) return 'rapports';
  if (/^\/(saisie|rdc)\//.test(url)) return 'saisie';
  if (/^\/(administration|profil)/.test(url)) return 'alertes';
  return 'accueil';
};

/**
 * Envoi aux téléphones des comptes donnés. payload : { titre, corps, url, tag }.
 * Jetons déclarés invalides par Firebase (application désinstallée...) : supprimés.
 */
async function envoyer(utilisateurIds, payload) {
  if (!utilisateurIds.length || !actif()) return 0;
  const telephones = await PushMobile.findAll({ where: { utilisateur_id: utilisateurIds } });
  if (!telephones.length) return 0;
  let jeton;
  try { jeton = await jetonAcces(); } catch (e) { console.error('[FCM]', e.message); return 0; }
  const url = `https://fcm.googleapis.com/v1/projects/${compte.project_id}/messages:send`;
  let envoyes = 0;
  await Promise.allSettled(telephones.map(async (t) => {
    const message = {
      token: t.jeton,
      notification: { title: String(payload.titre || 'Indicateur SONABHY').slice(0, 120), body: String(payload.corps || '').slice(0, 500) },
      data: { ecran: ecranDe(payload.url), url: String(payload.url || '') },
      android: {
        priority: 'HIGH',
        ttl: '43200s', // 12 h, comme les notifications du navigateur
        notification: { channel_id: 'mica_alertes', tag: payload.tag ? String(payload.tag).slice(0, 64) : undefined, icon: 'ic_notification', color: '#235347' },
      },
    };
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${jeton}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
        signal: AbortSignal.timeout(15000),
      });
      if (r.ok) {
        envoyes++;
        await t.update({ dernier_envoi_at: new Date() });
        return;
      }
      const e = await r.json().catch(() => ({}));
      const code = e?.error?.details?.find?.((d) => d.errorCode)?.errorCode || e?.error?.status;
      // Application désinstallée, jeton périmé ou d'un autre projet : on l'oublie
      if (r.status === 404 || code === 'UNREGISTERED' || code === 'INVALID_ARGUMENT' || code === 'SENDER_ID_MISMATCH') await t.destroy();
      else console.error(`[FCM] Échec d'envoi (${r.status} ${code || ''})`);
    } catch (e) {
      console.error('[FCM] Échec d\'envoi :', e.message);
    }
  }));
  return envoyes;
}

module.exports = { enregistrer, retirer, envoyer, actif };
