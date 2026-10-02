const { RapportHebdo, VenteMarketeur, Marketeur, Produit } = require('../models');
const { getOrCreateRapportSemaine } = require('../utils/rapport.utils');

const PRODUIT_ORDER = ['SP', 'PL', 'GO', 'DDO', 'JA1', 'FO', 'GAZ'];

const getSaisieData = async (userId) => {
  const rapport = await getOrCreateRapportSemaine(userId);

  const [marketeurs, produitsRaw, ventes] = await Promise.all([
    Marketeur.findAll({ where: { del: 0 }, attributes: ['id', 'code', 'libelle'], order: [['libelle', 'ASC']] }),
    Produit.findAll({ where: { del: 0 }, attributes: ['id', 'code', 'libelle'] }),
    VenteMarketeur.findAll({ where: { rapport_id: rapport.id, del: 0 } }),
  ]);

  const produits = produitsRaw.sort((a, b) => {
    const ia = PRODUIT_ORDER.indexOf(a.code);
    const ib = PRODUIT_ORDER.indexOf(b.code);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  // Construire la matrice {marketeur_id: {produit_id: quantite}}
  const matrix = {};
  for (const v of ventes) {
    if (!matrix[v.marketeur_id]) matrix[v.marketeur_id] = {};
    matrix[v.marketeur_id][v.produit_id] = parseFloat(v.quantite) || 0;
  }

  return {
    rapport: {
      id: rapport.id, annee: rapport.annee, semaine_iso: rapport.semaine_iso,
      date_debut: rapport.date_debut, date_fin: rapport.date_fin, statut: rapport.statut,
    },
    marketeurs: marketeurs.map(m => ({ id: m.id, code: m.code, libelle: m.libelle })),
    produits: produits.map(p => ({ id: p.id, code: p.code, libelle: p.libelle })),
    matrix,
  };
};

const saveSaisie = async (rapportId, ventesData, userId) => {
  const rapport = await RapportHebdo.findOne({ where: { id: rapportId, del: 0 } });
  if (!rapport) throw new Error('Rapport introuvable.');
  if (rapport.statut === 'PUBLIE') throw new Error('Ce rapport est déjà publié.');

  // Soft-delete toutes les ventes existantes
  await VenteMarketeur.update(
    { del: 1, updated_by: userId },
    { where: { rapport_id: rapportId } }
  );

  // Réinsérer les nouvelles valeurs (uniquement quantite > 0)
  for (const v of ventesData) {
    if (!v.marketeur_id || !v.produit_id || !(parseFloat(v.quantite) > 0)) continue;
    await VenteMarketeur.create({
      rapport_id: rapportId,
      marketeur_id: v.marketeur_id,
      produit_id: v.produit_id,
      quantite: parseFloat(v.quantite),
      del: 0,
      created_by: userId,
    });
  }

  return { message: 'Ventes enregistrées avec succès.' };
};

module.exports = { getSaisieData, saveSaisie };
