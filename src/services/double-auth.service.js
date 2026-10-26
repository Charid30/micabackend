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
// Double authentification par code temporaire (TOTP, RFC 6238) : compatible Google Authenticator,
// Microsoft Authenticator, FreeOTP... Code de 6 chiffres renouvele toutes les 30 secondes.
//  - le secret est chiffre en base (AES-256-GCM, cle TOTP_CLE_CHIFFREMENT ou derivee de JWT_SECRET)
//  - 8 codes de secours a usage unique (empreintes bcrypt) en cas de perte du telephone
//  - facultative par defaut ; peut etre rendue obligatoire pour les administrateurs (Parametres > Securite),
//    avec un delai de grace : un bandeau previent jusqu'a l'echeance, la configuration est ensuite exigee
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const QRCode = require('qrcode');
const { Utilisateur, Parametre } = require('../models');

const EMETTEUR = 'MICA SONABHY';
const PAS = 30;            // secondes
const CHIFFRES = 6;
const FENETRE = 1;         // tolerance : code precedent et suivant (decalage d'horloge du telephone)
const NB_CODES_SECOURS = 8;
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

// ── Base32 (format des secrets TOTP)
const base32Encoder = (buf) => {
  let bits = 0, valeur = 0, out = '';
  for (const octet of buf) {
    valeur = (valeur << 8) | octet; bits += 8;
    while (bits >= 5) { out += B32[(valeur >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(valeur << (5 - bits)) & 31];
  return out;
};
const base32Decoder = (txt) => {
  let bits = 0, valeur = 0; const out = [];
  for (const c of txt.replace(/=+$/, '').toUpperCase()) {
    const i = B32.indexOf(c); if (i === -1) continue;
    valeur = (valeur << 5) | i; bits += 5;
    if (bits >= 8) { out.push((valeur >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
};

// ── Code TOTP d'un compteur (HMAC-SHA1, troncature dynamique)
const codeTotp = (secretB32, compteur) => {
  const tampon = Buffer.alloc(8);
  tampon.writeBigUInt64BE(BigInt(compteur));
  const hmac = crypto.createHmac('sha1', base32Decoder(secretB32)).update(tampon).digest();
  const decalage = hmac[hmac.length - 1] & 0xf;
  const n = ((hmac[decalage] & 0x7f) << 24) | (hmac[decalage + 1] << 16) | (hmac[decalage + 2] << 8) | hmac[decalage + 3];
  return String(n % 10 ** CHIFFRES).padStart(CHIFFRES, '0');
};

// Dernier compteur accepte par compte : un meme code ne peut pas servir deux fois
const derniersCompteurs = new Map();
const verifierCode = (secretB32, code, utilisateurId = null) => {
  const saisi = String(code || '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(saisi)) return false;
  const actuel = Math.floor(Date.now() / 1000 / PAS);
  for (let d = -FENETRE; d <= FENETRE; d++) {
    const c = actuel + d;
    const attendu = codeTotp(secretB32, c);
    if (crypto.timingSafeEqual(Buffer.from(attendu), Buffer.from(saisi))) {
      if (utilisateurId !== null) {
        if ((derniersCompteurs.get(utilisateurId) ?? -1) >= c) return false;
        derniersCompteurs.set(utilisateurId, c);
      }
      return true;
    }
  }
  return false;
};

// ── Chiffrement du secret en base (AES-256-GCM)
const cle = () => {
  const brute = process.env.TOTP_CLE_CHIFFREMENT;
  if (brute && /^[0-9a-f]{64}$/i.test(brute)) return Buffer.from(brute, 'hex');
  return crypto.createHash('sha256').update(`mica-totp:${process.env.JWT_SECRET || ''}`).digest();
};
const chiffrer = (texte) => {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', cle(), iv);
  const donnees = Buffer.concat([c.update(texte, 'utf8'), c.final()]);
  return `${iv.toString('base64')}.${c.getAuthTag().toString('base64')}.${donnees.toString('base64')}`;
};
const dechiffrer = (valeur) => {
  const [iv, tag, donnees] = String(valeur).split('.');
  const d = crypto.createDecipheriv('aes-256-gcm', cle(), Buffer.from(iv, 'base64'));
  d.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([d.update(Buffer.from(donnees, 'base64')), d.final()]).toString('utf8');
};

// ── Codes de secours : 8 codes XXXX-XXXX, stockes en empreintes
const genererCodesSecours = async () => {
  const codes = Array.from({ length: NB_CODES_SECOURS }, () => {
    const b = base32Encoder(crypto.randomBytes(5)).slice(0, 8);
    return `${b.slice(0, 4)}-${b.slice(4)}`;
  });
  const empreintes = await Promise.all(codes.map(c => bcrypt.hash(c, 10)));
  return { codes, empreintes: JSON.stringify(empreintes) };
};
const normaliserCodeSecours = (code) => {
  const c = String(code || '').toUpperCase().replace(/[^A-Z2-7]/g, '');
  return c.length === 8 ? `${c.slice(0, 4)}-${c.slice(4)}` : null;
};

// ── Politique (Parametres > Securite)
const JOUR = 86400000;
const politique = async () => {
  const rows = await Parametre.findAll({ where: { cle: ['DOUBLE_AUTH_ADMIN_OBLIGATOIRE', 'DOUBLE_AUTH_DELAI_JOURS', 'DOUBLE_AUTH_OBLIGATOIRE_DEPUIS'], del: 0 } });
  const v = Object.fromEntries(rows.map(r => [r.cle, String(r.valeur ?? '').trim()]));
  const active = v.DOUBLE_AUTH_ADMIN_OBLIGATOIRE === '1';
  const delai = Number.isFinite(parseInt(v.DOUBLE_AUTH_DELAI_JOURS, 10)) ? Math.max(parseInt(v.DOUBLE_AUTH_DELAI_JOURS, 10), 0) : 7;
  const depuis = v.DOUBLE_AUTH_OBLIGATOIRE_DEPUIS && !Number.isNaN(Date.parse(v.DOUBLE_AUTH_OBLIGATOIRE_DEPUIS)) ? new Date(v.DOUBLE_AUTH_OBLIGATOIRE_DEPUIS) : null;
  const echeance = active ? new Date((depuis ? depuis.getTime() : Date.now()) + delai * JOUR) : null;
  return { active, delai, depuis, echeance };
};

// Situation d'un compte : la politique le concerne-t-elle (administrateur), et la configuration est-elle exigee
// maintenant (echeance passee) ou seulement annoncee (bandeau jusqu'a l'echeance) ?
const exigence = async (user) => {
  if (!user.is_admin) return { concerne: false, requise: false, echeance: null };
  const p = await politique();
  if (!p.active) return { concerne: false, requise: false, echeance: null };
  return { concerne: true, requise: Date.now() >= p.echeance.getTime(), echeance: p.echeance };
};
const estObligatoire = async (user) => (await exigence(user)).requise;

const chargerAvecSecrets = async (userId) => {
  const u = await Utilisateur.scope('withPassword').findOne({ where: { id: userId, del: 0 } });
  if (!u) throw { status: 404, message: 'Utilisateur introuvable.' };
  return u;
};
const verifierMotDePasse = async (u, motDePasse) => {
  if (!motDePasse || !(await bcrypt.compare(String(motDePasse), u.password))) {
    throw { status: 400, message: 'Mot de passe incorrect.' };
  }
};

// Verifie un code de connexion : code de l'application ou code de secours (consomme)
const verifierConnexion = async (u, code) => {
  if (!u.totp_secret) return { ok: false };
  if (verifierCode(dechiffrer(u.totp_secret), code, u.id)) return { ok: true, moyen: 'application' };
  const secours = normaliserCodeSecours(code);
  if (secours && u.totp_codes_secours) {
    const empreintes = JSON.parse(u.totp_codes_secours);
    for (let i = 0; i < empreintes.length; i++) {
      if (await bcrypt.compare(secours, empreintes[i])) {
        empreintes.splice(i, 1);
        await u.update({ totp_codes_secours: JSON.stringify(empreintes) });
        return { ok: true, moyen: 'secours', restants: empreintes.length };
      }
    }
  }
  return { ok: false };
};

// ── Parcours de configuration (profil)
const etat = async (user) => {
  const u = await chargerAvecSecrets(user.id);
  const ex = await exigence(u);
  return {
    active: !!u.totp_secret, active_le: u.totp_active_le,
    obligatoire: ex.concerne, echeance: ex.echeance, requise: ex.requise,
    codes_secours_restants: u.totp_codes_secours ? JSON.parse(u.totp_codes_secours).length : 0,
  };
};

const initier = async (userId, motDePasse) => {
  const u = await chargerAvecSecrets(userId);
  await verifierMotDePasse(u, motDePasse);
  const secret = base32Encoder(crypto.randomBytes(20));
  await u.update({ totp_secret_attente: chiffrer(secret) });
  const uri = `otpauth://totp/${encodeURIComponent(`${EMETTEUR}:${u.username}`)}?secret=${secret}&issuer=${encodeURIComponent(EMETTEUR)}&algorithm=SHA1&digits=${CHIFFRES}&period=${PAS}`;
  return {
    qr: await QRCode.toDataURL(uri, { margin: 1, width: 220, errorCorrectionLevel: 'M' }),
    secret: secret.match(/.{1,4}/g).join(' '),     // saisie manuelle si le QR code ne peut pas etre scanne
  };
};

const activer = async (userId, code) => {
  const u = await chargerAvecSecrets(userId);
  if (!u.totp_secret_attente) throw { status: 400, message: 'Commencez par scanner le QR code (étape 1).' };
  const secret = dechiffrer(u.totp_secret_attente);
  if (!verifierCode(secret, code, u.id)) throw { status: 400, message: 'Code incorrect. Vérifiez l\'heure du téléphone et saisissez le code affiché.' };
  const { codes, empreintes } = await genererCodesSecours();
  await u.update({ totp_secret: chiffrer(secret), totp_secret_attente: null, totp_codes_secours: empreintes, totp_active_le: new Date(), updated_by: userId, updated_at: new Date() });
  return { message: 'Double authentification activée.', codes_secours: codes };
};

const desactiver = async (userId, motDePasse, code) => {
  const u = await chargerAvecSecrets(userId);
  if ((await exigence(u)).concerne) throw { status: 403, message: 'La double authentification est obligatoire pour les administrateurs.' };
  await verifierMotDePasse(u, motDePasse);
  if (!(await verifierConnexion(u, code)).ok) throw { status: 400, message: 'Code incorrect.' };
  await u.update({ totp_secret: null, totp_secret_attente: null, totp_codes_secours: null, totp_active_le: null, updated_by: userId, updated_at: new Date() });
  return { message: 'Double authentification désactivée.' };
};

const regenererCodes = async (userId, motDePasse, code) => {
  const u = await chargerAvecSecrets(userId);
  if (!u.totp_secret) throw { status: 400, message: "La double authentification n'est pas activée." };
  await verifierMotDePasse(u, motDePasse);
  if (!verifierCode(dechiffrer(u.totp_secret), code, u.id)) throw { status: 400, message: 'Code incorrect.' };
  const { codes, empreintes } = await genererCodesSecours();
  await u.update({ totp_codes_secours: empreintes });
  return { message: 'Nouveaux codes de secours générés. Les anciens ne sont plus valables.', codes_secours: codes };
};

// Administrateur : reinitialisation pour un utilisateur ayant perdu son telephone et ses codes
const reinitialiser = async (adminId, userId) => {
  if (Number(adminId) === Number(userId)) throw { status: 400, message: 'Utilisez votre profil pour gérer votre propre double authentification.' };
  const u = await chargerAvecSecrets(userId);
  await u.update({ totp_secret: null, totp_secret_attente: null, totp_codes_secours: null, totp_active_le: null, updated_by: adminId, updated_at: new Date() });
  return { message: `Double authentification de « ${u.username} » réinitialisée : elle devra être reconfigurée à la prochaine connexion.` };
};

module.exports = {
  verifierCode, codeTotp, verifierConnexion, estObligatoire, exigence, politique, etat, initier, activer, desactiver, regenererCodes, reinitialiser,
  base32Decoder, dechiffrer,
};
