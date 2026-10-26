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
// ══════════════════════════════════════════════════════════════════
//  Autonomie des stocks : calcul UNIQUE utilise par la saisie, le tableau de bord,
//  le rapport hebdomadaire et l'export Excel (onglet "Autonomie" de Indicateurs.xlsx).
//
//  Regles de gestion (validees par la DSTA) :
//   - toutes les quantites sont en m3, gaz compris ; dans les syntheses, le gaz est aussi
//     donne en tonnes (m3 x densite)
//   - depot interieur : volume total = stock en bacs + stock en embranchement
//       autonomie (j)     = (volume total - impompable) / consommation moyenne journaliere
//       stock de securite = objectif (j) x consommation moyenne
//       couverture (%)    = volume total / stock de securite
//   - synthese interieure (tous depots) : (somme des volumes - somme des impompables) / somme des consommations
//   - depot exterieur : autonomie = stock disponible / besoin journalier du produit (valeur fixee par la DSTA)
//   - synthese exterieure : somme des stocks des pays, hors lignes exclues du total (dette de produit)
//   - couleur : rouge sous le seuil rouge (10 j), jaune sous l'objectif (15 j), vert au-dela
// ══════════════════════════════════════════════════════════════════
const { Op } = require('sequelize');
const {
  Depot, Produit, StockDepot, ReferentielStock, BesoinExterieur, ActionStock, ParametreAlerte, Parametre,
} = require('../models');

const PRODUIT_ORDER = ['SUPER91', 'PETROLE', 'GASOIL', 'DDO', 'JET_A1', 'GAZ', 'FUEL_OIL'];
const CODE_GAZ = 'GAZ';
const PARAMS_DEFAUT = { seuilRouge: 10, couvertureObjectif: 100, densiteGaz: 0.56, objectifDefaut: 15 };

const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };
const round = (v, d = 2) => (v === null || v === undefined ? null : Math.round(v * 10 ** d) / 10 ** d);
const key = (depotId, produitId) => `${depotId}_${produitId}`;

function couleur(autonomie, objectif, seuilRouge) {
  if (autonomie === null) return null;
  if (autonomie < seuilRouge) return 'rouge';
  if (autonomie < objectif) return 'jaune';
  return 'vert';
}

