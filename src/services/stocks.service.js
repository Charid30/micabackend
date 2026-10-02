const { RapportHebdo, StockDepot, ConsommationJournaliere, Depot, Produit, ParametreAlerte, Utilisateur, Permission } = require('../models');
const { getOrCreateRapportSemaine } = require('../utils/rapport.utils');

// ── GET : données de saisie structurées
const getSaisieData = async (userId) => {
  const rapport = await getOrCreateRapportSemaine(userId);

  // Restriction dépôt : si l'utilisateur a une permission stocks avec depot_id, on filtre
  const userPerms = await Permission.findAll({ where: { utilisateur_id: userId, module: 'stocks' } });
  const depotRestriction = userPerms.find(p => p.depot_id)?.depot_id || null;

  const PRODUIT_ORDER = ['SP', 'PL', 'GO', 'DDO', 'JA1', 'GAZ', 'FO'];
  const depotWhere = depotRestriction
    ? { del: 0, id: depotRestriction }
    : { del: 0 };
  const depots = await Depot.findAll({ where: depotWhere, order: [['type', 'DESC'], ['libelle', 'ASC']] });
  const produitsRaw = await Produit.findAll({ where: { del: 0 } });
  const produits    = produitsRaw.sort((a, b) => {
    const ia = PRODUIT_ORDER.indexOf(a.code);
    const ib = PRODUIT_ORDER.indexOf(b.code);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
  const alertes  = await ParametreAlerte.findAll({ where: { del: 0 } });

  const stocks = await StockDepot.findAll({ where: { rapport_id: rapport.id, del: 0 } });
  const consos  = await ConsommationJournaliere.findAll({ where: { rapport_id: rapport.id, del: 0 } });

  const stockIdx = {};
  stocks.forEach(s => { stockIdx[`${s.depot_id}_${s.produit_id}`] = s; });
  const consoIdx = {};
  consos.forEach(c => { consoIdx[`${c.depot_id}_${c.produit_id}`] = c; });
  const alerteIdx = {};
  alertes.forEach(a => { alerteIdx[a.produit_id] = a.seuil_jours; });

  const buildLignes = (depot) => produits.map(p => {
    const key   = `${depot.id}_${p.id}`;
    const stock = stockIdx[key] || {};
    const conso = consoIdx[key] || {};
    return {
      produit_id:       p.id,
      produit_code:     p.code,
      produit_libelle:  p.libelle,
      unite:            p.unite,
      stock_disponible: parseFloat(stock.stock_disponible) || 0,
      stock_impompable: parseFloat(stock.stock_impompable) || 0,
      conso_moyenne:    parseFloat(conso.conso_moyenne)    || 0,
      stock_securite:   parseFloat(conso.stock_securite)   || 0,
      seuil_jours:      alerteIdx[p.id] || 15,
    };
  });

  const depotsInt = depots.filter(d => d.type === 'INTERIEUR');
  const depotsExt = depots.filter(d => d.type === 'EXTERIEUR');

  return {
    rapport: {
      id:          rapport.id,
      annee:       rapport.annee,
      semaine_iso: rapport.semaine_iso,
      date_debut:  rapport.date_debut,
      date_fin:    rapport.date_fin,
      statut:      rapport.statut,
    },
    depots_interieurs: depotsInt.map(d => ({
      depot_id:      d.id,
      depot_code:    d.code,
      depot_libelle: d.libelle,
      lignes:        buildLignes(d),
    })),
    depots_exterieurs: depotsExt.map(d => ({
      depot_id:      d.id,
      depot_code:    d.code,
      depot_libelle: d.libelle,
      lignes:        buildLignes(d),
    })),
  };
};

// ── POST : enregistrer la saisie
const saveSaisie = async (rapportId, depotsData, userId, { canWriteImpompable = false, canWriteStocks = false } = {}) => {
  const rapport = await RapportHebdo.findOne({ where: { id: rapportId, del: 0 } });
  if (!rapport) throw new Error('Rapport introuvable.');
  if (rapport.statut === 'PUBLIE') throw new Error('Ce rapport est déjà publié et ne peut plus être modifié.');

  for (const depot of depotsData) {
    const estInterieur = depot.type === 'INTERIEUR';

    for (const ligne of depot.lignes) {
      const stockDispo    = parseFloat(ligne.stock_disponible) || 0;
      const stockImpompa  = parseFloat(ligne.stock_impompable) || 0;
      const consoMoyenne  = parseFloat(ligne.conso_moyenne)    || 0;
      const stockSecurite = parseFloat(ligne.stock_securite)   || 0;

      // ── Upsert stocks_depot ─────────────────────────────────
      const [stockRow, stockCreated] = await StockDepot.findOrCreate({
        where: { rapport_id: rapportId, depot_id: depot.depot_id, produit_id: ligne.produit_id, del: 0 },
        defaults: {
          stock_disponible: canWriteStocks     ? stockDispo   : 0,
          stock_impompable: canWriteImpompable ? stockImpompa : 0,
          autonomie: 0,
          created_by: userId,
        },
      });

      if (!stockCreated) {
        const updateStock = { updated_by: userId };
        if (canWriteStocks)     updateStock.stock_disponible = stockDispo;
        if (canWriteImpompable) updateStock.stock_impompable = stockImpompa;

        // Recalcul autonomie avec les valeurs finales
        const finalDispo    = canWriteStocks     ? stockDispo   : parseFloat(stockRow.stock_disponible) || 0;
        const finalImpompa  = canWriteImpompable ? stockImpompa : parseFloat(stockRow.stock_impompable) || 0;
        updateStock.autonomie = consoMoyenne > 0
          ? (estInterieur ? (finalDispo - finalImpompa) / consoMoyenne : finalDispo / consoMoyenne)
          : 0;

        await stockRow.update(updateStock);
      }

      // ── Upsert consommations_journalieres (stocks:WRITE uniquement) ──
      if (canWriteStocks) {
        const [consoRow, consoCreated] = await ConsommationJournaliere.findOrCreate({
          where: { rapport_id: rapportId, depot_id: depot.depot_id, produit_id: ligne.produit_id, del: 0 },
          defaults: { conso_moyenne: consoMoyenne, stock_securite: stockSecurite, created_by: userId },
        });
        if (!consoCreated) {
          await consoRow.update({ conso_moyenne: consoMoyenne, stock_securite: stockSecurite, updated_by: userId });
        }
      }
    }
  }

  return { message: 'Saisie enregistrée avec succès.' };
};

module.exports = { getSaisieData, saveSaisie };
