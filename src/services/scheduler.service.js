const cron = require('node-cron');
const { RapportHebdo, Parametre } = require('../models');
const { Op } = require('sequelize');

let schedulerTask = null;

const publierRapportSemaine = async () => {
  try {
    const maintenant = new Date();
    // Trouver le rapport de la semaine courante en BROUILLON
    const rapport = await RapportHebdo.findOne({
      where: {
        statut: 'BROUILLON',
        date_fin: { [Op.lte]: maintenant },
        del: 0,
      },
      order: [['date_fin', 'DESC']],
    });

    if (!rapport) {
      console.log(`[Scheduler] Aucun rapport à publier pour ${maintenant.toISOString()}`);
      return;
    }

    await rapport.update({
      statut: 'PUBLIE',
      date_publication: maintenant,
      updated_at: maintenant,
    });

    console.log(`[Scheduler] Rapport semaine ${rapport.semaine_iso}/${rapport.annee} publié.`);
  } catch (err) {
    console.error('[Scheduler] Erreur lors de la publication :', err.message);
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
};

const restartScheduler = async () => {
  console.log('[Scheduler] Redémarrage...');
  await startScheduler();
};

module.exports = { startScheduler, restartScheduler, publierRapportSemaine };