// ------------------------------------------------------------------
//  Calcul pur (aucun acces base) : teste a partir des chiffres de l'Excel
//  entrees :
//   depots       [{ id, code, libelle, type: 'INTERIEUR'|'EXTERIEUR', pays }]
//   produits     [{ id, code, libelle }] (ordre d'affichage)
//   stocks       { 'depot_produit': { bacs, embranchement } }
//   referentiels { 'depot_produit': { impompable, conso, exclu } }
//   besoins      { produit_id: besoin journalier exterieur }
//   objectifs    { produit_id: objectif d'autonomie en jours }
//   actions      { 'depot_produit': 'texte' }
//   params       { seuilRouge, couvertureObjectif, densiteGaz, objectifDefaut }
// ------------------------------------------------------------------
function calculerAutonomie({ depots, produits, stocks = {}, referentiels = {}, besoins = {}, objectifs = {}, actions = {}, params = {} }) {
  const p = { ...PARAMS_DEFAUT, ...params };
  const objectifDe = (produitId) => (objectifs[produitId] > 0 ? objectifs[produitId] : p.objectifDefaut);
  const tonnes = (produit, m3) => (produit.code === CODE_GAZ ? round(m3 * p.densiteGaz, 3) : null);

  const interieurs = depots.filter(d => d.type === 'INTERIEUR');
  const exterieurs = depots.filter(d => d.type === 'EXTERIEUR');

  // ── Depots interieurs : une ligne par depot x produit
  const depotsInterieurs = interieurs.map(d => ({
    depot_id: d.id, depot_code: d.code, depot_libelle: d.libelle,
    lignes: produits.map(pr => {
      const k = key(d.id, pr.id);
      const s = stocks[k] || {}; const r = referentiels[k] || {};
      const bacs = num(s.bacs), embranchement = num(s.embranchement), total = bacs + embranchement;
      const impompable = num(r.impompable), conso = num(r.conso);
      const objectif = objectifDe(pr.id);
      const autonomie = conso > 0 ? (total - impompable) / conso : null;
      const stockSecurite = objectif * conso;
      const couverture = stockSecurite > 0 ? (total / stockSecurite) * 100 : null;
      const coul = couleur(autonomie, objectif, p.seuilRouge);
      return {
        produit_id: pr.id, produit_code: pr.code, produit_libelle: pr.libelle,
        stock_bacs: bacs, stock_embranchement: embranchement, volume_total: total,
        impompable, conso_moyenne: conso, objectif_jours: objectif,
        autonomie: round(autonomie), stock_securite: round(stockSecurite, 3),
        couverture: round(couverture, 1),
        couverture_ok: couverture === null ? null : couverture >= p.couvertureObjectif,
        couleur: coul, action: actions[k] || '', action_requise: coul === 'rouge' || coul === 'jaune',
      };
    }),
  }));

  // ── Synthese interieure par produit (consolide tous les depots interieurs)
  const syntheseInterieure = produits.map(pr => {
    const parDepot = {}; let total = 0, impompable = 0, conso = 0;
    for (const d of interieurs) {
      const k = key(d.id, pr.id); const s = stocks[k] || {}; const r = referentiels[k] || {};
      const v = num(s.bacs) + num(s.embranchement);
      parDepot[d.code] = v; total += v; impompable += num(r.impompable); conso += num(r.conso);
    }
    const objectif = objectifDe(pr.id);
    const autonomie = conso > 0 ? (total - impompable) / conso : null;
    return {
      produit_id: pr.id, produit_code: pr.code, produit_libelle: pr.libelle,
      par_depot: parDepot, volume_total: total, volume_total_tonnes: tonnes(pr, total),
      impompable, conso_moyenne: conso, objectif_jours: objectif,
      autonomie: round(autonomie), couleur: couleur(autonomie, objectif, p.seuilRouge),
    };
  }).filter(l => l.volume_total !== 0 || l.conso_moyenne > 0 || l.impompable > 0);

  const cumulInterieur = { par_depot: {}, total: 0 };
  for (const d of interieurs) {
    cumulInterieur.par_depot[d.code] = syntheseInterieure.reduce((s, l) => s + (l.par_depot[d.code] || 0), 0);
  }
  cumulInterieur.total = syntheseInterieure.reduce((s, l) => s + l.volume_total, 0);

  // ── Depots exterieurs : une ligne par pays x produit
  const depotsExterieurs = exterieurs.map(d => ({
    depot_id: d.id, depot_code: d.code, depot_libelle: d.libelle, pays: d.pays,
    lignes: produits.map(pr => {
      const k = key(d.id, pr.id); const s = stocks[k] || {}; const r = referentiels[k] || {};
      const stock = num(s.bacs) + num(s.embranchement);
      const besoin = num(besoins[pr.id]);
      const objectif = objectifDe(pr.id);
      const autonomie = besoin > 0 ? stock / besoin : null;
      const coul = couleur(autonomie, objectif, p.seuilRouge);
      return {
        produit_id: pr.id, produit_code: pr.code, produit_libelle: pr.libelle,
        stock_disponible: stock, besoin_journalier: besoin, objectif_jours: objectif,
        autonomie: round(autonomie), couleur: coul,
        negatif: stock < 0, exclu_total: !!r.exclu,
        action: actions[k] || '', action_requise: coul === 'rouge' || coul === 'jaune',
      };
    }),
  }));

  // ── Synthese exterieure par produit (somme des pays, hors lignes exclues du total)
  const syntheseExterieure = produits.map(pr => {
    const parPays = {}; const exclus = []; let total = 0;
    for (const d of exterieurs) {
      const k = key(d.id, pr.id); const s = stocks[k] || {}; const r = referentiels[k] || {};
      const v = num(s.bacs) + num(s.embranchement);
      parPays[d.code] = v;
      if (r.exclu) exclus.push(d.code); else total += v;
    }
    const besoin = num(besoins[pr.id]);
    const objectif = objectifDe(pr.id);
    const autonomie = besoin > 0 ? total / besoin : null;
    return {
      produit_id: pr.id, produit_code: pr.code, produit_libelle: pr.libelle,
      par_pays: parPays, exclus, volume_total: total, volume_total_tonnes: tonnes(pr, total),
      besoin_journalier: besoin, objectif_jours: objectif,
      autonomie: round(autonomie), couleur: couleur(autonomie, objectif, p.seuilRouge),
    };
  });

  const cumulExterieur = { par_pays: {}, total: 0 };
  for (const d of exterieurs) {
    cumulExterieur.par_pays[d.code] = syntheseExterieure.reduce((s, l) => s + (l.par_pays[d.code] || 0), 0);
  }
  cumulExterieur.total = syntheseExterieure.reduce((s, l) => s + l.volume_total, 0);

  return {
    parametres: { seuil_rouge_jours: p.seuilRouge, couverture_objectif_pct: p.couvertureObjectif, densite_gaz: p.densiteGaz },
    depots_interieurs: depotsInterieurs,
    synthese_interieure: syntheseInterieure,
    cumul_interieur: cumulInterieur,
    depots_exterieurs: depotsExterieurs,
    synthese_exterieure: syntheseExterieure,
    cumul_exterieur: cumulExterieur,
  };
}

