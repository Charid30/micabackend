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
// Contenu du rapport hebdomadaire au format du document REPORTING de la direction :
//   en-tete « Situation des stocks SONABHY a la date du ... »
//   1. Situation des stocks : informations utiles, stocks en bacs (interieur / exterieur, en litres ou kg et
//      en jours d'autonomie), evolution des consommations, observations (evolution de l'autonomie vs N-1),
//      encours fournisseurs par produit (menu Encours : cumul, besoin, taux de couverture)
//   2. Quantites de produits servies aux marketeurs (semaine N-1, semaine N, evolution)
//   3. Dettes
//   4. Difficultes majeures (et recommandations)
// Meme contenu pour l'apercu, le PDF et l'export Excel. Les calculs d'autonomie et de tresorerie viennent
// de autonomie.service et tresorerie.service.
const { Op } = require('sequelize');
const { RapportHebdo, Produit, VenteMarketeur, VeilleMarche, VeilleGeopolitique } = require('../models');
const { getAutonomie } = require('./autonomie.service');
const { getTresorerie } = require('./tresorerie.service');
const { derniereValeurParRapport, derniereValeur } = require('./frequence.service');

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

  // Seuls les produits qui ont un stock saisi figurent au rapport : un produit sans bac a la SONABHY
  // (ex. Fuel) ou sans valeur pour la semaine n'est pas affiche (un stock negatif a l'exterieur reste affiche)
  const aUneValeur = (l) => !!l && Number(l.volume_total) !== 0;

  const interieurs = produits.filter(p => aUneValeur(int[p.code])).map(p => {
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
  const exterieurs = produits.filter(p => aUneValeur(ext[p.code])).map(p => {
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

// ── Quantites servies aux marketeurs : semaine precedente, semaine du rapport, evolution
async function ventes(rapport, prec, produits) {
  const ids = [rapport.id, ...(prec ? [prec.id] : [])];
  // Derniere saisie de ventes de chaque semaine (saisie quotidienne : celle du dernier jour)
  const rows = derniereValeurParRapport(await VenteMarketeur.findAll({ where: { del: 0, rapport_id: ids } }), null);
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

// Veilles de la semaine (derniere saisie) : indicateurs de prix renseignes (semaine N differente de zero)
// et zones geopolitiques renseignees ; une hausse de prix est defavorable
async function veilles(rapport) {
  const { INDICATEURS_DEF } = require('./veilleMarche.service');
  const { ZONES_DEF } = require('./veilleGeo.service');
  const [marche, geo] = await Promise.all([
    VeilleMarche.findAll({ where: { rapport_id: rapport.id, del: 0 } }),
    VeilleGeopolitique.findAll({ where: { rapport_id: rapport.id, del: 0 } }),
  ]);
  const prix = new Map(derniereValeur(marche, r => r.produit).map(r => [r.produit, r]));
  const prixDe = (v) => (v === null || v === undefined ? null : parseFloat(v));
  const indicateurs = INDICATEURS_DEF.map((def) => {
    const r = prix.get(def.code);
    const n = prixDe(r?.prix_semaine_n), n1 = prixDe(r?.prix_semaine_n1);
    const variation = n !== null && n1 ? (n - n1) / n1 : null;
    return {
      libelle: def.libelle, unite: def.unite, source: def.source, prix_n: n, prix_n1: n1 || null, variation,
      tendance: variation === null ? null : variation > 0 ? 'hausse' : variation < 0 ? 'baisse' : 'stable',
      favorable: variation === null || variation === 0 ? null : variation < 0,
    };
  }).filter(i => i.prix_n !== null && i.prix_n !== 0);

  const zones = new Map(derniereValeur(geo, r => r.zone).map(r => [r.zone, r]));
  const ordre = [...ZONES_DEF.map(z => z.zone), ...[...zones.keys()].filter(z => !ZONES_DEF.some(d => d.zone === z))];
  const geopolitique = ordre.map((zone) => {
    const r = zones.get(zone);
    return {
      zone, source: ZONES_DEF.find(d => d.zone === zone)?.source || null,
      evenement: String(r?.evenement || '').trim(), impact: String(r?.impact || '').trim(), niveau_risque: r?.niveau_risque || null,
    };
  }).filter(z => z.evenement || z.impact || z.niveau_risque);
  return { indicateurs, geopolitique };
}

const getReporting = async (rapport) => {
  const prec = await rapportPrecedent(rapport);
  const [auto, autoPrec, treso, produitsRaw, reco] = await Promise.all([
    getAutonomie(rapport),
    prec ? getAutonomie(prec) : null,
    getTresorerie(rapport),
    Produit.findAll({ where: { del: 0 } }),
    require('./recommandations.service').recommandationDe(rapport.id),
  ]);
  // Produits du document uniquement (les produits de test ou hors liste ne figurent pas au rapport)
  const codes = trier(produitsRaw.map(p => p.code).filter(c => ORDRE.includes(c)));
  const produits = codes.map(c => produitsRaw.find(p => p.code === c));

  const [v, veille] = await Promise.all([ventes(rapport, prec, produits), veilles(rapport)]);

  return {
    date: rapport.date_fin,
    rapport_precedent: prec ? { semaine_iso: prec.semaine_iso, annee: prec.annee } : null,
    // Seul le texte enregistre pour cette semaine : un texte repris a l'ecran doit d'abord etre confirme
    informations_utiles: lignesTexte(reco?.informations_utiles),
    stocks: stocks(auto, autoPrec, produits),
    // Evolution des consommations : variation des quantites servies par rapport a la semaine precedente
    evolution_consommations: v.evolution
      ? produits.map(p => ({ code: p.code, produit: LIBELLES[p.code] || p.libelle, ecart: v.evolution[p.code] })).filter(e => e.ecart !== 0)
      : [],
    // Encours fournisseurs (menu Encours) : cumul par produit, besoin, taux de couverture, planning
    encours: await require('./encoursLivraison.service').getEncours(rapport),
    ventes: v,
    dettes: dettes(treso),
    difficultes: lignesTexte(reco?.risques_majeurs),
    recommandations: lignesTexte(reco?.recommandations),
    veille_marche: veille.indicateurs,
    veille_geopolitique: veille.geopolitique,
  };
};

module.exports = { getReporting, LIBELLES };
