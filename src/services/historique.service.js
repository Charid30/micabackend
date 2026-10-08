const { RapportHebdo, StockDepot, ChargementCorridor, TresorerieSemaine,
        VenteMarketeur, Produit, Depot, Corridor, sequelize } = require('../models');
const { Op } = require('sequelize');

async function getRapports(semaines) {
  return RapportHebdo.findAll({
    where: { del: 0 },
    order: [['date_debut', 'DESC']],
    limit: semaines,
    attributes: ['id', 'annee', 'semaine_iso', 'date_debut', 'date_fin'],
  }).then(rows => rows.reverse());
}

function label(r) {
  return `S${r.semaine_iso}/${String(r.annee).slice(-2)}`;
}

// ── STOCKS : total disponible par produit sur N semaines
const getStocks = async (semaines = 12) => {
  const rapports = await getRapports(semaines);
  if (!rapports.length) return { labels: [], datasets: [] };

  const ids = rapports.map(r => r.id);
  const produits = await Produit.findAll({ where: { del: 0 }, order: [['libelle', 'ASC']] });

  const rows = await StockDepot.findAll({
    where: { rapport_id: { [Op.in]: ids }, del: 0 },
    attributes: ['rapport_id', 'produit_id',
      [sequelize.fn('SUM', sequelize.col('stock_disponible')), 'total']],
    group: ['rapport_id', 'produit_id'],
    raw: true,
  });

  const idx = {};
  rows.forEach(r => { idx[`${r.rapport_id}|${r.produit_id}`] = parseFloat(r.total) || 0; });

  const datasets = produits.map((p, i) => ({
    label: p.libelle,
    data: rapports.map(r => idx[`${r.id}|${p.id}`] ?? null),
    color: COLORS[i % COLORS.length],
  }));

  return { labels: rapports.map(label), datasets };
};

// ── CORRIDORS : total camions chargés par corridor sur N semaines
const getCorridors = async (semaines = 12) => {
  const rapports = await getRapports(semaines);
  if (!rapports.length) return { labels: [], datasets: [] };

  const ids = rapports.map(r => r.id);
  const corridors = await Corridor.findAll({ where: { del: 0 }, order: [['libelle', 'ASC']] });

  const rows = await ChargementCorridor.findAll({
    where: { rapport_id: { [Op.in]: ids }, del: 0 },
    attributes: ['rapport_id', 'corridor_id',
      [sequelize.fn('SUM', sequelize.col('camions_charges')), 'total']],
    group: ['rapport_id', 'corridor_id'],
    raw: true,
  });

  const idx = {};
  rows.forEach(r => { idx[`${r.rapport_id}|${r.corridor_id}`] = parseFloat(r.total) || 0; });

  const datasets = corridors.map((c, i) => ({
    label: c.libelle,
    data: rapports.map(r => idx[`${r.id}|${c.id}`] ?? null),
    color: COLORS[i % COLORS.length],
  }));

  return { labels: rapports.map(label), datasets };
};

// ── TRESORERIE : situation simulée sur N semaines
const getTresorerie = async (semaines = 12) => {
  const rapports = await getRapports(semaines);
  if (!rapports.length) return { labels: [], datasets: [] };

  const ids = rapports.map(r => r.id);

  const SIGNES = {
    AVOIRS_BANQUES: 1, CREANCES_ETAT: 1, CREANCES_CLIENTS: 1,
    VALORISATION_STOCKS: 1, DETTES_BANQUES: -1, DETTES_FOURNISSEURS: -1, DETTES_ETAT: -1,
  };

  const rows = await TresorerieSemaine.findAll({
    where: { rapport_id: { [Op.in]: ids }, del: 0 },
    attributes: ['rapport_id', 'code', 'montant_n'],
    raw: true,
  });

  const totaux = {};
  rows.forEach(r => {
    const signe = SIGNES[r.code] ?? 1;
    const v = parseFloat(r.montant_n) || 0;
    totaux[r.rapport_id] = (totaux[r.rapport_id] || 0) + signe * v;
  });

  return {
    labels: rapports.map(label),
    datasets: [{
      label: 'Situation simulée (FCFA)',
      data: rapports.map(r => totaux[r.id] ?? null),
      color: COLORS[0],
    }],
  };
};

// ── VENTES : total par produit sur N semaines
const getVentes = async (semaines = 12) => {
  const rapports = await getRapports(semaines);
  if (!rapports.length) return { labels: [], datasets: [] };

  const ids = rapports.map(r => r.id);
  const produits = await Produit.findAll({ where: { del: 0 }, order: [['libelle', 'ASC']] });

  const rows = await VenteMarketeur.findAll({
    where: { rapport_id: { [Op.in]: ids }, del: 0 },
    attributes: ['rapport_id', 'produit_id',
      [sequelize.fn('SUM', sequelize.col('quantite')), 'total']],
    group: ['rapport_id', 'produit_id'],
    raw: true,
  });

  const idx = {};
  rows.forEach(r => { idx[`${r.rapport_id}|${r.produit_id}`] = parseFloat(r.total) || 0; });

  const datasets = produits.map((p, i) => ({
    label: p.libelle,
    data: rapports.map(r => idx[`${r.id}|${p.id}`] ?? null),
    color: COLORS[i % COLORS.length],
  }));

  return { labels: rapports.map(label), datasets };
};

const COLORS = [
  '#235347', '#8EB69B', '#0B2B26', '#163832', '#3a8c6e',
  '#6ab187', '#b6d9c7', '#051F20', '#5c9e82', '#2e6b55',
];

module.exports = { getStocks, getCorridors, getTresorerie, getVentes };
