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
// Frequence de saisie de chaque menu (Parametres > Frequences de saisie).
//  - QUOTIDIEN    : une saisie par jour ; l'ecran de saisie montre la saisie du jour.
//  - HEBDOMADAIRE : une seule saisie par semaine, mise a jour a chaque enregistrement.
//  - PERMANENT    : comme l'hebdomadaire, mais les valeurs sont reprises automatiquement
//                   d'une semaine a l'autre tant qu'elles ne sont pas modifiees.
// Dans tous les cas, le rapport retient la derniere valeur saisie de la semaine.
const { Op } = require('sequelize');
const {
  Parametre, RapportHebdo, Depot, StockDepot, ChargementCorridor, CamionDepot, TempsAttenteCamion,
  VeilleMarche, VeilleGeopolitique, VenteMarketeur, TresorerieSemaine, Recommandation,
} = require('../models');

const FREQUENCES = {
  QUOTIDIEN: 'Quotidienne', HEBDOMADAIRE: 'Hebdomadaire', PERMANENT: 'Permanente',
};

// cle : identifie une ligne d'une meme saisie (null = la saisie forme un tout, ex. ventes)
const MODULES = [
  { code: 'stocks-int',      libelle: 'Stocks dépôts int.',  defaut: 'QUOTIDIEN',    model: StockDepot,         cle: r => `${r.depot_id}_${r.produit_id}`, depots: 'INTERIEUR' },
  { code: 'stocks-ext',      libelle: 'Stocks dépôts ext.',  defaut: 'QUOTIDIEN',    model: StockDepot,         cle: r => `${r.depot_id}_${r.produit_id}`, depots: 'EXTERIEUR' },
  { code: 'corridors',       libelle: 'Corridors',           defaut: 'QUOTIDIEN',    model: ChargementCorridor, cle: r => `${r.corridor_id}_${r.produit_id}` },
  { code: 'depots-int',      libelle: 'Dépôts intérieurs',   defaut: 'QUOTIDIEN',    model: CamionDepot,        cle: r => `${r.depot_id}_${r.produit_id}` },
  { code: 'temps-attente',   libelle: "Temps d'attente",     defaut: 'HEBDOMADAIRE', model: TempsAttenteCamion, cle: r => `${r.site_type}|${r.site_nom}` },
  { code: 'veille-marche',   libelle: 'Veille marché',       defaut: 'HEBDOMADAIRE', model: VeilleMarche,       cle: r => r.produit },
  { code: 'veille-geo',      libelle: 'Veille géopolitique', defaut: 'HEBDOMADAIRE', model: VeilleGeopolitique, cle: r => r.zone },
  { code: 'ventes',          libelle: 'Ventes',              defaut: 'HEBDOMADAIRE', model: VenteMarketeur,     cle: null },
  { code: 'tresorerie',      libelle: 'Trésorerie',          defaut: 'HEBDOMADAIRE', model: TresorerieSemaine,  cle: r => r.code },
  { code: 'recommandations', libelle: 'Recommandations',     defaut: 'HEBDOMADAIRE', model: Recommandation,     cle: () => 'unique' },
  // Registres : pas rattaches a une semaine, la frequence ne s'applique pas
  { code: 'caf-moyen',       libelle: 'CAF moyen',           defaut: 'PERMANENT', verrouille: 'Registre mensuel (année, mois) : chaque valeur reste valable jusqu\'à sa modification.' },
  { code: 'achats-traders',  libelle: 'Achats traders',      defaut: 'PERMANENT', verrouille: 'Registre des achats : chaque achat reste visible jusqu\'à sa suppression.' },
];

const cleParametre = (code) => `FREQUENCE_${code.toUpperCase().replace(/-/g, '_')}`;
const aujourdhui = () => new Date().toISOString().split('T')[0];

// Cache court : un changement fait dans un autre processus est pris en compte en une minute au plus
let cache = null; let cacheLe = 0;
const charger = async () => {
  if (cache && Date.now() - cacheLe < 60000) return cache;
  const rows = await Parametre.findAll({ where: { cle: MODULES.map(m => cleParametre(m.code)) } });
  const valeurs = {}; rows.forEach(r => { valeurs[r.cle] = r.valeur; });
  const f = {};
  for (const m of MODULES) {
    const v = valeurs[cleParametre(m.code)];
    f[m.code] = !m.verrouille && FREQUENCES[v] ? v : m.defaut;
  }
  cache = f; cacheLe = Date.now();
  return f;
};

const frequenceDe = async (code) => (await charger())[code];

const getFrequences = async () => {
  const f = await charger();
  return {
    frequences: Object.entries(FREQUENCES).map(([code, libelle]) => ({ code, libelle })),
    modules: MODULES.map(m => ({ code: m.code, libelle: m.libelle, frequence: f[m.code], defaut: m.defaut, verrouille: m.verrouille || null })),
  };
};

const saveFrequences = async (choix, userId) => {
  for (const m of MODULES.filter(x => !x.verrouille)) {
    const v = choix?.[m.code];
    if (v === undefined) continue;
    if (!FREQUENCES[v]) throw { status: 400, message: `Fréquence inconnue pour « ${m.libelle} ».` };
    const cle = cleParametre(m.code);
    const p = await Parametre.findOne({ where: { cle } });
    if (p) { if (p.valeur !== v) await p.update({ valeur: v, updated_by: userId, updated_at: new Date() }); }
    else await Parametre.create({ cle, valeur: v, description: 'Fréquence de saisie (QUOTIDIEN, HEBDOMADAIRE, PERMANENT)', created_by: userId });
  }
  cache = null;
  return { message: 'Fréquences de saisie enregistrées.', ...(await getFrequences()) };
};

