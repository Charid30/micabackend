/* ==================================================================
 *  Auteur : BATIONO Ulrich Rachid Kévin
 *           Expert en Sécurité Informatique
 *           Développeur FullStack
 *           Tel: +226 51 57 82 89 // 66 72 02 32
 *           Whatsapp: +226 51 57 82 89
 *           Mail: bkevin@sonabhy.bf // bationor10@gmail.com
 *  Projet : MICA – SONABHY
 * ================================================================== */
// Contenu du rapport hebdomadaire au format du document REPORTING de la direction :
//   en-tete « Situation des stocks SONABHY a la date du ... »
//   1. Situation des stocks : informations utiles, stocks en bacs (interieur / exterieur, en litres ou kg et
//      en jours d'autonomie), evolution des consommations, observations (evolution de l'autonomie vs N-1),
//      encours de livraison (promesses de livraison)
//   2. Quantites de produits servies aux marketeurs (semaine N-1, semaine N, evolution)
//   3. Dettes
//   4. Difficultes majeures (et recommandations)
// Meme contenu pour l'apercu, le PDF et l'export Excel. Les calculs d'autonomie et de tresorerie viennent
// de autonomie.service et tresorerie.service.
const { Op } = require('sequelize');
const { RapportHebdo, Produit, VenteMarketeur, AchatTrader, Recommandation } = require('../models');
const { getAutonomie } = require('./autonomie.service');
const { getTresorerie } = require('./tresorerie.service');

// Ordre et libelles du document REPORTING
const ORDRE = ['SUPER91', 'GASOIL', 'DDO', 'PETROLE', 'GAZ', 'FUEL_OIL', 'JET_A1'];
const LIBELLES = { SUPER91: 'Essence', GASOIL: 'Gasoil', DDO: 'DDO', PETROLE: 'Pétrole', GAZ: 'Gaz', FUEL_OIL: 'Fuel', JET_A1: 'Jet A1' };
const CODE_GAZ = 'GAZ';

const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };
const lignesTexte = (t) => String(t || '').split(/\r?\n/).map(l => l.replace(/^\s*[-•*]\s*/, '').trim()).filter(Boolean);
const trier = (codes) => [...codes].sort((a, b) => (ORDRE.indexOf(a) === -1 ? 99 : ORDRE.indexOf(a)) - (ORDRE.indexOf(b) === -1 ? 99 : ORDRE.indexOf(b)));

const rapportPrecedent = (rapport) => RapportHebdo.findOne({
  where: { del: 0, date_fin: { [Op.lt]: rapport.date_fin } }, order: [['date_fin', 'DESC']],
});

// Volume en m3 -> quantite du document : litres, ou kg pour le gaz (m3 x densite x 1000)
const quantiteDoc = (code, m3, densiteGaz) => Math.round(code === CODE_GAZ ? m3 * densiteGaz * 1000 : m3 * 1000);
const uniteDoc = (code) => (code === CODE_GAZ ? 'kg' : 'litres');

// ── Stocks en bacs + observations (evolution de l'autonomie par rapport a la semaine precedente)
function stocks(auto, autoPrec, produits) {
  const dg = auto.parametres.densite_gaz;
  const int = Object.fromEntries(auto.synthese_interieure.map(l => [l.produit_code, l]));
  const ext = Object.fromEntries(auto.synthese_exterieure.map(l => [l.produit_code, l]));
  const intPrec = autoPrec ? Object.fromEntries(autoPrec.synthese_interieure.map(l => [l.produit_code, l])) : {};
  const extPrec = autoPrec ? Object.fromEntries(autoPrec.synthese_exterieure.map(l => [l.produit_code, l])) : {};
  const jours = (a) => (a === null || a === undefined ? null : Math.round(a));
  const evolution = (a, b) => (jours(a) === null || jours(b) === null ? null : jours(a) - jours(b));

  const interieurs = produits.map(p => {
    const l = int[p.code];
    // Produit sans stockage interne (ex. Jet A1, Fuel) : ni consommation ni impompable ni stock
    const sansBac = !l || (l.conso_moyenne === 0 && l.impompable === 0 && l.volume_total === 0);
    return {
      code: p.code, produit: LIBELLES[p.code] || p.libelle, unite: uniteDoc(p.code), sans_bac: sansBac,
      quantite: sansBac ? 0 : quantiteDoc(p.code, l.volume_total - l.impompable, dg),
      jours: sansBac ? null : jours(l.autonomie), couleur: sansBac ? null : l.couleur,
      evolution_jours: sansBac ? null : evolution(l.autonomie, intPrec[p.code]?.autonomie),
    };
  });
  const exterieurs = produits.map(p => {
    const l = ext[p.code];
    return {
      code: p.code, produit: LIBELLES[p.code] || p.libelle, unite: uniteDoc(p.code), sans_bac: false,
      quantite: l ? quantiteDoc(p.code, l.volume_total, dg) : 0,
      jours: l ? jours(l.autonomie) : null, couleur: l ? l.couleur : null,
      evolution_jours: l ? evolution(l.autonomie, extPrec[p.code]?.autonomie) : null,
    };
  });
  return { interieurs, exterieurs };
}

