const { RapportHebdo, VeilleMarche } = require('../models');

const INDICATEURS_DEF = [
  { code: 'BRENT',         libelle: 'Brent',            unite: 'USD/baril',  source: 'Platts - Crude Oil',      frequence: 'Quotidienne' },
  { code: 'DATED_BRENT',  libelle: 'Dated Brent',      unite: 'USD/baril',  source: 'Platts',                  frequence: 'Quotidienne' },
  { code: 'WTI',           libelle: 'WTI',              unite: 'USD/baril',  source: 'Platts',                  frequence: 'Quotidienne' },
  { code: 'ESSENCE_FOB',  libelle: 'Essence FOB',       unite: 'USD/tonne',  source: 'Platts Refined Products', frequence: 'Quotidienne' },
  { code: 'GASOIL_FOB',   libelle: 'Gasoil 10 ppm FOB', unite: 'USD/tonne', source: 'Platts Refined Products', frequence: 'Quotidienne' },
  { code: 'JET_A1',        libelle: 'Jet A1',           unite: 'USD/tonne',  source: 'Platts Aviation',         frequence: 'Quotidienne' },
  { code: 'FUEL_OIL',      libelle: 'Fuel Oil',         unite: 'USD/tonne',  source: 'Platts Fuel Oil',         frequence: 'Quotidienne' },
  { code: 'GPL',            libelle: 'GPL',              unite: 'USD/tonne',  source: 'Platts LPG',              frequence: 'Quotidienne' },
  { code: 'USD_FCFA',      libelle: 'USD/FCFA',         unite: 'FCFA',       source: 'BCEAO',                   frequence: 'Quotidienne' },
];

const { getOrCreateRapportSemaine } = require('../utils/rapport.utils');

const getSaisieData = async (userId) => {
  const rapport = await getOrCreateRapportSemaine(userId);

  const rows = await VeilleMarche.findAll({ where: { rapport_id: rapport.id, del: 0 } });
  const idx = {};
  rows.forEach(r => { idx[r.produit] = r; });

  return {
    rapport: {
      id: rapport.id, annee: rapport.annee, semaine_iso: rapport.semaine_iso,
      date_debut: rapport.date_debut, date_fin: rapport.date_fin, statut: rapport.statut,
    },
    indicateurs: INDICATEURS_DEF.map(ind => {
      const row = idx[ind.code] || {};
      return {
        code:            ind.code,
        libelle:         ind.libelle,
        unite:           ind.unite,
        source:          ind.source,
        frequence:       ind.frequence,
        prix_semaine_n1: row.prix_semaine_n1 != null ? parseFloat(row.prix_semaine_n1) : null,
        prix_semaine_n:  row.prix_semaine_n  != null ? parseFloat(row.prix_semaine_n)  : null,
      };
    }),
  };
};

const saveSaisie = async (rapportId, indicateurs, userId) => {
  const rapport = await RapportHebdo.findOne({ where: { id: rapportId, del: 0 } });
  if (!rapport) throw new Error('Rapport introuvable.');
  if (rapport.statut === 'PUBLIE') throw new Error('Ce rapport est déjà publié.');

  for (const ind of indicateurs) {
    const n1 = ind.prix_semaine_n1 != null ? parseFloat(ind.prix_semaine_n1) : null;
    const n  = ind.prix_semaine_n  != null ? parseFloat(ind.prix_semaine_n)  : null;

    const [row, created] = await VeilleMarche.findOrCreate({
      where: { rapport_id: rapportId, produit: ind.code, del: 0 },
      defaults: { prix_semaine_n1: n1, prix_semaine_n: n, taux_change_usd: 0, created_by: userId },
    });
    if (!created) {
      await row.update({ prix_semaine_n1: n1, prix_semaine_n: n, updated_by: userId });
    }
  }
  return { message: 'Veille marché enregistrée avec succès.' };
};

module.exports = { getSaisieData, saveSaisie };
