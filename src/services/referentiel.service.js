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
// Referentiel des stocks : valeurs "figees", revues periodiquement, historisees par date d'effet.
//  - impompable et consommation moyenne par depot interieur x produit
//      droit "impompable" (responsables de depot), eventuellement limite a un depot
//  - besoin journalier exterieur par produit, exclusion d'une ligne du total exterieur,
//    parametres de calcul (seuil rouge, objectif de couverture, densite du gaz)
//      droit "referentiel-stocks" (personne designee, ex. DSTA)
// Une modification n'efface jamais l'ancienne valeur : elle cree une valeur en vigueur a la date d'effet,
// ce qui garde les rapports deja publies inchanges.
const { Depot, Produit, ReferentielStock, BesoinExterieur, Parametre, Utilisateur } = require('../models');
const { chargerParametres, trierProduits } = require('./autonomie.service');

const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };

const droitsDe = (user) => {
  const perms = user.permissions ?? [];
  const peut = (module, action) => user.is_admin || perms.some(p => p.module === module &&
    (action === 'READ' ? ['READ', 'WRITE'].includes(p.action) : p.action === 'WRITE'));
  const depotImpompable = user.is_admin ? null
    : (perms.find(p => p.module === 'impompable' && p.action === 'WRITE' && p.depot_id)?.depot_id || null);
  return {
    depots: peut('impompable', 'WRITE'), depot_restreint: depotImpompable,
    exterieur: peut('referentiel-stocks', 'WRITE'),
  };
};

// Derniere valeur connue par cle (la plus recente date d'effet ; a egalite, la plus recente saisie)
const derniere = (rows, keyFn) => {
  const out = {};
  for (const r of [...rows].sort((a, b) => String(a.date_effet).localeCompare(String(b.date_effet)) || a.id - b.id)) out[keyFn(r)] = r;
  return out;
};

const getReferentiel = async (user) => {
  const [depots, produitsRaw, refs, besoins, params] = await Promise.all([
    Depot.findAll({ where: { del: 0 }, order: [['id', 'ASC']] }),
    Produit.findAll({ where: { del: 0 } }),
    ReferentielStock.findAll({ where: { del: 0 } }),
    BesoinExterieur.findAll({ where: { del: 0 } }),
    chargerParametres(),
  ]);
  const produits = trierProduits(produitsRaw);
  const refIdx = derniere(refs, r => `${r.depot_id}_${r.produit_id}`);
  const besoinIdx = derniere(besoins, r => String(r.produit_id));

  const ligne = (d, p) => {
    const r = refIdx[`${d.id}_${p.id}`];
    return {
      depot_id: d.id, produit_id: p.id, produit_code: p.code, produit_libelle: p.libelle,
      impompable: r ? num(r.impompable) : 0, conso_moyenne: r ? num(r.conso_moyenne) : 0,
      exclu_total: r ? !!r.exclu_total : false, date_effet: r ? r.date_effet : null,
    };
  };

  // Historique des 50 dernieres modifications (qui, quand, quoi)
  const auteurs = {};
  const ids = [...new Set([...refs, ...besoins].map(r => r.created_by).filter(Boolean))];
  if (ids.length) (await Utilisateur.findAll({ where: { id: ids }, attributes: ['id', 'username'] })).forEach(u => { auteurs[u.id] = u.username; });
  const depotNom = {}; depots.forEach(d => { depotNom[d.id] = d.libelle; });
  const produitNom = {}; produits.forEach(p => { produitNom[p.id] = p.libelle; });
  const historique = [
    ...refs.map(r => ({ type: 'depot', libelle: `${depotNom[r.depot_id] || '?'} - ${produitNom[r.produit_id] || '?'}`,
      detail: `impompable ${num(r.impompable)} m³, consommation ${num(r.conso_moyenne)} m³/j${r.exclu_total ? ', exclu du total' : ''}`,
      date_effet: r.date_effet, saisi_le: r.created_at, par: auteurs[r.created_by] || null })),
    ...besoins.map(b => ({ type: 'besoin', libelle: `Besoin extérieur - ${produitNom[b.produit_id] || '?'}`,
      detail: `${num(b.besoin_journalier)} m³/j`, date_effet: b.date_effet, saisi_le: b.created_at, par: auteurs[b.created_by] || null })),
  ].sort((a, b) => new Date(b.saisi_le) - new Date(a.saisi_le)).slice(0, 50);

  return {
    droits: droitsDe(user),
    parametres: { seuil_rouge_jours: params.seuilRouge, couverture_objectif_pct: params.couvertureObjectif, densite_gaz: params.densiteGaz },
    depots_interieurs: depots.filter(d => d.type === 'INTERIEUR').map(d => ({ depot_id: d.id, depot_code: d.code, depot_libelle: d.libelle, lignes: produits.map(p => ligne(d, p)) })),
    depots_exterieurs: depots.filter(d => d.type === 'EXTERIEUR').map(d => ({ depot_id: d.id, depot_code: d.code, depot_libelle: d.libelle, pays: d.pays, lignes: produits.map(p => ligne(d, p)) })),
    // Densite a 15 °C : conversion en litres des quantites achetees en tonnes (encours de livraison)
    densites: produits.map(p => ({ produit_id: p.id, produit_code: p.code, produit_libelle: p.libelle,
      densite: p.densite_t_m3 === null ? null : num(p.densite_t_m3), en_kg: p.code === 'GAZ' })),
    besoins: produits.map(p => ({ produit_id: p.id, produit_code: p.code, produit_libelle: p.libelle,
      besoin_journalier: besoinIdx[p.id] ? num(besoinIdx[p.id].besoin_journalier) : 0, date_effet: besoinIdx[p.id]?.date_effet || null })),
    historique,
  };
};

