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
const { RapportHebdo, VeilleGeopolitique } = require('../models');

const ZONES_DEF = [
  { zone: 'Moyen-Orient',   source: 'Reuters / Platts' },
  { zone: 'Russie / Ukraine', source: 'Reuters / Platts' },
  { zone: 'Libye',           source: 'Reuters'           },
  { zone: 'Nigéria',         source: 'Reuters'           },
  { zone: 'Mer Rouge',       source: 'Reuters'           },
];

const { getOrCreateRapportSemaine } = require('../utils/rapport.utils');
const { infoSaisie, lignesSaisie, ecrireLigne, frequenceDe } = require('./frequence.service');

const getSaisieData = async (userId) => {
  const rapport = await getOrCreateRapportSemaine(userId);

  const info = await infoSaisie('veille-geo');
  const rows = lignesSaisie(await VeilleGeopolitique.findAll({ where: { rapport_id: rapport.id, del: 0 } }), info.frequence, r => r.zone);
  const idx = {};
  rows.forEach(r => { idx[r.zone] = r; });

  return {
    rapport: {
      id: rapport.id, annee: rapport.annee, semaine_iso: rapport.semaine_iso,
      date_debut: rapport.date_debut, date_fin: rapport.date_fin, statut: rapport.statut,
    },
    ...info,
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

  const frequence = await frequenceDe('veille-geo');
  for (const z of zonesData) {
    const niveauValide = ['FAIBLE', 'MOYEN', 'ELEVE'].includes(z.niveau_risque) ? z.niveau_risque : null;

    await ecrireLigne(VeilleGeopolitique, { rapport_id: rapportId, zone: z.zone }, {
      evenement:     z.evenement    || '',
      impact:        z.impact       || '',
      niveau_risque: niveauValide,
    }, frequence, userId);
  }
  return { message: 'Veille géopolitique enregistrée avec succès.' };
};

module.exports = { getSaisieData, saveSaisie };
