const { RapportHebdo, CamionDepot, Depot, Produit } = require('../models');
const { getOrCreateRapportSemaine } = require('../utils/rapport.utils');

const PRODUIT_ORDER = ['SUPER91', 'PETROLE', 'GASOIL', 'DDO', 'JET_A1', 'GAZ', 'FUEL_OIL'];

const getSaisieData = async (userId) => {
  const rapport = await getOrCreateRapportSemaine(userId);

  const depotsRaw  = await Depot.findAll({ where: { type: 'INTERIEUR', del: 0 }, order: [['libelle', 'ASC']] });
  const produitsRaw = await Produit.findAll({ where: { del: 0 } });
  const produits = produitsRaw.sort((a, b) => {
    const ia = PRODUIT_ORDER.indexOf(a.code);
    const ib = PRODUIT_ORDER.indexOf(b.code);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  const camions = await CamionDepot.findAll({ where: { rapport_id: rapport.id, del: 0 } });
  const idx = {};
  camions.forEach(c => { idx[`${c.depot_id}_${c.produit_id}`] = c; });

  return {
    rapport: {
      id: rapport.id, annee: rapport.annee, semaine_iso: rapport.semaine_iso,
      date_debut: rapport.date_debut, date_fin: rapport.date_fin, statut: rapport.statut,
    },
    depots: depotsRaw.map(dep => ({
      depot_id:      dep.id,
      depot_code:    dep.code,
      depot_libelle: dep.libelle,
      lignes: produits.map(p => {
        const key = `${dep.id}_${p.id}`;
        const row = idx[key] || {};
        return {
          produit_id:          p.id,
          produit_code:        p.code,
          produit_libelle:     p.libelle,
          camions_en_attente:  parseInt(row.camions_en_attente) || 0,
          camions_recus:       parseInt(row.camions_recus)      || 0,
          camions_depotes:     parseInt(row.camions_depotes)    || 0,
        };
      }),
    })),
  };
};

const saveSaisie = async (rapportId, depotsData, userId) => {
  const rapport = await RapportHebdo.findOne({ where: { id: rapportId, del: 0 } });
  if (!rapport) throw new Error('Rapport introuvable.');
  if (rapport.statut === 'PUBLIE') throw new Error('Ce rapport est déjà publié.');

  for (const depot of depotsData) {
    for (const ligne of depot.lignes) {
      const enAttente = parseInt(ligne.camions_en_attente) || 0;
      const recus     = parseInt(ligne.camions_recus)      || 0;
      const depotes   = parseInt(ligne.camions_depotes)    || 0;

      const [row, created] = await CamionDepot.findOrCreate({
        where: { rapport_id: rapportId, depot_id: depot.depot_id, produit_id: ligne.produit_id, del: 0 },
        defaults: { camions_en_attente: enAttente, camions_recus: recus, camions_depotes: depotes, created_by: userId },
      });
      if (!created) {
        await row.update({ camions_en_attente: enAttente, camions_recus: recus, camions_depotes: depotes, updated_by: userId });
      }
    }
  }
  return { message: 'Saisie dépôts intérieurs enregistrée avec succès.' };
};

module.exports = { getSaisieData, saveSaisie };