// ------------------------------------------------------------------
//  Chargement depuis la base
// ------------------------------------------------------------------
const trierProduits = (list) => [...list].sort((a, b) => {
  const ia = PRODUIT_ORDER.indexOf(a.code), ib = PRODUIT_ORDER.indexOf(b.code);
  return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
});

async function chargerParametres() {
  const rows = await Parametre.findAll({
    where: { cle: ['AUTONOMIE_SEUIL_ROUGE_JOURS', 'COUVERTURE_OBJECTIF_PCT', 'GAZ_DENSITE_T_M3'] },
  });
  const v = {}; rows.forEach(r => { v[r.cle] = parseFloat(String(r.valeur).replace(',', '.')); });
  return {
    seuilRouge: Number.isFinite(v.AUTONOMIE_SEUIL_ROUGE_JOURS) ? v.AUTONOMIE_SEUIL_ROUGE_JOURS : PARAMS_DEFAUT.seuilRouge,
    couvertureObjectif: Number.isFinite(v.COUVERTURE_OBJECTIF_PCT) ? v.COUVERTURE_OBJECTIF_PCT : PARAMS_DEFAUT.couvertureObjectif,
    densiteGaz: Number.isFinite(v.GAZ_DENSITE_T_M3) && v.GAZ_DENSITE_T_M3 > 0 ? v.GAZ_DENSITE_T_M3 : PARAMS_DEFAUT.densiteGaz,
  };
}

// Valeur en vigueur a une date : derniere date d'effet <= date (sinon la plus ancienne connue)
function enVigueur(rows, dateRef, keyFn) {
  const out = {};
  const sorted = [...rows].sort((a, b) => String(a.date_effet).localeCompare(String(b.date_effet)));
  for (const r of sorted) {
    const k = keyFn(r);
    if (String(r.date_effet) <= dateRef || !out[k]) out[k] = r;
  }
  return out;
}

async function chargerReferentiels(dateRef) {
  const [refs, besoins] = await Promise.all([
    ReferentielStock.findAll({ where: { del: 0 } }),
    BesoinExterieur.findAll({ where: { del: 0 } }),
  ]);
  const refIdx = enVigueur(refs, dateRef, r => key(r.depot_id, r.produit_id));
  const besoinIdx = enVigueur(besoins, dateRef, r => String(r.produit_id));
  const referentiels = {}; const besoinsMap = {};
  for (const [k, r] of Object.entries(refIdx)) {
    referentiels[k] = { impompable: num(r.impompable), conso: num(r.conso_moyenne), exclu: !!r.exclu_total, date_effet: r.date_effet };
  }
  for (const [k, r] of Object.entries(besoinIdx)) besoinsMap[k] = num(r.besoin_journalier);
  return { referentiels, besoins: besoinsMap };
}

