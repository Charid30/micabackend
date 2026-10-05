const { RapportHebdo, StockDepot, ConsommationJournaliere, Depot, Produit, ParametreAlerte, Utilisateur, Permission } = require('../models');
const { getOrCreateRapportSemaine } = require('../utils/rapport.utils');

const PRODUIT_ORDER = ['SUPER91', 'PETROLE', 'GASOIL', 'DDO', 'JET_A1', 'GAZ', 'FUEL_OIL'];

// ── GET : données de saisie structurées (données du jour + impompable de référence)
const getSaisieData = async (userId) => {
  const rapport = await getOrCreateRapportSemaine(userId);

  const userPerms = await Permission.findAll({ where: { utilisateur_id: userId, module: 'stocks' } });
  const depotRestriction = userPerms.find(p => p.depot_id)?.depot_id || null;

  const depotWhere = depotRestriction ? { del: 0, id: depotRestriction } : { del: 0 };
  const depots     = await Depot.findAll({ where: depotWhere, order: [['type', 'DESC'], ['libelle', 'ASC']] });
  const produitsRaw = await Produit.findAll({ where: { del: 0 } });
  const produits    = produitsRaw.sort((a, b) => {
    const ia = PRODUIT_ORDER.indexOf(a.code);
    const ib = PRODUIT_ORDER.indexOf(b.code);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
  const alertes = await ParametreAlerte.findAll({ where: { del: 0 } });

  const today = new Date().toISOString().split('T')[0];

  // Stocks du jour (stock_disponible)
  const dailyStocks = await StockDepot.findAll({
    where: { rapport_id: rapport.id, date_saisie: today, del: 0 },
  });
  // Impompable de référence (date_saisie IS NULL, une fois par semaine)
  const impompableStocks = await StockDepot.findAll({
    where: { rapport_id: rapport.id, date_saisie: null, del: 0 },
  });
  const consos = await ConsommationJournaliere.findAll({ where: { rapport_id: rapport.id, del: 0 } });

  const stockIdx = {};
  dailyStocks.forEach(s => { stockIdx[`${s.depot_id}_${s.produit_id}`] = parseFloat(s.stock_disponible) || 0; });
  const impIdx = {};
  impompableStocks.forEach(s => { impIdx[`${s.depot_id}_${s.produit_id}`] = parseFloat(s.stock_impompable) || 0; });
  const consoIdx = {};
  consos.forEach(c => { consoIdx[`${c.depot_id}_${c.produit_id}`] = c; });
  const alerteIdx = {};
  alertes.forEach(a => { alerteIdx[a.produit_id] = a.seuil_jours; });

  const buildLignes = (depot) => produits.map(p => {
    const key = `${depot.id}_${p.id}`;
    const conso = consoIdx[key] || {};
    return {
      produit_id:       p.id,
      produit_code:     p.code,
      produit_libelle:  p.libelle,
      unite:            p.unite,
      stock_disponible: stockIdx[key] ?? 0,
      stock_impompable: impIdx[key]   ?? 0,
      conso_moyenne:    parseFloat(conso.conso_moyenne)  || 0,
      stock_securite:   parseFloat(conso.stock_securite) || 0,
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
    date_saisie: today,
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

// ── POST : enregistrer la saisie du jour
const saveSaisie = async (rapportId, depotsData, userId, { canWriteImpompable = false, canWriteStocks = false } = {}) => {
  const rapport = await RapportHebdo.findOne({ where: { id: rapportId, del: 0 } });
  if (!rapport) throw new Error('Rapport introuvable.');
  if (rapport.statut === 'PUBLIE') throw new Error('Ce rapport est déjà publié et ne peut plus être modifié.');

  const today = new Date().toISOString().split('T')[0];

  for (const depot of depotsData) {
    for (const ligne of depot.lignes) {
      const stockDispo    = parseFloat(ligne.stock_disponible) || 0;
      const stockImpompa  = parseFloat(ligne.stock_impompable) || 0;
      const consoMoyenne  = parseFloat(ligne.conso_moyenne)    || 0;
      const stockSecurite = parseFloat(ligne.stock_securite)   || 0;

      // ── Saisie quotidienne (date_saisie = aujourd'hui) : stock_disponible
      if (canWriteStocks) {
        const stockRow = await StockDepot.findOne({
          where: { rapport_id: rapportId, depot_id: depot.depot_id, produit_id: ligne.produit_id, date_saisie: today, del: 0 },
        });
        if (stockRow) {
          await stockRow.update({ stock_disponible: stockDispo, updated_by: userId });
        } else {
          await StockDepot.create({
            rapport_id: rapportId, depot_id: depot.depot_id, produit_id: ligne.produit_id,
            date_saisie: today, stock_disponible: stockDispo, stock_impompable: 0, autonomie: 0,
            del: 0, created_by: userId,
          });
        }

        // Consommation journalière : une par semaine (pas de date)
        const consoRow = await ConsommationJournaliere.findOne({
          where: { rapport_id: rapportId, depot_id: depot.depot_id, produit_id: ligne.produit_id, del: 0 },
        });
        if (consoRow) {
          await consoRow.update({ conso_moyenne: consoMoyenne, stock_securite: stockSecurite, updated_by: userId });
        } else {
          await ConsommationJournaliere.create({
            rapport_id: rapportId, depot_id: depot.depot_id, produit_id: ligne.produit_id,
            conso_moyenne: consoMoyenne, stock_securite: stockSecurite, del: 0, created_by: userId,
          });
        }
      }

      // ── Impompable de référence (date_saisie IS NULL) : une par semaine
      if (canWriteImpompable) {
        const impRow = await StockDepot.findOne({
          where: { rapport_id: rapportId, depot_id: depot.depot_id, produit_id: ligne.produit_id, date_saisie: null, del: 0 },
        });
        if (impRow) {
          await impRow.update({ stock_impompable: stockImpompa, updated_by: userId });
        } else {
          await StockDepot.create({
            rapport_id: rapportId, depot_id: depot.depot_id, produit_id: ligne.produit_id,
            date_saisie: null, stock_disponible: 0, stock_impompable: stockImpompa, autonomie: 0,
            del: 0, created_by: userId,
          });
        }
      }
    }
  }

  return { message: 'Saisie enregistrée avec succès.' };
};

module.exports = { getSaisieData, saveSaisie };
