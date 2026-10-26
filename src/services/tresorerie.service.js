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
// Situation de tresorerie hebdomadaire.
//  - Les lignes sont parametrables (table tresorerie_lignes) : le chef Treso peut ajouter, renommer,
//    reordonner ou desactiver une ligne sans intervention technique.
//  - Les montants sont saisis en valeur positive ; le sens (AVOIR / DETTE) donne le signe dans le total.
//  - N-1 = valeur de la meme ligne dans le rapport precedent (non modifiable).
//  - Sous-total = somme de ses lignes de detail ; Total = somme signee des lignes de premier niveau.
const { Op } = require('sequelize');
const { RapportHebdo, TresorerieSemaine, TresorerieLigne } = require('../models');
const { getOrCreateRapportSemaine } = require('../utils/rapport.utils');
const { infoSaisie, derniereValeur, ecrireLigne, frequenceDe } = require('./frequence.service');

const parCode = (r) => r.code;

const num = (v) => (v === null || v === undefined || v === '' ? null : (Number.isFinite(parseFloat(v)) ? parseFloat(v) : null));
const signe = (l) => (l.sens === 'DETTE' ? -1 : 1);
const EPS = 0.005;

// Lignes a afficher pour un rapport : lignes actives + lignes desactivees qui ont une valeur dans ce rapport
const lignesPour = async (rapportIds) => {
  const [toutes, rows] = await Promise.all([
    TresorerieLigne.findAll({ where: { del: 0 }, order: [['ordre', 'ASC'], ['id', 'ASC']] }),
    rapportIds.length ? TresorerieSemaine.findAll({ where: { rapport_id: { [Op.in]: rapportIds }, del: 0 } }) : [],
  ]);
  return { toutes, rows };
};

// Valeur de chaque ligne pour un rapport (map code -> nombre | null)
//  - un sous-total vaut la somme de ses details si au moins un detail est renseigne,
//    sinon la valeur directement saisie (rapports anterieurs au detail des sous-totaux)
const calculerValeurs = (lignes, rowsDuRapport) => {
  const brut = {};
  rowsDuRapport.forEach(r => { brut[r.code] = num(r.montant_n); });
  const val = {};
  for (const l of lignes.filter(x => x.type === 'SAISIE')) val[l.code] = brut[l.code] ?? null;
  for (const st of lignes.filter(x => x.type === 'SOUS_TOTAL')) {
    const details = lignes.filter(x => x.parent_id === st.id && x.type === 'SAISIE').map(x => val[x.code]).filter(v => v !== null);
    val[st.code] = details.length ? details.reduce((s, v) => s + v, 0) : (brut[st.code] ?? null);
  }
  const ids = new Set(lignes.map(x => x.id));
  const premierNiveau = lignes.filter(x => (!x.parent_id || !ids.has(x.parent_id)) && x.type !== 'TOTAL').filter(x => val[x.code] !== null);
  const total = premierNiveau.length ? premierNiveau.reduce((s, x) => s + signe(x) * val[x.code], 0) : null;
  for (const t of lignes.filter(x => x.type === 'TOTAL')) val[t.code] = total;
  return val;
};

// Evolution N-1 -> N
//  - variation en % quand les deux valeurs ont le meme signe
//  - quand le signe change (ou N-1 = 0), le % n'a pas de sens : on affiche l'ecart en FCFA
//  - favorable : une hausse est favorable pour un avoir ou le total, defavorable pour une dette
const evolution = (ligne, n1, n) => {
  if (n1 === null || n === null) return { ecart: null, variation_pct: null, changement_signe: false, tendance: null, favorable: null };
  const ecart = n - n1;
  const changementSigne = Math.abs(n1) < EPS || (Math.sign(n1) !== Math.sign(n) && Math.abs(n) >= EPS);
  const tendance = Math.abs(ecart) < EPS ? 'stable' : (ecart > 0 ? 'hausse' : 'baisse');
  const favorable = tendance === 'stable' ? null : (ligne.sens === 'DETTE' && ligne.type !== 'TOTAL' ? ecart < 0 : ecart > 0);
  return {
    ecart, variation_pct: changementSigne ? null : ecart / Math.abs(n1),
    changement_signe: changementSigne, tendance, favorable,
  };
};

// Ordre d'affichage du tableau Excel : les lignes de detail precedent leur sous-total, le total en dernier
const ordreAffichage = (lignes) => {
  const ids = new Set(lignes.map(l => l.id));
  const out = [];
  for (const l of lignes.filter(x => (!x.parent_id || !ids.has(x.parent_id)) && x.type !== 'TOTAL')) {
    if (l.type === 'SOUS_TOTAL') out.push(...lignes.filter(x => x.parent_id === l.id));
    out.push(l);
  }
  return [...out, ...lignes.filter(x => x.type === 'TOTAL')];
};

