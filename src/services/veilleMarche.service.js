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
const { RapportHebdo, VeilleMarche } = require('../models');

const INDICATEURS_DEF = [
  { code: 'BRENT',         libelle: 'Brent',            unite: 'USD/baril',  source: 'Platts - Crude Oil',      frequence: 'Hebdomadaire' },
  { code: 'DATED_BRENT',  libelle: 'Dated Brent',      unite: 'USD/baril',  source: 'Platts',                  frequence: 'Hebdomadaire' },
  { code: 'WTI',           libelle: 'WTI',              unite: 'USD/baril',  source: 'Platts',                  frequence: 'Hebdomadaire' },
  { code: 'ESSENCE_FOB',  libelle: 'Essence FOB',       unite: 'USD/tonne',  source: 'Platts Refined Products', frequence: 'Hebdomadaire' },
  { code: 'GASOIL_FOB',   libelle: 'Gasoil 10 ppm FOB', unite: 'USD/tonne', source: 'Platts Refined Products', frequence: 'Hebdomadaire' },
  { code: 'JET_A1',        libelle: 'Jet A1',           unite: 'USD/tonne',  source: 'Platts Aviation',         frequence: 'Hebdomadaire' },
  { code: 'FUEL_OIL',      libelle: 'Fuel Oil',         unite: 'USD/tonne',  source: 'Platts Fuel Oil',         frequence: 'Hebdomadaire' },
  { code: 'GPL',            libelle: 'GPL',              unite: 'USD/tonne',  source: 'Platts LPG',              frequence: 'Hebdomadaire' },
  { code: 'USD_FCFA',      libelle: 'USD/FCFA',         unite: 'FCFA',       source: 'BCEAO',                   frequence: 'Hebdomadaire' },
];

const { getOrCreateRapportSemaine } = require('../utils/rapport.utils');
const { infoSaisie, lignesSaisie, ecrireLigne, frequenceDe } = require('./frequence.service');

const getSaisieData = async (userId) => {
  const rapport = await getOrCreateRapportSemaine(userId);

  const info = await infoSaisie('veille-marche');
  const rows = lignesSaisie(await VeilleMarche.findAll({ where: { rapport_id: rapport.id, del: 0 } }), info.frequence, r => r.produit);
  const idx = {};
  rows.forEach(r => { idx[r.produit] = r; });

  return {
    rapport: {
      id: rapport.id, annee: rapport.annee, semaine_iso: rapport.semaine_iso,
      date_debut: rapport.date_debut, date_fin: rapport.date_fin, statut: rapport.statut,
    },
    ...info,
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

// Prix saisi : vide = pas de valeur ; virgule decimale acceptee (126,974)
const prix = (v) => {
  if (v === null || v === undefined || String(v).trim() === '') return null;
  const n = parseFloat(String(v).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

const saveSaisie = async (rapportId, indicateurs, userId) => {
  const rapport = await RapportHebdo.findOne({ where: { id: rapportId, del: 0 } });
  if (!rapport) throw new Error('Rapport introuvable.');
  if (rapport.statut === 'PUBLIE') throw new Error('Ce rapport est déjà publié.');

  const frequence = await frequenceDe('veille-marche');
  for (const ind of indicateurs) {
    const n1 = prix(ind.prix_semaine_n1);
    const n  = prix(ind.prix_semaine_n);

    await ecrireLigne(VeilleMarche, { rapport_id: rapportId, produit: ind.code },
      { prix_semaine_n1: n1, prix_semaine_n: n, taux_change_usd: 0 }, frequence, userId);
  }
  return { message: 'Veille marché enregistrée avec succès.' };
};

module.exports = { getSaisieData, saveSaisie };