// ── Encours de livraison : achats dont la livraison est posterieure a la date du rapport
async function encours(rapport, produits, auto) {
  const dg = auto.parametres.densite_gaz;
  const besoins = Object.fromEntries(auto.synthese_exterieure.map(l => [l.produit_code, l.besoin_journalier]));
  const achats = await AchatTrader.findAll({
    where: { del: 0, date_livraison: { [Op.gt]: rapport.date_fin } },
    include: [{ model: RapportHebdo, required: true, attributes: [], where: { del: 0, date_fin: { [Op.lte]: rapport.date_fin } } }],
  });
  const parId = Object.fromEntries(produits.map(p => [p.id, p]));
  const cumul = {}; const ports = new Set(); let du = null; let au = null; const sansDensite = new Set();
  for (const a of achats) {
    const p = parId[a.produit_id]; if (!p) continue;
    let q;
    if (p.code === CODE_GAZ) q = num(a.quantite_tm) * 1000;                       // tonnes -> kg
    else if (num(a.quantite_m3_15) > 0) q = num(a.quantite_m3_15) * 1000;          // volume a 15 °C saisi
    else if (num(p.densite_t_m3) > 0) q = (num(a.quantite_tm) / num(p.densite_t_m3)) * 1000;
    else { sansDensite.add(LIBELLES[p.code] || p.libelle); continue; }
    cumul[p.code] = (cumul[p.code] || 0) + q;
    if (a.lieu_livraison) ports.add(a.lieu_livraison.trim());
    if (!du || a.date_livraison < du) du = a.date_livraison;
    if (!au || a.date_livraison > au) au = a.date_livraison;
  }
  const lignes = produits.map(p => {
    const q = Math.round(cumul[p.code] || 0);
    const besoin = num(besoins[p.code]);
    const parJour = p.code === CODE_GAZ ? besoin * dg * 1000 : besoin * 1000;
    return { code: p.code, produit: LIBELLES[p.code] || p.libelle, unite: uniteDoc(p.code), quantite: q, jours: q > 0 && parJour > 0 ? Math.round(q / parJour) : null };
  });
  return { du, au, ports: [...ports], lignes, sans_densite: [...sansDensite] };
}

// ── Quantites servies aux marketeurs : semaine precedente, semaine du rapport, evolution
async function ventes(rapport, prec, produits) {
  const ids = [rapport.id, ...(prec ? [prec.id] : [])];
  const rows = await VenteMarketeur.findAll({ where: { del: 0, rapport_id: ids } });
  const parId = Object.fromEntries(produits.map(p => [p.id, p.code]));
  const somme = (rid) => {
    const t = {}; rows.filter(r => r.rapport_id === rid).forEach(r => { const c = parId[r.produit_id]; if (c) t[c] = (t[c] || 0) + num(r.quantite); });
    return t;
  };
  const periode = (r) => `Du ${String(r.date_debut).slice(8, 10)} au ${String(r.date_fin).slice(8, 10)}/${String(r.date_fin).slice(5, 7)}/${String(r.date_fin).slice(0, 4)}`;
  const cur = somme(rapport.id);
  const avant = prec ? somme(prec.id) : null;
  return {
    produits: produits.map(p => ({ code: p.code, produit: (LIBELLES[p.code] || p.libelle).toUpperCase() })),
    periodes: [
      ...(prec ? [{ libelle: periode(prec), valeurs: avant }] : []),
      { libelle: periode(rapport), valeurs: cur },
    ],
    evolution: avant ? Object.fromEntries(produits.map(p => [p.code, (cur[p.code] || 0) - (avant[p.code] || 0)])) : null,
    renseignees: rows.some(r => r.rapport_id === rapport.id),
  };
}

// ── Dettes (saisie tresorerie)
function dettes(treso) {
  const v = (code) => treso.lignes.find(l => l.code === code)?.montant_n ?? null;
  return {
    dettes_etat: v('CREANCES_ETAT'),              // sommes dues par l'Etat a la SONABHY
    creances_etat: v('DETTES_ETAT'),              // sommes dues par la SONABHY a l'Etat (plus-values, fiscalite)
    engagement_fournisseurs: v('DETTES_FOURNISSEURS'),
  };
}

const getReporting = async (rapport) => {
  const prec = await rapportPrecedent(rapport);
  const [auto, autoPrec, treso, produitsRaw, reco] = await Promise.all([
    getAutonomie(rapport),
    prec ? getAutonomie(prec) : null,
    getTresorerie(rapport),
    Produit.findAll({ where: { del: 0 } }),
    Recommandation.findOne({ where: { rapport_id: rapport.id, del: 0 } }),
  ]);
  // Produits du document uniquement (les produits de test ou hors liste ne figurent pas au rapport)
  const codes = trier(produitsRaw.map(p => p.code).filter(c => ORDRE.includes(c)));
  const produits = codes.map(c => produitsRaw.find(p => p.code === c));

  const { informationsUtiles } = require('./recommandations.service');
  const infos = await informationsUtiles(rapport, reco);
  const v = await ventes(rapport, prec, produits);

  return {
    date: rapport.date_fin,
    rapport_precedent: prec ? { semaine_iso: prec.semaine_iso, annee: prec.annee } : null,
    informations_utiles: lignesTexte(infos.texte),
    stocks: stocks(auto, autoPrec, produits),
    // Evolution des consommations : variation des quantites servies par rapport a la semaine precedente
    evolution_consommations: v.evolution
      ? produits.map(p => ({ code: p.code, produit: LIBELLES[p.code] || p.libelle, ecart: v.evolution[p.code] })).filter(e => e.ecart !== 0)
      : [],
    encours: await encours(rapport, produits, auto),
    ventes: v,
    dettes: dettes(treso),
    difficultes: lignesTexte(reco?.risques_majeurs),
    recommandations: lignesTexte(reco?.recommandations),
  };
};

module.exports = { getReporting, LIBELLES };
