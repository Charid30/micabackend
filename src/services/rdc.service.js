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
// Menu RDC : etat quotidien des depots cotiers, chargements camion par camion, receptions.
// Les camions charges et le tableau des tonnes viennent des chargements de la veille de l'etat ;
// tous les totaux sont calcules, jamais saisis.
// Trois facons de saisir un camion :
//  - CALCUL : temperature, densite et volume ambiant ; MICA calcule le reste et le conserve sur la ligne
//    (changer de formule ne modifie pas les jours passes) ;
//  - GPL : quantite directe en kg (temperature et densite facultatives) ;
//  - QUANTITES (APD/BOST) : quantite a 20 °C et quantite observee, sans tonnage ;
//  - VOLUMES (STSL au Togo) : volume ambiant et volume a 15 °C du depot, sans tonnage.
const { Op, UniqueConstraintError } = require('sequelize');
const {
  sequelize, RdcDepot, RdcDestination, RdcStock, RdcAttente, RdcBesoin, RdcChargement, RdcReception,
} = require('../models');
const { aujourdhui } = require('./frequence.service');

const PAYS = { ghana: 'GHANA', benin: 'BENIN', 'cote-ivoire': 'CI', togo: 'TOGO' };
const PRODUITS = [
  { code: 'SUPER', libelle: 'Super' }, { code: 'PETROLE', libelle: 'Pétrole' }, { code: 'GASOIL', libelle: 'Gasoil' },
  { code: 'DDO', libelle: 'DDO' }, { code: 'FUEL', libelle: 'Fuel 180' }, { code: 'JET', libelle: 'Jet A1' },
  { code: 'BUTANE', libelle: 'Butane' },
];
// Colonnes du tableau des tonnes, selon l'etat de chaque pays
const BINGO = { code: 'BINGO', libelle: 'Bingo' };
const BOBO = { code: 'BOBO', libelle: 'Bobo' };
const PENI = { code: 'PENI', libelle: 'Péni' };
const FIN_COLONNES = [
  { code: 'SONABEL', libelle: 'SONABEL' }, { code: 'MINES', libelle: 'Mines' }, { code: 'AVIATION', libelle: 'Aviation' },
  { code: 'A_CLASSER', libelle: 'À classer' },
];
const COLONNES = {
  GHANA: [BINGO, BOBO, ...FIN_COLONNES], BENIN: [BINGO, PENI, ...FIN_COLONNES], CI: [BINGO, BOBO, PENI, ...FIN_COLONNES],
  TOGO: [BINGO, BOBO, PENI, ...FIN_COLONNES],
};
const UNITES = ['TM', 'M3', 'M315'];     // M3 : m³ ambiant ; M315 : m³ a 15 °C
// Etat du pays : tableau des chargements en tonnes, ou en nombre de camions (comme les etats du Benin et du Togo)
const CHARGEMENTS_EN_CAMIONS = ['BENIN', 'TOGO'];
const STATUTS = ['PREVU', 'EN_COURS', 'LIVRE'];
const VOLUME_MAX = 1000000000;
const BESOIN_MAX = 100000;
const ENTIER_MAX = 4000000000;      // INT UNSIGNED
const JOURS_RECEPTIONS = 30;        // receptions reprises dans l'etat du jour
const TEMPERATURE_REFERENCE = 15;

const erreur = (message, status = 400) => ({ status, message });

const paysDe = (slug) => {
  const pays = PAYS[slug];
  if (!pays) throw erreur('Pays inconnu.', 404);
  return pays;
};

