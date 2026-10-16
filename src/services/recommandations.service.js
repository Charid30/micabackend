/* ==================================================================
 *  Auteur : BATIONO Ulrich Rachid Kévin
 *           Expert en Sécurité Informatique
 *           Développeur FullStack
 *           Tel: +226 51 57 82 89 // 66 72 02 32
 *           Whatsapp: +226 51 57 82 89
 *           Mail: bkevin@sonabhy.bf // bationor10@gmail.com
 *  Projet : MICA – SONABHY
 * ================================================================== */
const { Op } = require('sequelize');
const { RapportHebdo, Recommandation } = require('../models');

// « Informations utiles » du rapport : changent rarement, donc reprises du dernier rapport qui en contient
// tant qu'elles n'ont pas ete modifiees pour la semaine.
const informationsUtiles = async (rapport, row) => {
  if (row?.informations_utiles) return { texte: row.informations_utiles, reprise: null };
  const precedents = await RapportHebdo.findAll({
    where: { del: 0, date_fin: { [Op.lt]: rapport.date_fin } }, order: [['date_fin', 'DESC']], limit: 52,
    attributes: ['id', 'semaine_iso', 'annee'],
  });
  if (!precedents.length) return { texte: '', reprise: null };
  const lignes = await Recommandation.findAll({
    where: { del: 0, rapport_id: precedents.map(r => r.id), informations_utiles: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }] } },
  });
  for (const r of precedents) {
    const l = lignes.find(x => x.rapport_id === r.id);
    if (l) return { texte: l.informations_utiles, reprise: { semaine_iso: r.semaine_iso, annee: r.annee } };
  }
  return { texte: '', reprise: null };
};

const { getOrCreateRapportSemaine } = require('../utils/rapport.utils');

const getSaisieData = async (userId) => {
  const rapport = await getOrCreateRapportSemaine(userId);
  const row = await Recommandation.findOne({ where: { rapport_id: rapport.id, del: 0 } });
  const infos = await informationsUtiles(rapport, row);
  return {
    rapport: {
      id: rapport.id, annee: rapport.annee, semaine_iso: rapport.semaine_iso,
      date_debut: rapport.date_debut, date_fin: rapport.date_fin, statut: rapport.statut,
    },
    informations_utiles: infos.texte,
    informations_reprises_de: infos.reprise,
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
      informations_utiles: data.informations_utiles || '',
      tendance_generale: data.tendance_generale || '',
      risques_majeurs:   data.risques_majeurs   || '',
      impact_sonabhy:    data.impact_sonabhy    || '',
      recommandations:   data.recommandations   || '',
      created_by: userId,
    },
  });
  if (!created) {
    await row.update({
      informations_utiles: data.informations_utiles || '',
      tendance_generale: data.tendance_generale || '',
      risques_majeurs:   data.risques_majeurs   || '',
      impact_sonabhy:    data.impact_sonabhy    || '',
      recommandations:   data.recommandations   || '',
      updated_by: userId,
    });
  }
  return { message: 'Recommandations enregistrées avec succès.' };
};

module.exports = { getSaisieData, saveSaisie, informationsUtiles };
