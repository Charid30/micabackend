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

  // Meme regle de calcul que l'ecran Tresorerie (lignes parametrables, sous-totaux)
  const totaux = await require('./tresorerie.service').totauxParRapport(ids);

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

// ── STOCKS JOUR PAR JOUR : une semaine (vendredi -> jeudi), par depot et par produit
// Chaque jour : volume saisi ce jour-la (bacs + embranchement, m3) et autonomie calculee avec le
// referentiel en vigueur a cette date (meme calcul que la saisie et le rapport). Jour sans saisie : null.
const JOURS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const getJournalier = async ({ rapportId = null, depotId = null, produitId = null } = {}) => {
  const { getAutonomie } = require('./autonomie.service');
  const rapports = await RapportHebdo.findAll({
    where: { del: 0 }, order: [['date_fin', 'DESC']], limit: 104,
    attributes: ['id', 'annee', 'semaine_iso', 'date_debut', 'date_fin', 'statut'],
  });
  if (!rapports.length) return { semaines: [], jours: [], lignes: [], syntheses: [] };
  const rapport = rapportId ? await RapportHebdo.findOne({ where: { id: rapportId, del: 0 } }) : rapports[0];
  if (!rapport) throw { status: 404, message: 'Semaine introuvable.' };

  const aujourdhui = new Date().toISOString().split('T')[0];
  const jours = [];
  for (let d = new Date(`${rapport.date_debut}T00:00:00Z`); d <= new Date(`${rapport.date_fin}T00:00:00Z`); d = new Date(d.getTime() + 86400000)) {
    const iso = d.toISOString().split('T')[0];
    jours.push({ date: iso, libelle: `${JOURS[d.getUTCDay()]} ${iso.slice(8, 10)}/${iso.slice(5, 7)}`, futur: iso > aujourdhui });
  }
  // Saisies existantes (pour distinguer « 0 saisi » de « pas de saisie »)
  const saisies = await StockDepot.findAll({ where: { rapport_id: rapport.id, del: 0, date_saisie: { [Op.ne]: null } }, attributes: ['depot_id', 'produit_id', 'date_saisie'], raw: true });
  const saisi = new Set(saisies.map(s => `${s.date_saisie}_${s.depot_id}_${s.produit_id}`));

  const lignes = new Map();      // depot x produit
  const syntheses = new Map();   // produit (total interieur / exterieur)
  const filtre = (dId, pId) => (!depotId || dId === depotId) && (!produitId || pId === produitId);
  for (const [i, j] of jours.entries()) {
    if (j.futur) continue;
    const a = await getAutonomie(rapport, { dateStock: j.date, jourExact: true });
    for (const d of a.depots_interieurs) for (const l of d.lignes) {
      if (!filtre(d.depot_id, l.produit_id)) continue;
      if (!(l.conso_moyenne > 0 || l.impompable > 0 || saisi.has(`${j.date}_${d.depot_id}_${l.produit_id}`))) continue;
      const k = `${d.depot_id}_${l.produit_id}`;
      if (!lignes.has(k)) lignes.set(k, { type: 'INTERIEUR', depot_id: d.depot_id, depot: d.depot_libelle, produit_id: l.produit_id, produit: l.produit_libelle, valeurs: jours.map(() => null) });
      lignes.get(k).valeurs[i] = saisi.has(`${j.date}_${d.depot_id}_${l.produit_id}`)
        ? { volume: l.volume_total, autonomie: l.autonomie, couleur: l.couleur } : null;
    }
    for (const d of a.depots_exterieurs) for (const l of d.lignes) {
      if (!filtre(d.depot_id, l.produit_id)) continue;
      if (!(l.besoin_journalier > 0 || saisi.has(`${j.date}_${d.depot_id}_${l.produit_id}`))) continue;
      const k = `${d.depot_id}_${l.produit_id}`;
      if (!lignes.has(k)) lignes.set(k, { type: 'EXTERIEUR', depot_id: d.depot_id, depot: d.pays || d.depot_libelle, produit_id: l.produit_id, produit: l.produit_libelle, valeurs: jours.map(() => null) });
      lignes.get(k).valeurs[i] = saisi.has(`${j.date}_${d.depot_id}_${l.produit_id}`)
        ? { volume: l.stock_disponible, autonomie: l.autonomie, couleur: l.couleur } : null;
    }
    // Totaux par produit (tous depots) : uniquement sans filtre de depot
    if (!depotId) {
      const jourSaisi = saisies.some(s => s.date_saisie === j.date);
      for (const [type, liste] of [['INTERIEUR', a.synthese_interieure], ['EXTERIEUR', a.synthese_exterieure]]) {
        for (const l of liste) {
          if (produitId && l.produit_id !== produitId) continue;
          const k = `${type}_${l.produit_id}`;
          if (!syntheses.has(k)) syntheses.set(k, { type, produit_id: l.produit_id, produit: l.produit_libelle, valeurs: jours.map(() => null) });
          syntheses.get(k).valeurs[i] = jourSaisi ? { volume: l.volume_total, autonomie: l.autonomie, couleur: l.couleur } : null;
        }
      }
    }
  }
  const tri = (a, b) => (a.type === b.type ? 0 : a.type === 'INTERIEUR' ? -1 : 1);
  return {
    semaine: { id: rapport.id, annee: rapport.annee, semaine_iso: rapport.semaine_iso, date_debut: rapport.date_debut, date_fin: rapport.date_fin },
    semaines: rapports.map(r => ({ id: r.id, libelle: `S${r.semaine_iso}/${r.annee} (${String(r.date_debut).slice(8, 10)}/${String(r.date_debut).slice(5, 7)} – ${String(r.date_fin).slice(8, 10)}/${String(r.date_fin).slice(5, 7)})` })),
    jours,
    lignes: [...lignes.values()].sort(tri),
    syntheses: [...syntheses.values()].filter(s => s.valeurs.some(v => v && (v.volume || v.autonomie))).sort(tri),
  };
};

module.exports = { getStocks, getCorridors, getTresorerie, getVentes, getJournalier };