const rapportPrecedent = (rapport) => RapportHebdo.findOne({
  where: { del: 0, date_fin: { [Op.lt]: rapport.date_fin } }, order: [['date_fin', 'DESC']],
});

// Tableau complet de tresorerie d'un rapport (saisie, apercu, PDF, Excel)
//  - valeurs N : derniere saisie de la semaine, ou saisie du jour `jour` (ecran de saisie quotidienne)
const getTresorerie = async (rapport, { jour = null } = {}) => {
  const prec = await rapportPrecedent(rapport);
  const ids = [rapport.id, ...(prec ? [prec.id] : [])];
  const { toutes, rows } = await lignesPour(ids);
  const duRapport = rows.filter(r => r.rapport_id === rapport.id);
  const rowsN = jour ? duRapport.filter(r => r.date_saisie === jour) : derniereValeur(duRapport, parCode);
  const rowsN1 = prec ? derniereValeur(rows.filter(r => r.rapport_id === prec.id), parCode) : [];
  const avecValeur = new Set(rowsN.filter(r => r.montant_n !== null).map(r => r.code));
  const lignes = toutes.filter(l => l.actif || avecValeur.has(l.code) || l.type === 'TOTAL');
  // Les sous-totaux desactives entrainent leurs details : on garde un detail si son parent est affiche
  const ids_affiches = new Set(lignes.map(l => l.id));

  const valN = calculerValeurs(lignes, rowsN);
  const valN1 = calculerValeurs(lignes, rowsN1);
  const snap = {}; rowsN.forEach(r => { snap[r.code] = r; });

  const resultat = ordreAffichage(lignes).map(l => {
    const n = valN[l.code] ?? null;
    // N-1 du rapport precedent ; a defaut, la valeur N-1 saisie a l'epoque (anciens rapports)
    const n1 = valN1[l.code] ?? num(snap[l.code]?.montant_n1);
    return {
      id: l.id, code: l.code,
      // libelle fige au moment de la saisie pour un rapport publie
      libelle: (rapport.statut === 'PUBLIE' && snap[l.code]?.libelle) || l.libelle,
      sens: l.sens, type: l.type, parent_id: ids_affiches.has(l.parent_id) ? l.parent_id : null,
      niveau: l.parent_id && ids_affiches.has(l.parent_id) ? 1 : 0,
      actif: !!l.actif, saisissable: l.type === 'SAISIE' && !!l.actif,
      montant_n1: n1, montant_n: n,
      ...evolution(l, n1, n),
    };
  });

  return {
    rapport_precedent: prec ? { id: prec.id, annee: prec.annee, semaine_iso: prec.semaine_iso, date_fin: prec.date_fin } : null,
    lignes: resultat,
  };
};

// Total « situation simulee » d'une liste de rapports (historique)
const totauxParRapport = async (rapportIds) => {
  const { toutes, rows } = await lignesPour(rapportIds);
  const out = {};
  for (const id of rapportIds) {
    const val = calculerValeurs(toutes, derniereValeur(rows.filter(r => r.rapport_id === id), parCode));
    const total = toutes.find(l => l.type === 'TOTAL');
    out[id] = total ? val[total.code] : null;
  }
  return out;
};

const getSaisieData = async (user, droits) => {
  const rapport = await getOrCreateRapportSemaine(user.id);
  const info = await infoSaisie('tresorerie');
  return {
    rapport: {
      id: rapport.id, annee: rapport.annee, semaine_iso: rapport.semaine_iso,
      date_debut: rapport.date_debut, date_fin: rapport.date_fin, statut: rapport.statut,
    },
    ...info,
    droits,
    ...(await getTresorerie(rapport, { jour: info.frequence === 'QUOTIDIEN' ? info.date_saisie : null })),
  };
};

const saveSaisie = async (rapportId, lignes, user) => {
  const rapport = await RapportHebdo.findOne({ where: { id: rapportId, del: 0 } });
  if (!rapport) throw { status: 404, message: 'Rapport introuvable.' };
  if (rapport.statut === 'PUBLIE') throw { status: 400, message: 'Ce rapport est déjà publié.' };

  const defs = await TresorerieLigne.findAll({ where: { del: 0, actif: 1, type: 'SAISIE' } });
  const parCode = {}; defs.forEach(d => { parCode[d.code] = d; });
  // N-1 fige au moment de la saisie (trace de ce qui etait affiche)
  const { lignes: courant } = await getTresorerie(rapport);
  const n1 = {}; courant.forEach(l => { n1[l.code] = l.montant_n1; });
  const frequence = await frequenceDe('tresorerie');

  for (const l of lignes) {
    const def = parCode[l.code];
    if (!def) continue;                       // ligne calculee, inconnue ou desactivee : ignoree
    const valeurs = { montant_n: num(l.montant_n), montant_n1: n1[l.code] ?? null, libelle: def.libelle };
    if (valeurs.montant_n !== null && valeurs.montant_n < 0) throw { status: 400, message: `« ${def.libelle} » : saisir un montant positif (le sens avoir/dette est appliqué automatiquement).` };
    await ecrireLigne(TresorerieSemaine, { rapport_id: rapportId, code: l.code }, valeurs, frequence, user.id);
  }
  return { message: 'Trésorerie enregistrée avec succès.' };
};