const verifierDate = (date) => {
  const d = new Date(`${date}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date)) || Number.isNaN(d.getTime()) || d.toISOString().split('T')[0] !== date) {
    throw erreur('Date invalide.');
  }
  return date;
};

const pasDansLeFutur = (date) => {
  verifierDate(date);
  if (date > aujourdhui()) throw erreur('Impossible d\'enregistrer une date à venir.');
};

const veille = (date) => new Date(new Date(`${date}T00:00:00Z`).getTime() - 86400000).toISOString().split('T')[0];

const nombre = (v, libelle, { min = 0, max = VOLUME_MAX, entier = false } = {}) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max || (entier && !Number.isInteger(n))) {
    throw erreur(`${libelle} : ${entier ? `un nombre entier${min === 0 ? ' positif' : ''}` : `une valeur entre ${min} et ${max}`} est attendu${entier ? '' : 'e'}.`);
  }
  return n;
};

const requis = (v, libelle) => {
  if (v === null) throw erreur(`${libelle} : valeur obligatoire.`);
  return v;
};

const texte = (v, max) => {
  const t = typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, max) : '';
  return t || null;
};

const produitValide = (code) => {
  if (!PRODUITS.some(p => p.code === code)) throw erreur('Produit inconnu.');
  return code;
};

const depotsDu = (pays) => RdcDepot.findAll({ where: { pays, del: 0 }, order: [['ordre', 'ASC'], ['id', 'ASC']] });

const depotDu = async (pays, id) => {
  const depot = await RdcDepot.findOne({ where: { id: Number(id) || 0, pays, del: 0 } });
  if (!depot) throw erreur('Dépôt inconnu.');
  return depot;
};

// ── Calculs d'un camion : memes tables que le fichier des chargements (ASTM 54B)
// La branche 0,770-0,7875 du fichier comporte une faute de cellule (densite au lieu de la temperature
// de reference) ; elle est corrigee ici et ne concerne aucun produit charge a ce jour.
const coefficient = (densite) => {
  const d = densite / 1000;        // g/ml
  if (d < 0.653 || d > 1.075) return null;
  if (d <= 0.77) return (346.4228 + 438.8 * d) / densite ** 2;
  if (d <= 0.7875) return -0.00336312 + 2680.3206 / densite ** 2;
  if (d <= 0.8385) return 594.5418 / densite ** 2;
  return (186.9696 + 486.2 * d) / densite ** 2;
};

// Le VCF imprime par le depot prime s'il est saisi : Quantum et Petrohub ont leur propre coefficient
// (Quantum garde le meme toute une journee), different du calcul a la temperature du camion.
const calculer = ({ temperature, densite, volume_ambiant: litres, vcf: vcfDepot = null }) => {
  const a = coefficient(densite);
  const ecart = temperature - TEMPERATURE_REFERENCE;
  const vcf = vcfDepot ?? Math.exp(-ecart * a * (1 + 0.8 * ecart * a));
  const d = densite / 1000;
  const volume15 = litres / 1000 * vcf;
  return { vcf, volume_15: volume15, tonnes_vide: litres * d * vcf / 1000, tonnes_air: volume15 * (d - 0.0011) };
};

// Valeurs d'un camion a partir du formulaire
const valeursCamion = (c, depot, produit) => {
  const base = {
    date_chargement: verifierDate(c.date_chargement), depot_id: depot.id, produit,
    bon: texte(c.bon, 40), commande: texte(c.commande, 40), bl: texte(c.bl, 40), tracteur: texte(c.tracteur, 20),
    remorque: texte(c.remorque, 20), destination: texte(c.destination, 80),
    temperature: null, densite: null, volume_ambiant: null, quantite_20: null, quantite_kg: null,
    vcf_depot: null, vcf: null, volume_15: null, tonnes_vide: null, tonnes_air: null,
  };
  pasDansLeFutur(base.date_chargement);
  if (!base.bon) throw erreur('Le numéro de bon est obligatoire.');
  if (!base.destination) throw erreur('La destination est obligatoire.');

  const temperature = nombre(c.temperature, 'Température', { min: -20, max: 80 });
  const densite = nombre(c.densite, 'Densité', { min: 400, max: 1100 });
  if (depot.mode_saisie === 'VOLUMES' && produit !== 'BUTANE') {
    const litres15 = requis(nombre(c.volume_15_l, 'Volume à 15 °C', { entier: true, max: ENTIER_MAX }), 'Volume à 15 °C');
    return {
      ...base,
      volume_ambiant: requis(nombre(c.volume_ambiant, 'Volume ambiant', { entier: true, max: ENTIER_MAX }), 'Volume ambiant'),
      volume_15: litres15 / 1000,
    };
  }
  if (depot.mode_saisie === 'QUANTITES') {
    return {
      ...base,
      quantite_20: requis(nombre(c.quantite_20, 'Quantité à 20 °C', { entier: true, max: ENTIER_MAX }), 'Quantité à 20 °C'),
      volume_ambiant: requis(nombre(c.volume_ambiant, 'Quantité observée', { entier: true, max: ENTIER_MAX }), 'Quantité observée'),
    };
  }
  if (produit === 'BUTANE') {
    const kg = requis(nombre(c.quantite_kg, 'Quantité (kg)', { entier: true, max: ENTIER_MAX }), 'Quantité (kg)');
    return { ...base, temperature, densite, quantite_kg: kg, tonnes_air: kg / 1000 };
  }
  requis(temperature, 'Température');
  requis(densite, 'Densité');
  if (coefficient(densite) === null) throw erreur('Densité : une valeur entre 653 et 1075 kg/m³ est attendue.');
  const litres = requis(nombre(c.volume_ambiant, 'Volume ambiant', { entier: true, max: ENTIER_MAX }), 'Volume ambiant');
  const vcf = nombre(c.vcf_depot, 'VCF du dépôt', { min: 0.9, max: 1.05 });
  return { ...base, temperature, densite, volume_ambiant: litres, vcf_depot: vcf, ...calculer({ temperature, densite, volume_ambiant: litres, vcf }) };
};

const cleTexte = (t) => String(t || '').trim().normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();

// Destination -> colonne du tableau des tonnes ; inconnue de la liste : « A classer »
const colonnesDes = async (pays) => {
  const destinations = await RdcDestination.findAll({ where: { pays, del: 0 }, order: [['libelle', 'ASC']] });
  const map = new Map(destinations.map(d => [cleTexte(d.libelle), d.colonne]));
  return { destinations, colonneDe: (destination) => map.get(cleTexte(destination)) || 'A_CLASSER' };
};

const ouvertures = async (pays) => ({ produits: PRODUITS, colonnes: COLONNES[pays], depots: await depotsDu(pays) });

// ── Etat du jour
const getEtat = async (slug, date = aujourdhui()) => {
  const pays = paysDe(slug);
  verifierDate(date);
  const hier = veille(date);
  const { produits, colonnes, depots } = await ouvertures(pays);
  const depotIds = depots.map(d => d.id);
  const debutReceptions = new Date(new Date(`${date}T00:00:00Z`).getTime() - JOURS_RECEPTIONS * 86400000).toISOString().split('T')[0];
  const [stocks, attentes, besoins, besoinsPrecedents, chargements, receptions, { destinations, colonneDe }] = await Promise.all([
    RdcStock.findAll({ where: { pays, date_saisie: date, del: 0 } }),
    RdcAttente.findAll({ where: { date_saisie: date, depot_id: depotIds, del: 0 } }),
    RdcBesoin.findAll({ where: { pays, date_saisie: date, del: 0 } }),
    RdcBesoin.findAll({ where: { pays, date_saisie: { [Op.lt]: date }, del: 0 }, order: [['date_saisie', 'DESC']], limit: 500 }),
    RdcChargement.findAll({ where: { date_chargement: hier, depot_id: depotIds, del: 0 }, attributes: ['depot_id', 'produit', 'destination', 'tonnes_air'] }),
    RdcReception.findAll({ where: { pays, date_reception: { [Op.between]: [debutReceptions, date] }, del: 0 }, order: [['date_reception', 'DESC'], ['id', 'DESC']] }),
    colonnesDes(pays),
  ]);

  const charges = {};
  const tonnes = {};
  const camions = {};
  let sansTonnage = 0;
  for (const c of chargements) {
    charges[`${c.depot_id}_${c.produit}`] = (charges[`${c.depot_id}_${c.produit}`] || 0) + 1;
    const cle = `${c.produit}_${colonneDe(c.destination)}`;
    camions[cle] = (camions[cle] || 0) + 1;
    if (c.tonnes_air === null) { sansTonnage += 1; continue; }
    tonnes[cle] = (tonnes[cle] || 0) + Number(c.tonnes_air);
  }

  const reprise = (code) => besoinsPrecedents.find(b => b.produit === code);
  return {
    pays, date, aujourdhui: aujourdhui(), veille: hier, saisie_faite: stocks.length > 0,
    produits, colonnes, depots: depots.map(d => ({ id: d.id, libelle: d.libelle, mode_saisie: d.mode_saisie })),
    stocks: stocks.map(s => ({ depot_id: s.depot_id, produit: s.produit, volume: Number(s.volume) })),
    attentes: attentes.map(a => ({ depot_id: a.depot_id, produit: a.produit, camions: a.camions })),
    charges, tonnes, camions, sans_tonnage: sansTonnage,
    chargements_en: CHARGEMENTS_EN_CAMIONS.includes(pays) ? 'CAMIONS' : 'TONNES',
    besoins: PRODUITS.map((p) => {
      const b = besoins.find(x => x.produit === p.code) || reprise(p.code);
      return { produit: p.code, libelle: p.libelle, quantite: b?.quantite ?? null, repartition: b?.repartition ?? null };
    }),
    receptions: receptions.map(r => ligneReception(r, depots)),
    destinations: destinations.map(d => ({ id: d.id, libelle: d.libelle, colonne: d.colonne })),
  };
};

// Met a jour la cellule du jour ; une cellule videe est retiree, une cellule vide n'est pas creee
const ecrireCellule = async (Model, where, valeurs, renseignee, userId, transaction) => {
  const row = await Model.findOne({ where, transaction });
  if (row) return row.update({ ...valeurs, del: renseignee ? 0 : 1, updated_by: userId, updated_at: new Date() }, { transaction });
  if (renseignee) await Model.create({ ...where, ...valeurs, created_by: userId }, { transaction });
  return null;
};

const cellulesValides = (cellules, depots) => {
  const ids = new Set(depots.map(d => d.id));
  return (Array.isArray(cellules) ? cellules : []).slice(0, depots.length * PRODUITS.length).map((c) => {
    if (!ids.has(Number(c?.depot_id))) throw erreur('Dépôt inconnu.');
    return { ...c, depot_id: Number(c.depot_id), produit: produitValide(c.produit) };
  });
};

const saveEtat = async (slug, { date, stocks, attentes, besoins }, userId) => {
  const pays = paysDe(slug);
  pasDansLeFutur(date);
  const depots = await depotsDu(pays);
  const lignesStocks = cellulesValides(stocks, depots).map(c => ({ ...c, volume: nombre(c.volume, 'Stock', { min: -VOLUME_MAX }) }));
  const lignesAttentes = cellulesValides(attentes, depots).map(c => ({ ...c, camions: nombre(c.camions, 'Camions en attente', { entier: true, max: 100000 }) }));
  const lignesBesoins = (Array.isArray(besoins) ? besoins : []).slice(0, PRODUITS.length).map(b => ({
    produit: produitValide(b?.produit),
    quantite: nombre(b?.quantite, 'Besoin en camions', { entier: true, min: -BESOIN_MAX, max: BESOIN_MAX }),
    repartition: texte(b?.repartition, 255),
  }));

  await sequelize.transaction(async (t) => {
    for (const s of lignesStocks) {
      await ecrireCellule(RdcStock, { pays, date_saisie: date, depot_id: s.depot_id, produit: s.produit }, { volume: s.volume }, s.volume !== null, userId, t);
    }
    for (const a of lignesAttentes) {
      await ecrireCellule(RdcAttente, { date_saisie: date, depot_id: a.depot_id, produit: a.produit }, { camions: a.camions }, a.camions !== null, userId, t);
    }
    for (const b of lignesBesoins) {
      await ecrireCellule(RdcBesoin, { pays, date_saisie: date, produit: b.produit },
        { quantite: b.quantite, repartition: b.repartition }, b.quantite !== null || !!b.repartition, userId, t);
    }
  });
  return { message: 'État du jour enregistré.', ...(await getEtat(slug, date)) };
};

// ── Chargements
const ligneChargement = (c, depots) => ({
  id: c.id, date_chargement: c.date_chargement, depot_id: c.depot_id,
  depot: depots.find(d => d.id === c.depot_id)?.libelle || '', produit: c.produit,
  bon: c.bon, commande: c.commande, bl: c.bl, tracteur: c.tracteur, remorque: c.remorque, destination: c.destination,
  temperature: c.temperature === null ? null : Number(c.temperature), densite: c.densite === null ? null : Number(c.densite),
  volume_ambiant: c.volume_ambiant, quantite_20: c.quantite_20, quantite_kg: c.quantite_kg,
  vcf_depot: c.vcf_depot === null ? null : Number(c.vcf_depot),
  vcf: c.vcf === null ? null : Number(c.vcf), volume_15: c.volume_15 === null ? null : Number(c.volume_15),
  tonnes_vide: c.tonnes_vide === null ? null : Number(c.tonnes_vide), tonnes_air: c.tonnes_air === null ? null : Number(c.tonnes_air),
});

// Totaux par depot et produit
const synthese = (lignes) => {
  const map = new Map();
  for (const l of lignes) {
    const cle = `${l.depot_id}_${l.produit}`;
    const t = map.get(cle) || { depot_id: l.depot_id, produit: l.produit, camions: 0, volume_ambiant: 0, tonnes_air: 0 };
    t.camions += 1;
    t.volume_ambiant += Number(l.volume_ambiant) || 0;
    t.tonnes_air += Number(l.tonnes_air) || 0;
    map.set(cle, t);
  }
  return [...map.values()];
};

const getChargements = async (slug, date = aujourdhui()) => {
  const pays = paysDe(slug);
  verifierDate(date);
  const depots = await depotsDu(pays);
  const depotIds = depots.map(d => d.id);
  const { destinations } = await colonnesDes(pays);
  const [duJour, duMois] = await Promise.all([
    RdcChargement.findAll({ where: { date_chargement: date, depot_id: depotIds, del: 0 }, order: [['id', 'DESC']] }),
    RdcChargement.findAll({
      where: { date_chargement: { [Op.between]: [`${date.slice(0, 7)}-01`, date] }, depot_id: depotIds, del: 0 },
      attributes: ['depot_id', 'produit', 'volume_ambiant', 'tonnes_air'],
    }),
  ]);
  return {
    date, aujourdhui: aujourdhui(), produits: PRODUITS,
    depots: depots.map(d => ({ id: d.id, libelle: d.libelle, mode_saisie: d.mode_saisie })),
    destinations: destinations.map(d => d.libelle),
    lignes: duJour.map(c => ligneChargement(c, depots)),
    du_jour: synthese(duJour), du_mois: synthese(duMois),
  };
};

const verifierBon = async (depot, bon, id, transaction) => {
  const existant = await RdcChargement.findOne({ where: { depot_id: depot.id, bon, ...(id ? { id: { [Op.ne]: id } } : {}) }, transaction });
  if (existant) {
    throw erreur(`Le bon ${bon} est déjà enregistré pour ${depot.libelle} (camion du ${String(existant.date_chargement).split('-').reverse().join('/')}).`);
  }
};

// Deux enregistrements simultanes du meme bon : la contrainte d'unicite tranche
const sansDoublon = async (bon, action) => {
  try { return await action(); } catch (e) {
    if (e instanceof UniqueConstraintError) throw erreur(`Le bon ${bon} est déjà enregistré.`);
    throw e;
  }
};

const ajouterChargement = async (slug, corps, userId) => {
  const pays = paysDe(slug);
  const depot = await depotDu(pays, corps?.depot_id);
  const valeurs = valeursCamion(corps, depot, produitValide(corps?.produit));
  await verifierBon(depot, valeurs.bon);
  const c = await sansDoublon(valeurs.bon, () => RdcChargement.create({ ...valeurs, created_by: userId }));
  return { message: 'Chargement enregistré.', id: c.id };
};

const chargementDu = async (pays, id) => {
  const depots = await depotsDu(pays);
  const c = await RdcChargement.findOne({ where: { id: Number(id) || 0, depot_id: depots.map(d => d.id), del: 0 } });
  if (!c) throw erreur('Chargement introuvable.', 404);
  return c;
};

const modifierChargement = async (slug, id, corps, userId) => {
  const pays = paysDe(slug);
  const c = await chargementDu(pays, id);
  const depot = await depotDu(pays, corps?.depot_id);
  const valeurs = valeursCamion(corps, depot, produitValide(corps?.produit));
  await verifierBon(depot, valeurs.bon, c.id);
  await sansDoublon(valeurs.bon, () => c.update({ ...valeurs, updated_by: userId, updated_at: new Date() }));
  return { message: 'Chargement modifié.' };
};

const supprimerChargement = async (slug, id, userId) => {
  const c = await chargementDu(paysDe(slug), id);
  await c.update({ del: 1, bon_origine: c.bon, bon: null, deleted_by: userId, deleted_at: new Date() });
  return { message: 'Chargement supprimé.' };
};

// ── Receptions
const ligneReception = (r, depots) => ({
  id: r.id, date_reception: r.date_reception, date_fin: r.date_fin, numero_eme: r.numero_eme, accostage: r.accostage,
  fournisseur: r.fournisseur, depot_id: r.depot_id, lieu_livraison: r.lieu_livraison, type_operation: r.type_operation,
  // Lieu affiche : le depot suivi, ou le lieu saisi (ex. ZENER au Togo)
  depot: depots.find(d => d.id === r.depot_id)?.libelle || r.lieu_livraison || '', produit: r.produit,
  quantite: Number(r.quantite), unite: r.unite, statut: r.statut,
});

const getReceptions = async (slug) => {
  const pays = paysDe(slug);
  const depots = await depotsDu(pays);
  const rows = await RdcReception.findAll({
    where: { pays, del: 0 }, order: [['date_reception', 'DESC'], ['id', 'DESC']], limit: 300,
  });
  return {
    produits: PRODUITS, unites: UNITES, statuts: STATUTS,
    depots: depots.map(d => ({ id: d.id, libelle: d.libelle })),
    lignes: rows.map(r => ligneReception(r, depots)),
  };
};

// Lieu de livraison : un depot suivi, ou un autre lieu saisi ; fournisseur ou type d'operation obligatoire
const valeursReception = async (pays, corps) => {
  const lieu = texte(corps?.lieu_livraison, 80);
  const depot = corps?.depot_id || !lieu ? await depotDu(pays, corps?.depot_id) : null;
  const fournisseur = texte(corps?.fournisseur, 120);
  const typeOperation = texte(corps?.type_operation, 40);
  if (!fournisseur && !typeOperation) throw erreur('Le fournisseur ou le type d\'opération est obligatoire.');
  if (!UNITES.includes(corps?.unite)) throw erreur('Unité inconnue.');
  if (!STATUTS.includes(corps?.statut)) throw erreur('Statut inconnu.');
  const dateReception = verifierDate(corps?.date_reception);
  const dateFin = corps?.date_fin ? verifierDate(corps.date_fin) : null;
  if (dateFin && dateFin < dateReception) throw erreur('La fin de la période précède son début.');
  return {
    date_reception: dateReception, date_fin: dateFin, numero_eme: texte(corps?.numero_eme, 40), accostage: texte(corps?.accostage, 80),
    pays, fournisseur, type_operation: typeOperation, depot_id: depot?.id || null, lieu_livraison: depot ? null : lieu,
    produit: produitValide(corps?.produit), unite: corps.unite, statut: corps.statut,
    quantite: requis(nombre(corps?.quantite, 'Quantité'), 'Quantité'),
  };
};

const ajouterReception = async (slug, corps, userId) => {
  await RdcReception.create({ ...(await valeursReception(paysDe(slug), corps)), created_by: userId });
  return { message: 'Réception enregistrée.' };
};

const receptionDu = async (pays, id) => {
  const r = await RdcReception.findOne({ where: { id: Number(id) || 0, pays, del: 0 } });
  if (!r) throw erreur('Réception introuvable.', 404);
  return r;
};

const modifierReception = async (slug, id, corps, userId) => {
  const pays = paysDe(slug);
  const r = await receptionDu(pays, id);
  await r.update({ ...(await valeursReception(pays, corps)), updated_by: userId, updated_at: new Date() });
  return { message: 'Réception modifiée.' };
};

const supprimerReception = async (slug, id, userId) => {
  const r = await receptionDu(paysDe(slug), id);
  await r.update({ del: 1, deleted_by: userId, deleted_at: new Date() });
  return { message: 'Réception supprimée.' };
};

// ── Destinations (administrateurs)
const colonneValide = (pays, code) => {
  if (!COLONNES[pays].some(c => c.code === code)) throw erreur('Colonne inconnue.');
  return code;
};

const ajouterDestination = async (slug, corps, userId) => {
  const pays = paysDe(slug);
  const libelle = texte(corps?.libelle, 80);
  if (!libelle) throw erreur('Le nom de la destination est obligatoire.');
  const colonne = colonneValide(pays, corps?.colonne);
  const existante = await RdcDestination.findOne({ where: { pays, libelle } });
  if (existante && !existante.del) throw erreur('Cette destination existe déjà.');
  if (existante) await existante.update({ colonne, del: 0, updated_by: userId, updated_at: new Date() });
  else await RdcDestination.create({ pays, libelle, colonne, created_by: userId });
  return { message: 'Destination ajoutée.' };
};

const modifierDestination = async (slug, id, corps, userId) => {
  const pays = paysDe(slug);
  const d = await RdcDestination.findOne({ where: { id: Number(id) || 0, pays, del: 0 } });
  if (!d) throw erreur('Destination introuvable.', 404);
  await d.update({ colonne: colonneValide(pays, corps?.colonne), updated_by: userId, updated_at: new Date() });
  return { message: 'Destination modifiée.' };
};

module.exports = {
  PAYS, calculer, getEtat, saveEtat, getChargements, ajouterChargement, modifierChargement, supprimerChargement,
  getReceptions, ajouterReception, modifierReception, supprimerReception, ajouterDestination, modifierDestination,
};
