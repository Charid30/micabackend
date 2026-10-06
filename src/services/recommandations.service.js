const { RapportHebdo, Recommandation } = require('../models');
const { getOrCreateRapportSemaine } = require('../utils/rapport.utils');

const getSaisieData = async (userId) => {
  const rapport = await getOrCreateRapportSemaine(userId);
  const row = await Recommandation.findOne({ where: { rapport_id: rapport.id, del: 0 } });
  return {
    rapport: {
      id: rapport.id, annee: rapport.annee, semaine_iso: rapport.semaine_iso,
      date_debut: rapport.date_debut, date_fin: rapport.date_fin, statut: rapport.statut,
    },
    tendance_generale: row?.tendance_generale || '',
    risques_majeurs:   row?.risques_majeurs   || '',
    impact_sonabhy:    row?.impact_sonabhy    || '',
    recommandations:   row?.recommandations   || '',
  };
};

const saveSaisie = async (rapportId, data, userId) => {
  const rapport = await RapportHebdo.findOne({ where: { id: rapportId, del: 0 } });
  if (!rapport) throw new Error('Rapport introuvable.');
  if (rapport.statut === 'PUBLIE') throw new Error('Ce rapport est déjà publié.');

  const [row, created] = await Recommandation.findOrCreate({
    where: { rapport_id: rapportId, del: 0 },
    defaults: {
      tendance_generale: data.tendance_generale || '',
      risques_majeurs:   data.risques_majeurs   || '',
      impact_sonabhy:    data.impact_sonabhy    || '',
      recommandations:   data.recommandations   || '',
      created_by: userId,
    },
  });
  if (!created) {
    await row.update({
      tendance_generale: data.tendance_generale || '',
      risques_majeurs:   data.risques_majeurs   || '',
      impact_sonabhy:    data.impact_sonabhy    || '',
      recommandations:   data.recommandations   || '',
      updated_by: userId,
    });
  }
  return { message: 'Recommandations enregistrées avec succès.' };
};

module.exports = { getSaisieData, saveSaisie };
