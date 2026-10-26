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
// Securite des comptes : politique d'expiration du mot de passe et historique des connexions.
const { Op } = require('sequelize');
const { Parametre, ConnexionUtilisateur } = require('../models');

const JOUR = 86400000;
const CONSERVATION_JOURS = 180;          // historique des connexions conserve 6 mois
const DUREE_CACHE_MS = 60000;            // la politique est relue au plus une fois par minute

let cache = null;
let cacheAt = 0;

// Politique de mot de passe (parametres MOT_DE_PASSE_DUREE_JOURS et MOT_DE_PASSE_RAPPEL_JOURS)
const chargerPolitique = async () => {
  if (cache && Date.now() - cacheAt < DUREE_CACHE_MS) return cache;
  const rows = await Parametre.findAll({ where: { cle: ['MOT_DE_PASSE_DUREE_JOURS', 'MOT_DE_PASSE_RAPPEL_JOURS'], del: 0 } });
  const v = Object.fromEntries(rows.map(r => [r.cle, parseInt(r.valeur, 10)]));
  cache = {
    duree: Number.isFinite(v.MOT_DE_PASSE_DUREE_JOURS) && v.MOT_DE_PASSE_DUREE_JOURS >= 0 ? v.MOT_DE_PASSE_DUREE_JOURS : 90,
    rappel: Number.isFinite(v.MOT_DE_PASSE_RAPPEL_JOURS) && v.MOT_DE_PASSE_RAPPEL_JOURS >= 0 ? v.MOT_DE_PASSE_RAPPEL_JOURS : 7,
  };
  cacheAt = Date.now();
  return cache;
};

// Etat du mot de passe d'un compte : date de changement, date d'expiration, jours restants, rappel
const etatMotDePasse = (user, politique) => {
  // Sans date de changement (compte cree sans changement impose) : la validite part de la creation du compte
  const base = user.password_changed_at || user.created_at;
  const changeLe = base ? new Date(base) : null;
  if (!politique.duree || !changeLe) {
    return { change_le: changeLe, expire_le: null, jours_restants: null, expire: false, rappel: false, duree_jours: politique.duree };
  }
  const expireLe = new Date(changeLe.getTime() + politique.duree * JOUR);
  const joursRestants = Math.ceil((expireLe.getTime() - Date.now()) / JOUR);
  return {
    change_le: changeLe, expire_le: expireLe, jours_restants: Math.max(joursRestants, 0),
    expire: Date.now() >= expireLe.getTime(),
    rappel: joursRestants > 0 && joursRestants <= politique.rappel,
    duree_jours: politique.duree,
  };
};

// Contexte d'une requete de connexion (adresse IP derriere le proxy Apache, navigateur)
const contexteRequete = (req) => ({
  ip: String(req.ip || '').replace(/^::ffff:/, '').slice(0, 45) || null,
  navigateur: String(req.get('User-Agent') || '').slice(0, 255) || null,
});

// Enregistre une tentative de connexion ; un echec d'ecriture ne bloque jamais la connexion
const journaliserConnexion = async (utilisateurId, succes, motif, ctx = {}) => {
  try {
    await ConnexionUtilisateur.create({ utilisateur_id: utilisateurId, succes: succes ? 1 : 0, motif, ip: ctx.ip, navigateur: ctx.navigateur });
    if (succes) {
      await ConnexionUtilisateur.destroy({ where: { utilisateur_id: utilisateurId, created_at: { [Op.lt]: new Date(Date.now() - CONSERVATION_JOURS * JOUR) } } });
    }
  } catch (err) {
    console.error('[Connexions] Journalisation impossible :', err.message);
  }
};

// Libelle lisible du navigateur a partir de l'en-tete User-Agent
const libelleNavigateur = (ua) => {
  if (!ua) return 'Inconnu';
  const nav = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox'
    : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Autre navigateur';
  const os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /(iPhone|iPad)/.test(ua) ? 'iOS'
    : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '';
  return os ? `${nav} – ${os}` : nav;
};

const viderCache = () => { cache = null; };

module.exports = { viderCache, chargerPolitique, etatMotDePasse, contexteRequete, journaliserConnexion, libelleNavigateur };
