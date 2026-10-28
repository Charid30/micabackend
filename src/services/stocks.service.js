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
// Saisie quotidienne des stocks (stock en bacs, stock en embranchement) et des actions entreprises.
// L'impompable et la consommation moyenne ne sont plus saisis ici : ce sont des valeurs de reference
// (voir referentiel.service.js). Tous les calculs viennent de autonomie.service.js.
const { RapportHebdo, StockDepot, ActionStock, Depot } = require('../models');
const { getOrCreateRapportSemaine } = require('../utils/rapport.utils');
const { getAutonomie } = require('./autonomie.service');
const { frequenceDe, ecrireLigne } = require('./frequence.service');

const today = () => new Date().toISOString().split('T')[0];
const MAX_ACTION = 2000;

// Depot auquel l'utilisateur est limite pour la saisie des stocks (null = tous)
const depotRestreint = (user) => {
  if (user.is_admin) return null;
  return (user.permissions || []).find(p => p.module === 'stocks' && p.depot_id)?.depot_id || null;
};

// Frequence de saisie par type de depot (menus Stocks depots int. et ext.)
const frequencesStocks = async () => ({
  INTERIEUR: await frequenceDe('stocks-int'), EXTERIEUR: await frequenceDe('stocks-ext'),
});

const getSaisieData = async (user, droits) => {
  const rapport = await getOrCreateRapportSemaine(user.id);
  const depotId = depotRestreint(user);
  const date = today();
  const frequences = await frequencesStocks();
  const typeDepot = {}; (await Depot.findAll({ attributes: ['id', 'type'] })).forEach(d => { typeDepot[d.id] = d.type; });
  // Quotidien : stocks du jour uniquement ; hebdomadaire / permanent : derniere saisie de la semaine
  const autonomie = await getAutonomie(rapport, {
    dateStock: date, jourExact: (id) => frequences[typeDepot[id]] === 'QUOTIDIEN', depotIds: depotId ? [depotId] : null,
  });
  return {
    rapport: {
      id: rapport.id, annee: rapport.annee, semaine_iso: rapport.semaine_iso,
      date_debut: rapport.date_debut, date_fin: rapport.date_fin, statut: rapport.statut,
    },
    date_saisie: date,
    frequences,
    droits,
    ...autonomie,
  };
};

/**
 * Enregistre la saisie du jour.
 * lignes : [{ depot_id, produit_id, stock_bacs, stock_embranchement, action }]
 * droits : { stocks: bool, actions: bool } (calcules par le controleur)
 */
const saveSaisie = async (rapportId, lignes, user, droits) => {
  const rapport = await RapportHebdo.findOne({ where: { id: rapportId, del: 0 } });
  if (!rapport) throw { status: 404, message: 'Rapport introuvable.' };
  if (rapport.statut === 'PUBLIE') throw { status: 400, message: 'Ce rapport est déjà publié et ne peut plus être modifié.' };
  if (!droits.stocks && !droits.actions) throw { status: 403, message: 'Accès refusé.' };

  const depotId = depotRestreint(user);
  const depots = await Depot.findAll({ where: { del: 0 } });
  const typeDepot = {}; depots.forEach(d => { typeDepot[d.id] = d.type; });
  const date = today();
  const frequences = await frequencesStocks();

  for (const l of lignes) {
    if (!typeDepot[l.depot_id]) throw { status: 400, message: 'Dépôt inconnu.' };
    if (depotId && l.depot_id !== depotId) continue;   // hors du perimetre de l'utilisateur : ignore

    // ── Quantites du jour
    // Champs laisses vides : rien n'est enregistre (la derniere valeur saisie reste valable)
    const renseigne = (v) => v !== undefined && v !== null && v !== '';
    if (droits.stocks && (renseigne(l.stock_bacs) || renseigne(l.stock_embranchement))) {
      const bacs = Number(l.stock_bacs) || 0;
      // Le stock en embranchement ne concerne que les depots interieurs
      const embr = typeDepot[l.depot_id] === 'INTERIEUR' ? (Number(l.stock_embranchement) || 0) : 0;
      // Stock negatif possible a l'exterieur (dette de produit), jamais a l'interieur
      if (typeDepot[l.depot_id] === 'INTERIEUR' && (bacs < 0 || embr < 0)) {
        throw { status: 400, message: 'Un stock de dépôt intérieur ne peut pas être négatif.' };
      }
      await ecrireLigne(StockDepot, { rapport_id: rapportId, depot_id: l.depot_id, produit_id: l.produit_id },
        { stock_bacs: bacs, stock_embranchement: embr, stock_disponible: bacs + embr }, frequences[typeDepot[l.depot_id]], user.id);
    }

    // ── Action entreprise (DSTA)
    if (droits.actions && l.action !== undefined) {
      const texte = String(l.action ?? '').trim().slice(0, MAX_ACTION);
      const row = await ActionStock.findOne({ where: { rapport_id: rapportId, depot_id: l.depot_id, produit_id: l.produit_id, del: 0 } });
      if (row) { if (row.action !== texte) await row.update({ action: texte, updated_by: user.id, updated_at: new Date() }); }
      else if (texte) await ActionStock.create({ rapport_id: rapportId, depot_id: l.depot_id, produit_id: l.produit_id, action: texte, created_by: user.id });
    }
  }

  // Autonomie et impompable de reference memorises sur les lignes du jour (lecture directe, historique)
  if (droits.stocks) {
    const calc = await getAutonomie(rapport, { dateStock: date, jourExact: true });
    const lignesCalc = [...calc.depots_interieurs, ...calc.depots_exterieurs]
      .flatMap(d => d.lignes.map(x => ({ ...x, depot_id: d.depot_id })));
    const rows = await StockDepot.findAll({ where: { rapport_id: rapportId, date_saisie: date, del: 0 } });
    for (const row of rows) {
      const c = lignesCalc.find(x => x.depot_id === row.depot_id && x.produit_id === row.produit_id);
      if (c) await row.update({ autonomie: c.autonomie ?? 0, stock_impompable: c.impompable ?? 0 });
    }
  }
  return { message: 'Saisie enregistrée avec succès.' };
};

module.exports = { getSaisieData, saveSaisie };
