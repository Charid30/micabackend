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
// Achats traders : REGISTRE PERMANENT (et non une saisie hebdomadaire).
//  - toutes les lignes sont affichees, quelle que soit la semaine de saisie
//  - une ligne existante est mise a jour (jamais supprimee puis recreee) ; une ligne nouvelle est
//    rattachee a la semaine en cours (trace de la date de saisie, utilisee par les encours du rapport)
//  - la suppression est explicite (suppression logique)
const { AchatTrader, Produit, Fournisseur, sequelize } = require('../models');

const PRODUIT_ORDER = ['SUPER91', 'PETROLE', 'GASOIL', 'DDO', 'JET_A1', 'GAZ', 'FUEL_OIL'];

const { getOrCreateRapportSemaine } = require('../utils/rapport.utils');

const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : null; };

const getSaisieData = async () => {
  const [produitsRaw, fournisseurs, achats] = await Promise.all([
    Produit.findAll({ where: { del: 0 }, attributes: ['id', 'code', 'libelle'] }),
    Fournisseur.findAll({ where: { del: 0 }, attributes: ['id', 'code', 'libelle'], order: [['libelle', 'ASC']] }),
    AchatTrader.findAll({ where: { del: 0 }, order: [['date_livraison', 'DESC'], ['id', 'DESC']] }),
  ]);

  const produits = produitsRaw.sort((a, b) => {
    const ia = PRODUIT_ORDER.indexOf(a.code);
    const ib = PRODUIT_ORDER.indexOf(b.code);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  return {
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
      saisi_le: a.created_at,
    })),
  };
};

// achatsData : lignes a creer (sans id) ou a mettre a jour (avec id) ; supprimes : identifiants a retirer
const saveSaisie = async (achatsData, supprimes, userId) => {
  for (const [i, a] of achatsData.entries()) {
    if (!a.produit_id || !a.fournisseur_id || !a.date_livraison) {
      throw { status: 400, message: `Ligne ${i + 1} : produit, fournisseur et date de livraison sont obligatoires.` };
    }
  }
  const t = await sequelize.transaction();
  try {
    let rapportId = null;     // semaine de saisie des nouvelles lignes
    let crees = 0, modifies = 0, retires = 0;
    for (const a of achatsData) {
      const valeurs = {
        produit_id: a.produit_id,
        fournisseur_id: a.fournisseur_id,
        type_operation: a.type_operation || '',
        lieu_livraison: a.lieu_livraison || '',
        date_livraison: a.date_livraison,
        quantite_tm: num(a.quantite_tm) || 0,
        quantite_m3_15: num(a.quantite_m3_15),
        quantite_m3_ambiant: num(a.quantite_m3_ambiant),
        periode_cotation: a.periode_cotation || '',
        prix_unitaire_caf_usd: num(a.prix_unitaire_caf_usd) || 0,
        taux_change: num(a.taux_change) || 0,
        montant_trans_cfa: num(a.montant_trans_cfa) || 0,
        frais_lc_cfa: num(a.frais_lc_cfa),
      };
      if (a.id) {
        const ligne = await AchatTrader.findOne({ where: { id: a.id, del: 0 }, transaction: t });
        if (!ligne) continue;
        await ligne.update({ ...valeurs, updated_by: userId, updated_at: new Date() }, { transaction: t });
        modifies++;
      } else {
        if (!rapportId) rapportId = (await getOrCreateRapportSemaine(userId)).id;
        await AchatTrader.create({ ...valeurs, rapport_id: rapportId, del: 0, created_by: userId }, { transaction: t });
        crees++;
      }
    }
    if (Array.isArray(supprimes) && supprimes.length) {
      [retires] = await AchatTrader.update(
        { del: 1, deleted_at: new Date(), deleted_by: userId, updated_by: userId },
        { where: { id: supprimes.filter(Number.isInteger), del: 0 }, transaction: t },
      );
    }
    await t.commit();
    const parts = [crees && `${crees} ajouté(s)`, modifies && `${modifies} mis à jour`, retires && `${retires} supprimé(s)`].filter(Boolean);
    return { message: `Registre des achats enregistré${parts.length ? ' : ' + parts.join(', ') : ''}.` };
  } catch (err) {
    await t.rollback();
    throw err;
  }
};

module.exports = { getSaisieData, saveSaisie };
