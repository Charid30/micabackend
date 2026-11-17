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
//  - changement de mot de passe : toutes les sessions du compte sont fermees ;
//  - fermeture a distance : l'utilisateur (Mon profil) ou un administrateur ferme une session precise ou
//    toutes les autres ; le flux temps reel de ces sessions est coupe aussitot.
// Le flux temps reel (/api/evenements) et les relectures automatiques ne comptent pas comme activite.
const crypto = require('crypto');
const { Op } = require('sequelize');
const { Session, Parametre, Utilisateur, Agent } = require('../models');
const jwtConfig = require('../config/jwt');

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
const ouvrir = async (utilisateurId, ip = null, navigateur = null) => {
  const sid = crypto.randomBytes(16).toString('hex');
  await Session.create({
    sid, utilisateur_id: utilisateurId, ip: ip ? String(ip).replace(/^::ffff:/, '').slice(0, 45) : null,
    navigateur: navigateur ? String(navigateur).slice(0, 255) : null,
  });
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
  if (!s || s.revoquee_le) {
    return { code: s?.motif_fin === 'INACTIVITE' ? 'SESSION_INACTIVE' : ['REVOQUEE', 'ADMINISTRATEUR'].includes(s?.motif_fin) ? 'SESSION_REVOQUEE' : 'SESSION_FERMEE' };
  }
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

// ── Sessions actives (Mon profil, Etat du systeme)
// Active : non fermee, utilisee recemment (delai d'inactivite) et ouverte depuis moins que la duree du jeton.
const dureeJetonMs = () => {
  const m = /^(\d+)\s*([smhd])$/.exec(String(jwtConfig.expiresIn || '8h'));
  return m ? Number(m[1]) * { s: 1e3, m: 6e4, h: 36e5, d: 864e5 }[m[2]] : 8 * 36e5;
};
const conditionActive = async () => ({
  revoquee_le: null,
  derniere_activite: { [Op.gt]: new Date(Date.now() - (await minutesInactivite()) * 60000) },
  cree_le: { [Op.gt]: new Date(Date.now() - dureeJetonMs()) },
});

const appareil = (ua) => {
  if (!ua) return 'Appareil inconnu';
  return require('./securite-compte.service').libelleNavigateur(ua);
};

const presenter = (s, sidCourant = null) => ({
  id: s.id, appareil: appareil(s.navigateur), ip: s.ip, ouverte_le: s.cree_le, derniere_activite: s.derniere_activite,
  courante: !!sidCourant && s.sid === sidCourant,
});

/** Sessions actives d'un compte, la session courante en premier */
const lister = async (utilisateurId, sidCourant) => {
  const rows = await Session.findAll({ where: { utilisateur_id: utilisateurId, ...(await conditionActive()) }, order: [['derniere_activite', 'DESC']] });
  return rows.map((s) => presenter(s, sidCourant)).sort((a, b) => Number(b.courante) - Number(a.courante));
};

const couperFlux = (sids) => { if (sids.length) require('./temps-reel.service').fermer({ sids }); };

/** Ferme une session du compte (jamais la session courante : il y a « Se deconnecter » pour cela) */
const fermerUne = async (utilisateurId, id, sidCourant) => {
  const s = await Session.findOne({ where: { id, utilisateur_id: utilisateurId } });
  if (!s) throw { status: 404, message: 'Session introuvable.' };
  if (s.sid === sidCourant) throw { status: 400, message: 'Pour fermer cette session, utilisez « Se déconnecter ».' };
  if (!s.revoquee_le) await fermer({ id: s.id }, 'REVOQUEE');
  couperFlux([s.sid]);
  return { message: `Session fermée (${appareil(s.navigateur)}).` };
};

/** Ferme toutes les sessions du compte sauf la session courante */
const fermerAutres = async (utilisateurId, sidCourant) => {
  const rows = await Session.findAll({ where: { utilisateur_id: utilisateurId, revoquee_le: null, sid: { [Op.ne]: sidCourant || '' } } });
  if (rows.length) await fermer({ id: rows.map((s) => s.id) }, 'REVOQUEE');
  couperFlux(rows.map((s) => s.sid));
  const n = rows.filter((s) => s.derniere_activite > new Date(Date.now() - dureeJetonMs())).length;
  return { message: n ? `${n} autre${n > 1 ? 's' : ''} session${n > 1 ? 's' : ''} fermée${n > 1 ? 's' : ''}.` : 'Aucune autre session ouverte.', fermees: n };
};

/** Administration : toutes les sessions actives, avec le compte */
const listerToutes = async (sidCourant) => {
  const rows = await Session.findAll({
    where: await conditionActive(), order: [['derniere_activite', 'DESC']],
    include: [{ model: Utilisateur, as: 'utilisateur', attributes: ['id', 'username', 'is_admin'], include: [{ model: Agent, as: 'agent', attributes: ['nom', 'prenoms'] }] }],
  });
  return rows.map((s) => ({
    ...presenter(s, sidCourant),
    utilisateur_id: s.utilisateur_id, username: s.utilisateur?.username || null, is_admin: !!s.utilisateur?.is_admin,
    nom: s.utilisateur?.agent ? [s.utilisateur.agent.prenoms, s.utilisateur.agent.nom].filter(Boolean).join(' ') : null,
  }));
};

/** Administration : ferme une session de n'importe quel compte (pas la sienne) */
const fermerParAdministrateur = async (id, sidCourant) => {
  const s = await Session.findByPk(id);
  if (!s) throw { status: 404, message: 'Session introuvable.' };
  if (s.sid === sidCourant) throw { status: 400, message: 'Pour fermer votre propre session, utilisez « Se déconnecter ».' };
  if (!s.revoquee_le) await fermer({ id: s.id }, 'ADMINISTRATEUR');
  couperFlux([s.sid]);
  return { message: "Session fermée : l'utilisateur devra se reconnecter sur cet appareil." };
};

module.exports = {
  ouvrir, verifier, revoquer, revoquerToutes, minutesInactivite,
  lister, fermerUne, fermerAutres, listerToutes, fermerParAdministrateur, appareil,
};
