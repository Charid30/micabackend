const { RapportHebdo, ChargementCorridor, Corridor, Produit } = require('../models');
const { getOrCreateRapportSemaine } = require('../utils/rapport.utils');

const PRODUIT_ORDER = ['SUPER91', 'PETROLE', 'GASOIL', 'DDO', 'JET_A1', 'GAZ', 'FUEL_OIL'];

const getSaisieData = async (userId) => {
  const rapport = await getOrCreateRapportSemaine(userId);
  const today   = new Date().toISOString().split('T')[0];

  const corridors   = await Corridor.findAll({ where: { del: 0 }, order: [['id', 'ASC']] });
  const produitsRaw = await Produit.findAll({ where: { del: 0 } });
  const produits    = produitsRaw.sort((a, b) => {
    const ia = PRODUIT_ORDER.indexOf(a.code);
    const ib = PRODUIT_ORDER.indexOf(b.code);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  // Données du jour uniquement
  const chargements = await ChargementCorridor.findAll({
    where: { rapport_id: rapport.id, date_saisie: today, del: 0 },
  });
  const idx = {};
  chargements.forEach(c => { idx[`${c.corridor_id}_${c.produit_id}`] = c; });

  return {
    rapport: {
      id: rapport.id, annee: rapport.annee, semaine_iso: rapport.semaine_iso,
      date_debut: rapport.date_debut, date_fin: rapport.date_fin, statut: rapport.statut,
    },
    date_saisie: today,
    corridors: corridors.map(cor => ({
      corridor_id:      cor.id,
      corridor_code:    cor.code,
      corridor_libelle: cor.libelle,
      lignes: produits.map(p => {
        const key = `${cor.id}_${p.id}`;
        const row = idx[key] || {};
        return {
          produit_id:          p.id,
          produit_code:        p.code,
          produit_libelle:     p.libelle,
          camions_en_attente:  parseInt(row.camions_en_attente) || 0,
          camions_charges:     parseInt(row.camions_charges)    || 0,
          bons_emis:           parseInt(row.bons_emis)          || 0,
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

  const today = new Date().toISOString().split('T')[0];

  for (const corridor of corridorsData) {
    for (const ligne of corridor.lignes) {
      const enAttente = parseInt(ligne.camions_en_attente)   || 0;
      const charges   = parseInt(ligne.camions_charges)       || 0;
      const bonsEmis  = parseInt(ligne.bons_emis)             || 0;
      const objectif  = parseInt(ligne.objectif_journalier)   || 0;

      const row = await ChargementCorridor.findOne({
        where: { rapport_id: rapportId, corridor_id: corridor.corridor_id, produit_id: ligne.produit_id, date_saisie: today, del: 0 },
      });
      if (row) {
        await row.update({ camions_en_attente: enAttente, camions_charges: charges, bons_emis: bonsEmis, objectif_journalier: objectif, updated_by: userId });
      } else {
        await ChargementCorridor.create({
          rapport_id: rapportId, corridor_id: corridor.corridor_id, produit_id: ligne.produit_id,
          date_saisie: today, camions_en_attente: enAttente, camions_charges: charges,
          bons_emis: bonsEmis, objectif_journalier: objectif, del: 0, created_by: userId,
        });
      }
    }
  }
  return { message: 'Saisie corridors enregistrée avec succès.' };
};

module.exports = { getSaisieData, saveSaisie };