// ── Lecture des saisies
// La plus recente d'abord (date_saisie NULL = saisie anterieure aux frequences, en dernier)
const plusRecent = (a, b) => String(b.date_saisie || '').localeCompare(String(a.date_saisie || '')) || b.id - a.id;

// Derniere ligne saisie pour chaque cle
const dernieresParCle = (rows, cle) => {
  const vues = new Map();
  [...rows].sort(plusRecent).forEach(r => { const k = cle(r); if (!vues.has(k)) vues.set(k, r); });
  return [...vues.values()];
};

// Lignes de la derniere saisie (saisie formant un tout)
const dernierInstantane = (rows) => {
  if (!rows.length) return [];
  const d = [...rows].sort(plusRecent)[0].date_saisie || null;
  return rows.filter(r => (r.date_saisie || null) === d);
};

// Derniere valeur de la semaine (rapports, tableau de bord, historique)
const derniereValeur = (rows, cle) => (cle ? dernieresParCle(rows, cle) : dernierInstantane(rows));

// Derniere valeur de chaque rapport, pour des lignes de plusieurs rapports
const derniereValeurParRapport = (rows, cle) => {
  const parRapport = {};
  rows.forEach(r => { (parRapport[r.rapport_id] ||= []).push(r); });
  return Object.values(parRapport).flatMap(lot => derniereValeur(lot, cle));
};

// Lignes a afficher dans l'ecran de saisie : celles du jour en quotidien, la derniere saisie sinon
const lignesSaisie = (rows, frequence, cle) => (frequence === 'QUOTIDIEN'
  ? rows.filter(r => r.date_saisie === aujourdhui())
  : derniereValeur(rows, cle));

// ── Ecriture des saisies
// Une ligne (rapport + cle) : celle du jour en quotidien, l'unique ligne de la semaine sinon
const ecrireLigne = async (Model, where, valeurs, frequence, userId) => {
  const date = aujourdhui();
  const row = frequence === 'QUOTIDIEN'
    ? await Model.findOne({ where: { ...where, date_saisie: date, del: 0 } })
    : await Model.findOne({ where: { ...where, del: 0 }, order: [['date_saisie', 'DESC'], ['id', 'DESC']] });
  if (row) return row.update({ ...valeurs, date_saisie: date, updated_by: userId, updated_at: new Date() });
  return Model.create({ ...where, ...valeurs, date_saisie: date, del: 0, created_by: userId });
};

// Saisie formant un tout (ventes) : remplace la saisie du jour en quotidien, celle de la semaine sinon
const remplacerSaisie = async (Model, rapportId, lignes, frequence, userId) => {
  const date = aujourdhui();
  const existantes = await Model.findAll({ where: { rapport_id: rapportId, del: 0 } });
  const aRemplacer = frequence === 'QUOTIDIEN' ? existantes.filter(r => r.date_saisie === date) : dernierInstantane(existantes);
  if (aRemplacer.length) {
    await Model.update({ del: 1, deleted_by: userId, deleted_at: new Date(), updated_by: userId },
      { where: { id: aRemplacer.map(r => r.id) } });
  }
  for (const l of lignes) await Model.create({ ...l, rapport_id: rapportId, date_saisie: date, del: 0, created_by: userId });
};

// ── Report des valeurs permanentes sur une nouvelle semaine
const CHAMPS_EXCLUS = ['id', 'rapport_id', 'date_saisie', 'created_at', 'created_by', 'updated_at', 'updated_by', 'deleted_at', 'deleted_by', 'del'];

const reporterPermanents = async (rapport, userId = null) => {
  if (!rapport || rapport.statut === 'PUBLIE') return;
  const f = await charger();
  const modules = MODULES.filter(m => m.model && f[m.code] === 'PERMANENT');
  if (!modules.length) return;
  const precedents = await RapportHebdo.findAll({
    where: { del: 0, date_fin: { [Op.lt]: rapport.date_fin } }, order: [['date_fin', 'DESC']], limit: 52, attributes: ['id'],
  });
  if (!precedents.length) return;
  for (const m of modules) {
    const filtre = {};
    if (m.depots) filtre.depot_id = (await Depot.findAll({ where: { type: m.depots, del: 0 }, attributes: ['id'] })).map(d => d.id);
    if (await m.model.findOne({ where: { rapport_id: rapport.id, del: 0, ...filtre } })) continue;   // deja saisi cette semaine
    const rows = await m.model.findAll({ where: { rapport_id: precedents.map(p => p.id), del: 0, ...filtre } });
    const source = precedents.map(p => rows.filter(r => r.rapport_id === p.id)).find(lot => lot.length);
    if (!source) continue;
    for (const r of derniereValeur(source, m.cle)) {
      const copie = r.get({ plain: true });
      CHAMPS_EXCLUS.forEach(c => delete copie[c]);
      await m.model.create({ ...copie, rapport_id: rapport.id, date_saisie: rapport.date_debut, del: 0, created_by: userId });
    }
  }
};

// Informations de frequence renvoyees aux ecrans de saisie
const infoSaisie = async (code) => ({ frequence: await frequenceDe(code), date_saisie: aujourdhui() });

module.exports = {
  FREQUENCES, MODULES, getFrequences, saveFrequences, frequenceDe, infoSaisie, aujourdhui,
  derniereValeur, derniereValeurParRapport, lignesSaisie, ecrireLigne, remplacerSaisie, reporterPermanents,
};
