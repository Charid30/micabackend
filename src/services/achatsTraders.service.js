const { RapportHebdo, AchatTrader, Produit, Fournisseur, sequelize } = require('../models');

const PRODUIT_ORDER = ['SP', 'PL', 'GO', 'DDO', 'JA1', 'FO', 'GAZ'];

const { getOrCreateRapportSemaine } = require('../utils/rapport.utils');

const getSaisieData = async (userId) => {
  const rapport = await getOrCreateRapportSemaine(userId);

  const [produitsRaw, fournisseurs, achats] = await Promise.all([
    Produit.findAll({ where: { del: 0 }, attributes: ['id', 'code', 'libelle'] }),
    Fournisseur.findAll({ where: { del: 0 }, attributes: ['id', 'code', 'libelle'], order: [['libelle', 'ASC']] }),
    AchatTrader.findAll({
      where: { rapport_id: rapport.id, del: 0 },
      order: [['id', 'ASC']],
    }),
  ]);

  const produits = produitsRaw.sort((a, b) => {
    const ia = PRODUIT_ORDER.indexOf(a.code);
    const ib = PRODUIT_ORDER.indexOf(b.code);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  return {
    rapport: {
      id: rapport.id, annee: rapport.annee, semaine_iso: rapport.semaine_iso,
      date_debut: rapport.date_debut, date_fin: rapport.date_fin, statut: rapport.statut,
    },
    produits: produits.map(p => ({ id: p.id, code: p.code, libelle: p.libelle })),
    fournisseurs: fournisseurs.map(f => ({ id: f.id, code: f.code, libelle: f.libelle })),
    achats: achats.map(a => ({
      id: a.id,
      produit_id: a.produit_id,
      fournisseur_id: a.fournisseur_id,
      type_operation: a.type_operation || '',
      lieu_livraison: a.lieu_livraison || '',
      date_livraison: a.date_livraison || '',
      quantite_tm: a.quantite_tm,
      quantite_m3_15: a.quantite_m3_15,
      quantite_m3_ambiant: a.quantite_m3_ambiant,
      periode_cotation: a.periode_cotation || '',
      prix_unitaire_caf_usd: a.prix_unitaire_caf_usd,
      taux_change: a.taux_change,
      montant_trans_cfa: a.montant_trans_cfa,
      frais_lc_cfa: a.frais_lc_cfa,
    })),
  };
};

const saveSaisie = async (rapportId, achatsData, userId) => {
  const rapport = await RapportHebdo.findOne({ where: { id: rapportId, del: 0 } });
  if (!rapport) throw new Error('Rapport introuvable.');
  if (rapport.statut === 'PUBLIE') throw new Error('Ce rapport est déjà publié.');

  const t = await sequelize.transaction();
  try {
    // Soft-delete toutes les lignes existantes
    await AchatTrader.update(
      { del: 1, updated_by: userId },
      { where: { rapport_id: rapportId }, transaction: t }
    );

    // Réinsérer les nouvelles lignes
    for (const a of achatsData) {
      if (!a.produit_id || !a.fournisseur_id) continue; // ignorer lignes incomplètes
      await AchatTrader.create({
        rapport_id: rapportId,
        produit_id: a.produit_id,
        fournisseur_id: a.fournisseur_id,
        type_operation: a.type_operation || '',
        lieu_livraison: a.lieu_livraison || '',
        date_livraison: a.date_livraison || null,
        quantite_tm: a.quantite_tm || 0,
        quantite_m3_15: a.quantite_m3_15 || null,
        quantite_m3_ambiant: a.quantite_m3_ambiant || null,
        periode_cotation: a.periode_cotation || '',
        prix_unitaire_caf_usd: a.prix_unitaire_caf_usd || 0,
        taux_change: a.taux_change || 0,
        montant_trans_cfa: a.montant_trans_cfa || 0,
        frais_lc_cfa: a.frais_lc_cfa || null,
        del: 0,
        created_by: userId,
      }, { transaction: t });
    }

    await t.commit();
    return { message: 'Achats traders enregistrés avec succès.' };
  } catch (err) {
    await t.rollback();
    throw err;
  }
};

module.exports = { getSaisieData, saveSaisie };
