const { RapportHebdo, ChargementCorridor, Corridor, Produit } = require('../models');
const { getOrCreateRapportSemaine } = require('../utils/rapport.utils');

const getSaisieData = async (userId) => {
  const rapport  = await getOrCreateRapportSemaine(userId);
  const PRODUIT_ORDER = ['SP', 'PL', 'GO', 'DDO', 'JA1', 'GAZ', 'FO'];
  const corridors = await Corridor.findAll({ where: { del: 0 }, order: [['id', 'ASC']] });
  const produitsRaw = await Produit.findAll({ where: { del: 0 } });
  const produits = produitsRaw.sort((a, b) => {
    const ia = PRODUIT_ORDER.indexOf(a.code);
    const ib = PRODUIT_ORDER.indexOf(b.code);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  const chargements = await ChargementCorridor.findAll({ where: { rapport_id: rapport.id, del: 0 } });
  const idx = {};
  chargements.forEach(c => { idx[`${c.corridor_id}_${c.produit_id}`] = c; });

  return {
    rapport: {
      id: rapport.id, annee: rapport.annee, semaine_iso: rapport.semaine_iso,
      date_debut: rapport.date_debut, date_fin: rapport.date_fin, statut: rapport.statut,
    },
    corridors: corridors.map(cor => ({
      corridor_id:      cor.id,
      corridor_code:    cor.code,
      corridor_libelle: cor.libelle,
      lignes: produits.map(p => {
        const key = `${cor.id}_${p.id}`;
        const row = idx[key] || {};
        return {
          produit_id:        p.id,
          produit_code:      p.code,
          produit_libelle:   p.libelle,
          camions_en_attente: parseInt(row.camions_en_attente) || 0,
          camions_charges:    parseInt(row.camions_charges)    || 0,
          bons_emis:          parseInt(row.bons_emis)          || 0,
          objectif_journalier: parseInt(row.objectif_journalier) || 0,
        };
      }),
    })),
  };
};

const saveSaisie = async (rapportId, corridorsData, userId) => {
  const rapport = await RapportHebdo.findOne({ where: { id: rapportId, del: 0 } });
  if (!rapport) throw new Error('Rapport introuvable.');
  if (rapport.statut === 'PUBLIE') throw new Error('Ce rapport est déjà publié.');

  for (const corridor of corridorsData) {
    for (const ligne of corridor.lignes) {
      const enAttente  = parseInt(ligne.camions_en_attente)  || 0;
      const charges    = parseInt(ligne.camions_charges)      || 0;
      const bonsEmis   = parseInt(ligne.bons_emis)            || 0;
      const objectif   = parseInt(ligne.objectif_journalier)  || 0;

      const [row, created] = await ChargementCorridor.findOrCreate({
        where: { rapport_id: rapportId, corridor_id: corridor.corridor_id, produit_id: ligne.produit_id, del: 0 },
        defaults: { camions_en_attente: enAttente, camions_charges: charges, bons_emis: bonsEmis, objectif_journalier: objectif, created_by: userId },
      });
      if (!created) {
        await row.update({ camions_en_attente: enAttente, camions_charges: charges, bons_emis: bonsEmis, objectif_journalier: objectif, updated_by: userId });
      }
    }
  }
  return { message: 'Saisie corridors enregistrée avec succès.' };
};

module.exports = { getSaisieData, saveSaisie };
