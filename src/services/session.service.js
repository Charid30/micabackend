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
// Sessions cote serveur : identifiant aleatoire porte par le jeton, verifie a chaque requete.
//  - deconnexion : la session est revoquee, le jeton ne sert plus meme s'il a ete copie ;
//  - inactivite : sans requete pendant SESSION_INACTIVITE_MINUTES, la session est fermee ;
//  - changement de mot de passe : toutes les sessions du compte sont fermees.
// Le flux temps reel (/api/evenements) et les relectures automatiques ne comptent pas comme activite.
const crypto = require('crypto');
const { Op } = require('sequelize');
const { Session, Parametre } = require('../models');

const DEFAUT_MINUTES = 30;
const MAJ_ACTIVITE_MS = 60 * 1000;          // derniere activite ecrite au plus une fois par minute
const CONSERVATION_JOURS = 30;
const SANS_ACTIVITE = ['/api/evenements'];

let cache = { minutes: DEFAUT_MINUTES, le: 0 };
const minutesInactivite = async () => {
  if (Date.now() - cache.le < 60000) return cache.minutes;
  const p = await Parametre.findOne({ where: { cle: 'SESSION_INACTIVITE_MINUTES', del: 0 } }).catch(() => null);
  const n = parseInt(p?.valeur, 10);
  cache = { minutes: n >= 5 && n <= 480 ? n : DEFAUT_MINUTES, le: Date.now() };
  return cache.minutes;
};

/** Nouvelle session a la connexion ; les sessions terminees depuis longtemps sont purgees */
const ouvrir = async (utilisateurId, ip = null) => {
  const sid = crypto.randomBytes(16).toString('hex');
  await Session.create({ sid, utilisateur_id: utilisateurId, ip: ip ? String(ip).replace(/^::ffff:/, '').slice(0, 45) : null });
  const limite = new Date(Date.now() - CONSERVATION_JOURS * 86400000);
  Session.destroy({ where: { utilisateur_id: utilisateurId, derniere_activite: { [Op.lt]: limite } } }).catch(() => {});
  return sid;
};

const fermer = (where, motif) => Session.update({ revoquee_le: new Date(), motif_fin: motif }, { where: { ...where, revoquee_le: null } });

/**
 * Session valide pour cette requete : null si elle est inconnue, revoquee ou inactive.
 * code : SESSION_INACTIVE (fermee pour inactivite) ou SESSION_FERMEE (deconnexion, nouveau mot de passe...).
 */
const verifier = async (sid, utilisateurId, chemin) => {
  if (!sid) return { code: 'SESSION_FERMEE' };
  const s = await Session.findOne({ where: { sid, utilisateur_id: utilisateurId } });
  if (!s || s.revoquee_le) return { code: s?.motif_fin === 'INACTIVITE' ? 'SESSION_INACTIVE' : 'SESSION_FERMEE' };
  const minutes = await minutesInactivite();
  const inactifMs = Date.now() - new Date(s.derniere_activite).getTime();
  if (inactifMs > minutes * 60000) {
    await fermer({ id: s.id }, 'INACTIVITE');
    return { code: 'SESSION_INACTIVE', minutes };
  }
  if (inactifMs > MAJ_ACTIVITE_MS && !SANS_ACTIVITE.includes(chemin)) {
    s.update({ derniere_activite: new Date() }).catch(() => {});
  }
  return { ok: true, minutes };
};

const revoquer = (sid) => (sid ? fermer({ sid }, 'DECONNEXION') : Promise.resolve());
const revoquerToutes = (utilisateurId, motif = 'MOT_DE_PASSE') => fermer({ utilisateur_id: utilisateurId }, motif);

module.exports = { ouvrir, verifier, revoquer, revoquerToutes, minutesInactivite };
