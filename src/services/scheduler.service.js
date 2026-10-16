/* ==================================================================
 *  Auteur : BATIONO Ulrich Rachid Kévin
 *           Expert en Sécurité Informatique
 *           Développeur FullStack
 *           Tel: +226 51 57 82 89 // 66 72 02 32
 *           Whatsapp: +226 51 57 82 89
 *           Mail: bkevin@sonabhy.bf // bationor10@gmail.com
 *  Projet : MICA – SONABHY
 * ================================================================== */
// Publication automatique du rapport hebdomadaire (expression cron stockee dans la table parametres,
// cle PUBLICATION_CRON). L'appel cron.schedule(expression, fonction, { timezone }) est compatible
// avec node-cron 3 et 4 : ne pas utiliser l'option "scheduled", supprimee dans la version 4.
const cron = require('node-cron');
const { RapportHebdo, Parametre } = require('../models');
const { Op } = require('sequelize');

let schedulerTask = null;

// Heure de publication lue dans l'expression cron (« s m h ... » ou « m h ... ») ; 06:00 par defaut
const heurePublication = (expression) => {
  const champs = String(expression).trim().split(/\s+/);
  const [m, h] = champs.length >= 6 ? [champs[1], champs[2]] : [champs[0], champs[1]];
  const num = (v, def) => (/^\d+$/.test(v) ? Number(v) : def);
  return { heure: num(h, 6), minute: num(m, 0) };
};

/**
 * Publie tous les rapports BROUILLON dont l'heure de publication est passee (du plus ancien au plus recent).
 * Un cycle se termine le jeudi ; il est publie le vendredi a l'heure du planificateur.
 * Appelee par le planificateur et au demarrage du serveur : un vendredi manque (serveur arrete,
 * redemarrage) est rattrape des que l'API repart, au lieu de laisser le rapport en brouillon.
 */
const publierRapportSemaine = async () => {
  try {
    const maintenant = new Date();
    const aujourdhui = maintenant.toISOString().split('T')[0];      // Ouagadougou = UTC+0
    const hier = new Date(maintenant.getTime() - 86400000).toISOString().split('T')[0];
    const { heure, minute } = heurePublication(await getCronExpression());
    const heureAtteinte = maintenant.getUTCHours() * 60 + maintenant.getUTCMinutes() >= heure * 60 + minute;

    const rapports = await RapportHebdo.findAll({
      where: { statut: 'BROUILLON', date_fin: { [Op.lt]: aujourdhui }, del: 0 },
      order: [['date_fin', 'ASC']],
    });
    // Le cycle termine hier n'est publie qu'a partir de l'heure prevue
    const aPublier = rapports.filter(r => r.date_fin !== hier || heureAtteinte);

    if (!aPublier.length) {
      console.log(`[Scheduler] Aucun rapport à publier pour ${maintenant.toISOString()}`);
      return [];
    }
    for (const rapport of aPublier) {
      await rapport.update({ statut: 'PUBLIE', date_publication: maintenant, updated_at: maintenant });
      console.log(`[Scheduler] Rapport semaine ${rapport.semaine_iso}/${rapport.annee} (au ${rapport.date_fin}) publié.`);
    }
    return aPublier;
  } catch (err) {
    console.error('[Scheduler] Erreur lors de la publication :', err.message);
    return [];
  }
};

const getCronExpression = async () => {
  const param = await Parametre.findOne({ where: { cle: 'PUBLICATION_CRON', del: 0 } });
  return param?.valeur || process.env.PUBLICATION_CRON || '0 0 6 * * 5';
};

const startScheduler = async () => {
  const expression = await getCronExpression();

  if (schedulerTask) {
    schedulerTask.stop();
  }

  schedulerTask = cron.schedule(expression, publierRapportSemaine, {
    timezone: 'Africa/Ouagadougou',
  });

  console.log(`[Scheduler] Démarré avec l'expression : ${expression}`);
  // Rattrapage : publications manquees pendant que le serveur etait arrete
  await publierRapportSemaine();
};

const restartScheduler = async () => {
  console.log('[Scheduler] Redémarrage...');
  await startScheduler();
};

module.exports = { startScheduler, restartScheduler, publierRapportSemaine };
