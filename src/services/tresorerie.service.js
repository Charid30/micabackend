const { RapportHebdo, TresorerieSemaine } = require('../models');
const { getOrCreateRapportSemaine } = require('../utils/rapport.utils');

const LIGNES_DEF = [
  { code: 'AVOIRS_BANQUES',       libelle: 'Avoirs en banques',                                      signe:  1 },
  { code: 'CREANCES_ETAT',        libelle: "Sommes dues par l'État (créances État)",                 signe:  1 },
  { code: 'CREANCES_CLIENTS',     libelle: 'Sommes dues par les clients (créances clients)',          signe:  1 },
  { code: 'VALORISATION_STOCKS',  libelle: 'Valorisation des stocks (extérieur et intérieur)',       signe:  1 },
  { code: 'DETTES_BANQUES',       libelle: 'Dettes envers les banques',                              signe: -1 },
  { code: 'DETTES_FOURNISSEURS',  libelle: "Dettes envers les fournisseurs d'hydrocarbures et divers", signe: -1 },
  { code: 'DETTES_ETAT',          libelle: "Dettes envers l'État",                                   signe: -1 },
];

const TENDANCES = { positif: '▲ Hausse', negatif: '▼ Baisse', stable: '→ Stable' };

function tendance(n1, n, signe) {
  if (n1 == null || n == null) return null;
  const diff = n - n1;
  if (Math.abs(diff) < 0.01) return TENDANCES.stable;
  const hausse = diff > 0;
  // pour les lignes négatives (dettes), une hausse de la valeur absolue est mauvais signe
  return hausse ? TENDANCES.positif : TENDANCES.negatif;
}

function variation(n1, n) {
  if (n1 == null || n == null || n1 === 0) return null;
  return (n - n1) / Math.abs(n1);
}

const getSaisieData = async (userId) => {
  const rapport = await getOrCreateRapportSemaine(userId);
  const rows = await TresorerieSemaine.findAll({ where: { rapport_id: rapport.id, del: 0 } });
  const idx = {};
  rows.forEach(r => { idx[r.code] = r; });

  const lignes = LIGNES_DEF.map(def => {
    const row = idx[def.code] || {};
    const n1 = row.montant_n1 != null ? parseFloat(row.montant_n1) : null;
    const n  = row.montant_n  != null ? parseFloat(row.montant_n)  : null;
    return {
      code:      def.code,
      libelle:   def.libelle,
      signe:     def.signe,
      montant_n1: n1,
      montant_n:  n,
      variation:  variation(n1, n),
      tendance:   tendance(n1, n, def.signe),
    };
  });

  // Ligne simulée (calculée)
  const sumN1 = lignes.reduce((s, l) => s + (l.montant_n1 != null ? l.signe * l.montant_n1 : 0), 0);
  const sumN  = lignes.reduce((s, l) => s + (l.montant_n  != null ? l.signe * l.montant_n  : 0), 0);
  lignes.push({
    code: 'SITUATION_SIMULEE', libelle: 'Situation de trésorerie simulée', signe: 1,
    montant_n1: sumN1 || null, montant_n: sumN || null,
    variation: variation(sumN1, sumN),
    tendance:  tendance(sumN1, sumN, 1),
    calculee:  true,
  });

  return {
    rapport: {
      id: rapport.id, annee: rapport.annee, semaine_iso: rapport.semaine_iso,
      date_debut: rapport.date_debut, date_fin: rapport.date_fin, statut: rapport.statut,
    },
    lignes,
  };
};

const saveSaisie = async (rapportId, lignes, userId) => {
  const rapport = await RapportHebdo.findOne({ where: { id: rapportId, del: 0 } });
  if (!rapport) throw new Error('Rapport introuvable.');
  if (rapport.statut === 'PUBLIE') throw new Error('Ce rapport est déjà publié.');

  for (const l of lignes) {
    if (l.calculee) continue;
    const n1 = l.montant_n1 != null ? parseFloat(l.montant_n1) : null;
    const n  = l.montant_n  != null ? parseFloat(l.montant_n)  : null;
    const [row, created] = await TresorerieSemaine.findOrCreate({
      where: { rapport_id: rapportId, code: l.code, del: 0 },
      defaults: { montant_n1: n1, montant_n: n, created_by: userId },
    });
    if (!created) await row.update({ montant_n1: n1, montant_n: n, updated_by: userId });
  }
  return { message: 'Trésorerie enregistrée avec succès.' };
};

module.exports = { getSaisieData, saveSaisie, LIGNES_DEF };