// Stocks d'un rapport : derniere saisie datee <= dateStock pour chaque depot x produit
// (dateStock = jour de saisie, ou jeudi de fin de semaine pour le rapport).
// Anciens rapports sans saisie datee : valeur unique de la semaine (ancien fonctionnement).
// jourExact : uniquement la saisie de ce jour (ecran de saisie quotidienne) ; booleen, ou fonction
//             (depot_id) => booleen quand la frequence differe entre depots interieurs et exterieurs
async function chargerStocks(rapportId, dateStock, { jourExact = false } = {}) {
  const exact = typeof jourExact === 'function' ? jourExact : () => jourExact;
  const rows = await StockDepot.findAll({ where: { rapport_id: rapportId, del: 0 } });
  const dated = rows.filter(r => r.date_saisie !== null && (exact(r.depot_id) ? r.date_saisie === dateStock : r.date_saisie <= dateStock))
    .sort((a, b) => String(b.date_saisie).localeCompare(String(a.date_saisie)));
  const stocks = {};
  for (const r of dated) {
    const k = key(r.depot_id, r.produit_id);
    if (stocks[k]) continue;
    const bacs = num(r.stock_bacs), embr = num(r.stock_embranchement);
    // Saisies anterieures a la separation bacs / embranchement : seul stock_disponible est renseigne
    stocks[k] = bacs || embr ? { bacs, embranchement: embr, date_saisie: r.date_saisie }
      : { bacs: num(r.stock_disponible), embranchement: 0, date_saisie: r.date_saisie };
  }
  {
    for (const r of rows.filter(x => x.date_saisie === null && !exact(x.depot_id))) {
      const k = key(r.depot_id, r.produit_id);
      if (!stocks[k] && num(r.stock_disponible)) stocks[k] = { bacs: num(r.stock_disponible), embranchement: 0, date_saisie: null };
    }
  }
  return stocks;
}

/**
 * Autonomie d'un rapport.
 * @param rapport     instance RapportHebdo
 * @param dateStock   date des stocks a retenir (AAAA-MM-JJ) ; par defaut le jeudi de fin de semaine
 * @param jourExact   true pour l'ecran de saisie (stocks du jour uniquement), ou fonction (depot_id) => booleen
 * @param depotIds    restreint les depots (droits limites a un depot)
 */
async function getAutonomie(rapport, { dateStock = null, jourExact = false, depotIds = null } = {}) {
  const dateRef = dateStock || rapport.date_fin;
  const depotWhere = { del: 0 }; if (depotIds) depotWhere.id = depotIds;
  const [depots, produitsRaw, alertes, params, { referentiels, besoins }, stocks, actionsRows] = await Promise.all([
    Depot.findAll({ where: depotWhere, order: [['type', 'DESC'], ['code', 'ASC']] }),
    Produit.findAll({ where: { del: 0 } }),
    ParametreAlerte.findAll({ where: { del: 0, actif: 1 } }),
    chargerParametres(),
    chargerReferentiels(dateRef),
    chargerStocks(rapport.id, dateRef, { jourExact }),
    ActionStock.findAll({ where: { rapport_id: rapport.id, del: 0 } }),
  ]);
  const objectifs = {}; alertes.forEach(a => { objectifs[a.produit_id] = a.seuil_jours; });
  const actions = {}; actionsRows.forEach(a => { actions[key(a.depot_id, a.produit_id)] = a.action; });
  // Ordre d'affichage des depots : interieurs puis exterieurs, dans l'ordre de leur identifiant
  const depotsOrd = [...depots].sort((a, b) => (a.type === b.type ? a.id - b.id : a.type === 'INTERIEUR' ? -1 : 1));
  const result = calculerAutonomie({
    depots: depotsOrd.map(d => ({ id: d.id, code: d.code, libelle: d.libelle, type: d.type, pays: d.pays })),
    produits: trierProduits(produitsRaw).map(p => ({ id: p.id, code: p.code, libelle: p.libelle })),
    stocks, referentiels, besoins, objectifs, actions, params,
  });
  result.date_stocks = dateRef;
  return result;
}

module.exports = { calculerAutonomie, getAutonomie, chargerParametres, trierProduits, PRODUIT_ORDER, couleur };