// Enregistre une valeur en vigueur a date_effet (met a jour celle du meme jour si elle existe)
const upsertAEffet = async (Model, where, valeurs, dateEffet, userId) => {
  const row = await Model.findOne({ where: { ...where, date_effet: dateEffet, del: 0 } });
  if (row) return row.update({ ...valeurs, updated_by: userId, updated_at: new Date() });
  return Model.create({ ...where, ...valeurs, date_effet: dateEffet, created_by: userId, updated_by: userId });
};

const saveDepots = async (user, lignes, dateEffet) => {
  const d = droitsDe(user);
  if (!d.depots && !d.exterieur) throw { status: 403, message: 'Accès refusé.' };
  const depots = await Depot.findAll({ where: { del: 0 } });
  const typeDepot = {}; depots.forEach(x => { typeDepot[x.id] = x.type; });
  const refs = await ReferentielStock.findAll({ where: { del: 0 } });
  const actuel = derniere(refs, r => `${r.depot_id}_${r.produit_id}`);
  let modifiees = 0;

  for (const l of lignes) {
    const type = typeDepot[l.depot_id];
    if (!type) throw { status: 400, message: 'Dépôt inconnu.' };
    const cur = actuel[`${l.depot_id}_${l.produit_id}`];
    const valeurs = {
      impompable: cur ? num(cur.impompable) : 0,
      conso_moyenne: cur ? num(cur.conso_moyenne) : 0,
      exclu_total: cur ? cur.exclu_total : 0,
    };
    // Impompable et consommation : depots interieurs, droit "impompable" (eventuellement limite a un depot)
    if (type === 'INTERIEUR' && d.depots && (!d.depot_restreint || d.depot_restreint === l.depot_id)) {
      if (l.impompable !== undefined && l.impompable !== null) valeurs.impompable = num(l.impompable);
      if (l.conso_moyenne !== undefined && l.conso_moyenne !== null) valeurs.conso_moyenne = num(l.conso_moyenne);
    }
    // Exclusion du total : depots exterieurs, droit "referentiel-stocks"
    if (type === 'EXTERIEUR' && d.exterieur && l.exclu_total !== undefined && l.exclu_total !== null) {
      valeurs.exclu_total = [true, 'true', 1, '1'].includes(l.exclu_total) ? 1 : 0;
    }
    const change = !cur || num(cur.impompable) !== valeurs.impompable || num(cur.conso_moyenne) !== valeurs.conso_moyenne
      || Number(cur.exclu_total) !== Number(valeurs.exclu_total);
    if (!change) continue;
    await upsertAEffet(ReferentielStock, { depot_id: l.depot_id, produit_id: l.produit_id }, valeurs, dateEffet, user.id);
    modifiees++;
  }
  return { message: modifiees ? `${modifiees} valeur(s) enregistrée(s), en vigueur à partir du ${dateEffet}.` : 'Aucune modification.' };
};

const saveBesoins = async (user, besoins, dateEffet) => {
  if (!droitsDe(user).exterieur) throw { status: 403, message: 'Accès refusé : droit « Référentiel stocks » requis.' };
  const actuel = derniere(await BesoinExterieur.findAll({ where: { del: 0 } }), r => String(r.produit_id));
  let modifiees = 0;
  for (const b of besoins) {
    const valeur = num(b.besoin_journalier);
    if (actuel[b.produit_id] && num(actuel[b.produit_id].besoin_journalier) === valeur) continue;
    await upsertAEffet(BesoinExterieur, { produit_id: b.produit_id }, { besoin_journalier: valeur }, dateEffet, user.id);
    modifiees++;
  }
  return { message: modifiees ? `${modifiees} besoin(s) enregistré(s), en vigueur à partir du ${dateEffet}.` : 'Aucune modification.' };
};

const saveParametres = async (user, { seuil_rouge_jours, couverture_objectif_pct, densite_gaz }) => {
  if (!droitsDe(user).exterieur) throw { status: 403, message: 'Accès refusé : droit « Référentiel stocks » requis.' };
  const valeurs = {
    AUTONOMIE_SEUIL_ROUGE_JOURS: seuil_rouge_jours, COUVERTURE_OBJECTIF_PCT: couverture_objectif_pct, GAZ_DENSITE_T_M3: densite_gaz,
  };
  for (const [cle, valeur] of Object.entries(valeurs)) {
    const p = await Parametre.findOne({ where: { cle } });
    if (p) await p.update({ valeur: String(valeur), updated_by: user.id, updated_at: new Date() });
    else await Parametre.create({ cle, valeur: String(valeur), created_by: user.id });
  }
  return { message: 'Paramètres de calcul enregistrés.' };
};

const saveDensites = async (user, densites) => {
  if (!droitsDe(user).exterieur) throw { status: 403, message: 'Accès refusé : droit « Référentiel stocks » requis.' };
  let modifiees = 0;
  for (const d of densites) {
    const produit = await Produit.findOne({ where: { id: d.produit_id, del: 0 } });
    if (!produit || produit.code === 'GAZ') continue;       // gaz : tonnes exprimees en kg, pas de densite
    if (produit.densite_t_m3 !== null && num(produit.densite_t_m3) === num(d.densite)) continue;
    await produit.update({ densite_t_m3: d.densite, updated_by: user.id, updated_at: new Date() });
    modifiees++;
  }
  return { message: modifiees ? `${modifiees} densité(s) enregistrée(s).` : 'Aucune modification.' };
};

module.exports = { getReferentiel, saveDepots, saveBesoins, saveParametres, saveDensites };
