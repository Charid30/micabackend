const { RapportHebdo, VeilleGeopolitique } = require('../models');

const ZONES_DEF = [
  { zone: 'Moyen-Orient',   source: 'Reuters / Platts' },
  { zone: 'Russie / Ukraine', source: 'Reuters / Platts' },
  { zone: 'Libye',           source: 'Reuters'           },
  { zone: 'Nigéria',         source: 'Reuters'           },
  { zone: 'Mer Rouge',       source: 'Reuters'           },
];

const { getOrCreateRapportSemaine } = require('../utils/rapport.utils');

const getSaisieData = async (userId) => {
  const rapport = await getOrCreateRapportSemaine(userId);

  const rows = await VeilleGeopolitique.findAll({ where: { rapport_id: rapport.id, del: 0 } });
  const idx = {};
  rows.forEach(r => { idx[r.zone] = r; });

  return {
    rapport: {
      id: rapport.id, annee: rapport.annee, semaine_iso: rapport.semaine_iso,
      date_debut: rapport.date_debut, date_fin: rapport.date_fin, statut: rapport.statut,
    },
    zones: ZONES_DEF.map(def => {
      const row = idx[def.zone] || {};
      return {
        zone:         def.zone,
        source:       def.source,
        evenement:    row.evenement    || '',
        impact:       row.impact       || '',
        niveau_risque: row.niveau_risque || '',
      };
    }),
  };
};

const saveSaisie = async (rapportId, zonesData, userId) => {
  const rapport = await RapportHebdo.findOne({ where: { id: rapportId, del: 0 } });
  if (!rapport) throw new Error('Rapport introuvable.');
  if (rapport.statut === 'PUBLIE') throw new Error('Ce rapport est déjà publié.');

  for (const z of zonesData) {
    const niveauValide = ['FAIBLE', 'MOYEN', 'ELEVE'].includes(z.niveau_risque) ? z.niveau_risque : null;

    const [row, created] = await VeilleGeopolitique.findOrCreate({
      where: { rapport_id: rapportId, zone: z.zone, del: 0 },
      defaults: {
        evenement:     z.evenement    || '',
        impact:        z.impact       || '',
        niveau_risque: niveauValide,
        created_by:    userId,
      },
    });
    if (!created) {
      await row.update({
        evenement:     z.evenement    || '',
        impact:        z.impact       || '',
        niveau_risque: niveauValide,
        updated_by:    userId,
      });
    }
  }
  return { message: 'Veille géopolitique enregistrée avec succès.' };
};

module.exports = { getSaisieData, saveSaisie };