// ── Gestion des lignes (droit « tresorerie-lignes »)
const getLignes = async () => {
  const lignes = await TresorerieLigne.findAll({ where: { del: 0 }, order: [['ordre', 'ASC'], ['id', 'ASC']] });
  return lignes.map(l => ({ id: l.id, code: l.code, libelle: l.libelle, sens: l.sens, type: l.type, parent_id: l.parent_id, ordre: l.ordre, actif: !!l.actif }));
};

const codeDepuis = async (libelle) => {
  const base = libelle.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'LIGNE';
  let code = base; let i = 2;
  while (await TresorerieLigne.findOne({ where: { code } })) code = `${base}_${i++}`.slice(0, 50);
  return code;
};

// Controle de coherence : un seul niveau de detail, rattache a un sous-total du meme sens
const verifierParent = async (parentId, selfId, valeurs) => {
  if (!parentId) return;
  if (parentId === selfId) throw { status: 400, message: 'Une ligne ne peut pas être son propre sous-total.' };
  const parent = await TresorerieLigne.findOne({ where: { id: parentId, del: 0 } });
  if (!parent || parent.type !== 'SOUS_TOTAL') throw { status: 400, message: 'La ligne parente doit être un sous-total.' };
  if (valeurs.type === 'SOUS_TOTAL') throw { status: 400, message: 'Un sous-total ne peut pas être rattaché à un autre sous-total.' };
  valeurs.sens = parent.sens;                 // le detail suit le sens de son sous-total
};

const createLigne = async (data, user) => {
  const valeurs = {
    libelle: data.libelle, sens: data.sens || 'AVOIR', type: data.type || 'SAISIE',
    parent_id: data.parent_id || null, actif: 1,
  };
  await verifierParent(valeurs.parent_id, null, valeurs);
  if (data.ordre === undefined) {
    const total = await TresorerieLigne.findOne({ where: { del: 0, type: 'TOTAL' } });
    const max = (await TresorerieLigne.max('ordre', { where: { del: 0, type: { [Op.ne]: 'TOTAL' } } })) || 0;
    valeurs.ordre = total && max + 10 >= total.ordre ? max + 1 : max + 10;
  } else valeurs.ordre = data.ordre;
  const ligne = await TresorerieLigne.create({ ...valeurs, code: await codeDepuis(data.libelle), created_by: user.id });
  return { message: 'Ligne ajoutée.', id: ligne.id };
};

const updateLigne = async (id, data, user) => {
  const ligne = await TresorerieLigne.findOne({ where: { id, del: 0 } });
  if (!ligne) throw { status: 404, message: 'Ligne introuvable.' };
  const valeurs = {};
  ['libelle', 'sens', 'type', 'parent_id', 'ordre', 'actif'].forEach(f => { if (data[f] !== undefined) valeurs[f] = data[f]; });
  if (ligne.type === 'TOTAL') {
    // Le total est calcule : seul son libelle peut changer
    Object.keys(valeurs).filter(k => k !== 'libelle').forEach(k => delete valeurs[k]);
  }
  if (valeurs.actif !== undefined) valeurs.actif = [true, 'true', 1, '1'].includes(valeurs.actif) ? 1 : 0;
  const type = valeurs.type ?? ligne.type;
  const parentId = valeurs.parent_id !== undefined ? valeurs.parent_id : ligne.parent_id;
  const controle = { type, sens: valeurs.sens ?? ligne.sens };
  await verifierParent(parentId, ligne.id, controle);
  if (parentId) valeurs.sens = controle.sens;
  if (ligne.type === 'SOUS_TOTAL' && type !== 'SOUS_TOTAL'
    && await TresorerieLigne.findOne({ where: { parent_id: ligne.id, del: 0 } })) {
    throw { status: 400, message: 'Ce sous-total a des lignes de détail : rattachez-les ailleurs avant de changer son type.' };
  }
  await ligne.update({ ...valeurs, updated_by: user.id, updated_at: new Date() });
  // Les details d'un sous-total suivent son sens
  if (ligne.type === 'SOUS_TOTAL' && valeurs.sens) {
    await TresorerieLigne.update({ sens: valeurs.sens, updated_by: user.id, updated_at: new Date() }, { where: { parent_id: ligne.id, del: 0 } });
  }
  return { message: 'Ligne mise à jour.' };
};

module.exports = { getSaisieData, saveSaisie, getTresorerie, totauxParRapport, getLignes, createLigne, updateLigne, calculerValeurs, evolution };
