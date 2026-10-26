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
// Reglages de securite (Parametres > Securite, administrateurs uniquement) :
// double authentification des administrateurs (option + delai de grace) et validite des mots de passe.
const { Parametre, Utilisateur } = require('../models');
const { politique } = require('./double-auth.service');
const { viderCache, chargerPolitique } = require('./securite-compte.service');

// Cles reservees : modifiables uniquement par cette page (jamais par la route generique des parametres)
const CLES_SECURITE = ['DOUBLE_AUTH_ADMIN_OBLIGATOIRE', 'DOUBLE_AUTH_DELAI_JOURS', 'DOUBLE_AUTH_OBLIGATOIRE_DEPUIS',
  'MOT_DE_PASSE_DUREE_JOURS', 'MOT_DE_PASSE_RAPPEL_JOURS'];

const ecrireParam = async (cle, valeur, userId) => {
  const p = await Parametre.findOne({ where: { cle } });
  if (p) await p.update({ valeur: String(valeur), updated_by: userId, updated_at: new Date() });
  else await Parametre.create({ cle, valeur: String(valeur), created_by: userId });
};

const getReglages = async () => {
  const [p2fa, pmdp, admins] = await Promise.all([
    politique(), chargerPolitique(),
    Utilisateur.findAll({ where: { is_admin: 1, del: 0 }, attributes: ['id', 'username', 'totp_active_le'], order: [['username', 'ASC']] }),
  ]);
  return {
    double_auth: {
      obligatoire: p2fa.active, delai_jours: p2fa.delai, depuis: p2fa.depuis, echeance: p2fa.echeance,
      administrateurs: admins.map(a => ({ username: a.username, configuree: !!a.totp_active_le })),
    },
    mot_de_passe: { duree_jours: pmdp.duree, rappel_jours: pmdp.rappel },
  };
};

const saveReglages = async (body, userId) => {
  const avant = await politique();
  const obligatoire = [true, 'true', 1, '1'].includes(body.double_auth_obligatoire);
  await ecrireParam('DOUBLE_AUTH_ADMIN_OBLIGATOIRE', obligatoire ? '1' : '0', userId);
  await ecrireParam('DOUBLE_AUTH_DELAI_JOURS', body.double_auth_delai_jours, userId);
  // Le delai de grace part du jour ou l'obligation est activee ; il est efface quand elle est retiree
  if (obligatoire && !avant.active) await ecrireParam('DOUBLE_AUTH_OBLIGATOIRE_DEPUIS', new Date().toISOString(), userId);
  if (!obligatoire) await ecrireParam('DOUBLE_AUTH_OBLIGATOIRE_DEPUIS', '', userId);
  await ecrireParam('MOT_DE_PASSE_DUREE_JOURS', body.mot_de_passe_duree_jours, userId);
  await ecrireParam('MOT_DE_PASSE_RAPPEL_JOURS', body.mot_de_passe_rappel_jours, userId);
  viderCache();
  const r = await getReglages();
  const message = obligatoire && !avant.active
    ? `Double authentification obligatoire pour les administrateurs à partir du ${r.double_auth.echeance.toLocaleDateString('fr-FR')}.`
    : 'Réglages de sécurité enregistrés.';
  return { message, ...r };
};

module.exports = { getReglages, saveReglages, CLES_SECURITE };
