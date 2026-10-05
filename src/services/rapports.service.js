const { RapportHebdo, StockDepot, ConsommationJournaliere, VenteMarketeur, FinanceDette, Produit, Depot, Marketeur, sequelize } = require('../models');
const { Op } = require('sequelize');

const PRODUIT_ORDER = ['SUPER91', 'PETROLE', 'GASOIL', 'DDO', 'JET_A1', 'GAZ', 'FUEL_OIL'];
const PRODUIT_LIBELLE = { SP: 'Essence', PL: 'Pétrole', GO: 'Gasoil', DDO: 'DDO', JA1: 'Jet A1', FO: 'Fuel', GAZ: 'Gaz' };

const getListe = async () => {
  const rapports = await RapportHebdo.findAll({
    where: { del: 0 },
    order: [['annee', 'DESC'], ['semaine_iso', 'DESC']],
    attributes: ['id', 'annee', 'semaine_iso', 'date_debut', 'date_fin', 'statut'],
  });
  return rapports;
};

const getApercu = async (rapportId) => {
  const rapport = await RapportHebdo.findOne({ where: { id: rapportId, del: 0 } });
  if (!rapport) throw new Error('Rapport introuvable.');

  // Pour le rapport : stock_disponible du jeudi (date_fin) + impompable de référence (NULL)
  // Compatibilité anciens rapports : si aucune ligne datée, on utilise les lignes NULL (ancien comportement)
  const thursdayDate = rapport.date_fin;
  const allStocksRaw = await StockDepot.findAll({
    where: {
      rapport_id: rapportId,
      del: 0,
      [Op.or]: [{ date_saisie: thursdayDate }, { date_saisie: null }],
    },
  });
  const mergedMap = {};
  for (const s of allStocksRaw) {
    const key = `${s.depot_id}_${s.produit_id}`;
    if (!mergedMap[key]) mergedMap[key] = { depot_id: s.depot_id, produit_id: s.produit_id, stock_disponible: 0, stock_impompable: 0, hasDated: false };
    const m = mergedMap[key];
    if (s.date_saisie !== null) {
      m.stock_disponible = parseFloat(s.stock_disponible) || 0;
      m.hasDated = true;
    } else {
      m.stock_impompable = parseFloat(s.stock_impompable) || 0;
      if (!m.hasDated) m.stock_disponible = parseFloat(s.stock_disponible) || 0;
    }
  }
  const mergedStocks = Object.values(mergedMap);

  const [consos, ventes, dettes, produitsRaw, marketeurs, depotsAll] = await Promise.all([
    ConsommationJournaliere.findAll({ where: { rapport_id: rapportId, del: 0 } }),

    VenteMarketeur.findAll({
      where: { rapport_id: rapportId, del: 0 },
      include: [
        { model: Produit,   as: 'produit',   attributes: ['code'] },
        { model: Marketeur, as: 'marketeur', attributes: ['id', 'libelle'] },
      ],
    }),
    FinanceDette.findAll({ where: { rapport_id: rapportId, del: 0 } }),
    Produit.findAll({ where: { del: 0 }, attributes: ['id', 'code', 'libelle', 'unite'] }),
    Marketeur.findAll({ where: { del: 0 }, attributes: ['id', 'code', 'libelle'], order: [['libelle', 'ASC']] }),
    Depot.findAll({ where: { del: 0 }, attributes: ['id', 'type', 'code'] }),
  ]);

  const produits = produitsRaw.sort((a, b) => {
    const ia = PRODUIT_ORDER.indexOf(a.code);
    const ib = PRODUIT_ORDER.indexOf(b.code);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
  const produitCodes = produits.map(p => p.code);

  // Maps de référence
  const depotTypeMap = {};
  const depotCodeMap = {};
  depotsAll.forEach(d => { depotTypeMap[d.id] = d.type; depotCodeMap[d.id] = d.code || ''; });
  const produitMap = {};
  produitsRaw.forEach(p => { produitMap[p.id] = p; });

  // Index consommations : depot_id + produit_id → conso_moyenne
  const consoIdx = {};
  consos.forEach(c => { consoIdx[`${c.depot_id}_${c.produit_id}`] = parseFloat(c.conso_moyenne) || 0; });

  // ── Stocks intérieurs : par produit, liste de dépôts (pour formule Excel)
  // Formule Excel : (Σdispo − imp[0] + Σimp[1..n]) / Σconso
  // Dépôts triés alphabétiquement par code → imp du premier soustrait, autres réajoutés
  const interByProduit = {}; // { code: { libelle, unite, depots: [{depotCode, dispo, imp, conso}] } }
  const exterMap = {};       // { code: { libelle, unite, netStock, conso } }

  for (const s of mergedStocks) {
    const prod = produitMap[s.produit_id];
    const type = depotTypeMap[s.depot_id];
    if (!prod || !type) continue;
    const code  = prod.code;
    const conso = consoIdx[`${s.depot_id}_${s.produit_id}`] || 0;

    if (type === 'INTERIEUR') {
      if (!interByProduit[code]) interByProduit[code] = { libelle: PRODUIT_LIBELLE[code] || prod.libelle, unite: prod.unite, depots: [] };
      interByProduit[code].depots.push({
        depotCode: depotCodeMap[s.depot_id],
        dispo: parseFloat(s.stock_disponible) || 0,
        imp:   parseFloat(s.stock_impompable) || 0,
        conso,
      });
    } else {
      if (!exterMap[code]) exterMap[code] = { libelle: PRODUIT_LIBELLE[code] || prod.libelle, unite: prod.unite, netStock: 0, conso: 0 };
      exterMap[code].netStock += parseFloat(s.stock_disponible) || 0;
      exterMap[code].conso    += conso;
    }
  }

  const buildInterListe = () =>
    produitCodes
      .filter(code => interByProduit[code])
      .map(code => {
        const { libelle, unite, depots } = interByProduit[code];
        // Tri alphabétique par code dépôt (ex. BINGO avant PENI)
        const sorted     = [...depots].sort((a, b) => a.depotCode.localeCompare(b.depotCode));
        const totalDispo = sorted.reduce((s, d) => s + d.dispo, 0);
        const totalConso = sorted.reduce((s, d) => s + d.conso, 0);
        // Formule Excel : imp[0] soustrait, imp[1..n] réajoutés
        const firstImp  = sorted.length > 0 ? sorted[0].imp : 0;
        const otherImps = sorted.slice(1).reduce((s, d) => s + d.imp, 0);
        const netNum    = totalDispo - firstImp + otherImps;
        const autonomie = totalConso > 0 ? Math.round(netNum / totalConso) : null;
        const isKg      = unite?.toLowerCase() === 'kg' || code === 'GAZ';
        const facteur   = isKg ? 1 : 1000;
        return { produit: libelle, code, unite: isKg ? 'kg' : 'litres', netStock: Math.round(netNum * facteur), conso: Math.round(totalConso * facteur), autonomie };
      });

  // Conso intérieure totale par produit (même dénominateur pour l'extérieur, formule Excel =P/conso_intérieure)
  const interConsoByCode = {};
  for (const code of produitCodes) {
    if (interByProduit[code]) {
      interConsoByCode[code] = interByProduit[code].depots.reduce((s, d) => s + d.conso, 0);
    }
  }

  const buildExterListe = () =>
    produitCodes
      .filter(code => exterMap[code])
      .map(code => {
        const { libelle, unite, netStock } = exterMap[code];
        // Dénominateur = besoins intérieurs (identique à la formule Excel =P27/4600)
        const conso     = interConsoByCode[code] || 0;
        const autonomie = conso > 0 ? Math.round(netStock / conso) : null;
        const isKg      = unite?.toLowerCase() === 'kg' || code === 'GAZ';
        const facteur   = isKg ? 1 : 1000;
        return { produit: libelle, code, unite: isKg ? 'kg' : 'litres', netStock: Math.round(netStock * facteur), conso: Math.round(conso * facteur), autonomie };
      });

  const stocksInterieurs = buildInterListe();
  const stocksExterieurs = buildExterListe();

  // Structure unifiée (intérieurs + extérieurs) — reconstruite depuis les listes déjà calculées
  const produitsLibelle = {};
  for (const p of produits) produitsLibelle[p.code] = p.libelle;
  const interByCode = {};
  for (const s of stocksInterieurs) interByCode[s.code] = s;
  const exterByCode = {};
  for (const s of stocksExterieurs) exterByCode[s.code] = s;
  const stocksListe = produitCodes.map(code => {
    const i = interByCode[code] || { netStock: 0, conso: 0 };
    const e = exterByCode[code] || { netStock: 0, conso: 0 };
    const stock = i.netStock + e.netStock;
    const conso = i.conso + e.conso;
    return { produit: produitsLibelle[code] || code, code, stock, conso, autonomie: conso > 0 ? Math.round(stock / conso) : 0 };
  });

  // ── Ventes : matrice {marketeur_id: {produit_code: quantite}}
  const ventesMatrix = {};
  const ventesTotauxMap = {};
  let totalVentes = 0;

  for (const v of ventes) {
    const mId = v.marketeur_id;
    const pCode = v.produit?.code;
    const qty = parseFloat(v.quantite) || 0;
    if (!pCode || qty === 0) continue;

    if (!ventesMatrix[mId]) ventesMatrix[mId] = {};
    ventesMatrix[mId][pCode] = (ventesMatrix[mId][pCode] || 0) + qty;
    ventesTotauxMap[pCode] = (ventesTotauxMap[pCode] || 0) + qty;
    totalVentes += qty;
  }

  const ventesTotauxListe = produitCodes.map(code => ({
    produit: produitsLibelle[code] || code,
    code,
    total: ventesTotauxMap[code] || 0,
  }));

  // Filtrer marketeurs qui ont au moins une vente pour ce rapport
  const marketeurIdsAvecVentes = new Set(ventes.map(v => v.marketeur_id));
  const marketeursActifs = marketeurs.filter(m => marketeurIdsAvecVentes.has(m.id));

  // ── Dettes
  let detteEtat = 0;
  let engagementFourn = 0;
  for (const d of dettes) {
    if (d.sens === 'DETTE_ETAT_VERS_SONABHY') detteEtat += parseFloat(d.montant) || 0;
    else engagementFourn += parseFloat(d.montant) || 0;
  }

  return {
    rapport: {
      id: rapport.id, annee: rapport.annee, semaine_iso: rapport.semaine_iso,
      date_debut: rapport.date_debut, date_fin: rapport.date_fin, statut: rapport.statut,
    },
    produits: produitCodes,
    stocksListe,
    stocksInterieurs,
    stocksExterieurs,
    marketeurs: marketeursActifs.map(m => ({ id: m.id, libelle: m.libelle })),
    ventesMatrix,
    ventesTotauxMap,
    ventesTotauxListe,
    totalVentes,
    detteEtat,
    engagementFourn,
  };
};

const archiver = async (rapportId, userId) => {
  const rapport = await RapportHebdo.findOne({ where: { id: rapportId, del: 0 } });
  if (!rapport) throw new Error('Rapport introuvable.');
  if (rapport.statut === 'PUBLIE') throw new Error('Ce rapport est déjà archivé.');
  await rapport.update({
    statut: 'PUBLIE',
    date_publication: new Date(),
    updated_by: userId,
  });
  return { message: `Rapport semaine ${rapport.semaine_iso}/${rapport.annee} archivé.` };
};

module.exports = { getListe, getApercu, archiver };
