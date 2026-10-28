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
// Menu Encours (onglet « Encours » du fichier Suivi des indicateurs) :
//  - planning de livraison : produit, fournisseur, corridor de destination, quantite prevue (TM),
//    date de livraison prevue, statut ;
//  - synthese par produit : quantite par fournisseur, cumul (toutes les lignes, livrees comprises),
//    besoin saisi, taux de couverture = cumul / besoin.
// Saisie rattachee a la semaine du rapport ; frequence parametrable (permanente par defaut).
const { RapportHebdo, EncoursLigne, EncoursBesoin, Produit, Fournisseur, Corridor, STATUTS_ENCOURS } = require('../models');
const { getOrCreateRapportSemaine } = require('../utils/rapport.utils');
const { trierProduits } = require('./autonomie.service');
const { infoSaisie, frequenceDe, lignesSaisie, derniereValeur, remplacerSaisie, ecrireLigne } = require('./frequence.service');

const STATUTS = {
  EN_COURS: 'En cours', EN_COURS_LIVRAISON: 'En cours de livraison', LIVRAISON_PARTIELLE: 'Livraison partielle', LIVRE: 'Livré',
};
const MAX_LIGNES = 500;
const parProduit = (r) => r.produit_id;

const num = (v) => {
  if (v === null || v === undefined || String(v).trim() === '') return null;
  const n = parseFloat(String(v).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
};
const dateValide = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d));

const referentiels = async () => {
  const [produits, fournisseurs, corridors] = await Promise.all([
    Produit.findAll({ where: { del: 0 }, attributes: ['id', 'code', 'libelle'] }),
    Fournisseur.findAll({ where: { del: 0 }, attributes: ['id', 'code', 'libelle'], order: [['libelle', 'ASC']] }),
    Corridor.findAll({ where: { del: 0 }, attributes: ['id', 'code', 'libelle'], order: [['libelle', 'ASC']] }),
  ]);
  return {
    produits: trierProduits(produits).map(p => ({ id: p.id, code: p.code, libelle: p.libelle })),
    fournisseurs: fournisseurs.map(f => ({ id: f.id, code: f.code, libelle: f.libelle })),
    corridors: corridors.map(c => ({ id: c.id, code: c.code, libelle: c.libelle })),
  };
};

const ligneJson = (l) => ({
  id: l.id, produit_id: l.produit_id, fournisseur_id: l.fournisseur_id, corridor_id: l.corridor_id,
  quantite_tm: Number(l.quantite_tm), date_livraison: l.date_livraison, statut: l.statut, observation: l.observation || '',
});

// Synthese par produit (meme calcul que l'onglet Excel) a partir des lignes et des besoins
const synthese = (lignes, besoins, ref) => {
  const besoinDe = {}; besoins.forEach(b => { besoinDe[b.produit_id] = b.besoin_tm === null ? null : Number(b.besoin_tm); });
  const fournisseurs = ref.fournisseurs.filter(f => lignes.some(l => l.fournisseur_id === f.id));
  const produits = ref.produits
    .filter(p => lignes.some(l => l.produit_id === p.id) || besoinDe[p.id] > 0)
    .map(p => {
      const parFournisseur = {};
      lignes.filter(l => l.produit_id === p.id).forEach(l => {
        parFournisseur[l.fournisseur_id] = (parFournisseur[l.fournisseur_id] || 0) + Number(l.quantite_tm);
      });
      const cumul = Object.values(parFournisseur).reduce((s, v) => s + v, 0);
      const besoin = besoinDe[p.id] ?? null;
      return { produit_id: p.id, code: p.code, produit: p.libelle, par_fournisseur: parFournisseur, cumul, besoin, taux: besoin > 0 ? cumul / besoin : null };
    });
  const cumul = produits.reduce((s, p) => s + p.cumul, 0);
  const besoin = produits.reduce((s, p) => s + (p.besoin || 0), 0);
  return { fournisseurs, produits, total: { cumul, besoin, taux: besoin > 0 ? cumul / besoin : null } };
};

// Encours d'un rapport (rapport, apercu, PDF, Excel, tableau de bord) : derniere saisie de la semaine
const getEncours = async (rapport) => {
  const [lignesRows, besoinsRows, ref] = await Promise.all([
    EncoursLigne.findAll({ where: { rapport_id: rapport.id, del: 0 } }),
    EncoursBesoin.findAll({ where: { rapport_id: rapport.id, del: 0 } }),
    referentiels(),
  ]);
  const lignes = derniereValeur(lignesRows, null).map(ligneJson);
  const besoins = derniereValeur(besoinsRows, parProduit);
  const s = synthese(lignes, besoins, ref);
  const libelle = (liste, id) => liste.find(x => x.id === id)?.libelle || '';
  const ordre = Object.fromEntries(ref.produits.map((p, i) => [p.id, i]));
  return {
    ...s,
    planning: [...lignes]
      .sort((a, b) => (ordre[a.produit_id] ?? 99) - (ordre[b.produit_id] ?? 99) || libelle(ref.fournisseurs, a.fournisseur_id).localeCompare(libelle(ref.fournisseurs, b.fournisseur_id)))
      .map(l => ({
        ...l, produit: libelle(ref.produits, l.produit_id), fournisseur: libelle(ref.fournisseurs, l.fournisseur_id),
        corridor: libelle(ref.corridors, l.corridor_id), statut_libelle: STATUTS[l.statut] || l.statut,
      })),
  };
};

const getSaisieData = async (userId) => {
  const rapport = await getOrCreateRapportSemaine(userId);
  const info = await infoSaisie('encours-livraison');
  const [lignesRows, besoinsRows, ref] = await Promise.all([
    EncoursLigne.findAll({ where: { rapport_id: rapport.id, del: 0 } }),
    EncoursBesoin.findAll({ where: { rapport_id: rapport.id, del: 0 } }),
    referentiels(),
  ]);
  const besoins = {};
  lignesSaisie(besoinsRows, info.frequence, parProduit).forEach(b => { besoins[b.produit_id] = b.besoin_tm === null ? null : Number(b.besoin_tm); });
  return {
    rapport: {
      id: rapport.id, annee: rapport.annee, semaine_iso: rapport.semaine_iso,
      date_debut: rapport.date_debut, date_fin: rapport.date_fin, statut: rapport.statut,
    },
    ...info,
    ...ref,
    statuts: STATUTS_ENCOURS.map(code => ({ code, libelle: STATUTS[code] })),
    lignes: lignesSaisie(lignesRows, info.frequence, null).map(ligneJson),
    besoins,
  };
};

/**
 * Enregistre le planning et les besoins de la semaine.
 * lignes  : [{ produit_id, fournisseur_id, corridor_id, quantite_tm, date_livraison, statut, observation }]
 * besoins : { produit_id: besoin_tm | null }
 */
const saveSaisie = async (rapportId, lignes, besoins, userId) => {
  const rapport = await RapportHebdo.findOne({ where: { id: rapportId, del: 0 } });
  if (!rapport) throw { status: 404, message: 'Rapport introuvable.' };
  if (rapport.statut === 'PUBLIE') throw { status: 400, message: 'Ce rapport est déjà publié.' };
  if (!Array.isArray(lignes) || lignes.length > MAX_LIGNES) throw { status: 400, message: 'Planning de livraison invalide.' };
  if (besoins === null || typeof besoins !== 'object' || Array.isArray(besoins)) throw { status: 400, message: 'Besoins invalides.' };

  const ref = await referentiels();
  const existe = (liste, id) => liste.some(x => x.id === Number(id));
  const nomProduit = (id) => ref.produits.find(p => p.id === Number(id))?.libelle || 'produit';

  const propres = lignes.map((l, i) => {
    const n = i + 1;
    if (!existe(ref.produits, l.produit_id)) throw { status: 400, message: `Ligne ${n} : produit obligatoire.` };
    if (!existe(ref.fournisseurs, l.fournisseur_id)) throw { status: 400, message: `Ligne ${n} : fournisseur obligatoire.` };
    if (l.corridor_id && !existe(ref.corridors, l.corridor_id)) throw { status: 400, message: `Ligne ${n} : corridor inconnu.` };
    const q = num(l.quantite_tm);
    if (q === null || Number.isNaN(q) || q < 0) throw { status: 400, message: `Ligne ${n} (${nomProduit(l.produit_id)}) : quantité prévue en TM invalide.` };
    if (l.date_livraison && !dateValide(l.date_livraison)) throw { status: 400, message: `Ligne ${n} : date de livraison invalide.` };
    if (!STATUTS[l.statut]) throw { status: 400, message: `Ligne ${n} : statut invalide.` };
    return {
      produit_id: Number(l.produit_id), fournisseur_id: Number(l.fournisseur_id), corridor_id: l.corridor_id ? Number(l.corridor_id) : null,
      quantite_tm: q, date_livraison: l.date_livraison || null, statut: l.statut,
      observation: String(l.observation ?? '').trim().slice(0, 255) || null,
    };
  });

  const valeursBesoin = {};
  for (const [pid, v] of Object.entries(besoins)) {
    if (!existe(ref.produits, pid)) continue;
    const b = num(v);
    if (Number.isNaN(b) || (b !== null && b < 0)) throw { status: 400, message: `Besoin invalide pour ${nomProduit(pid)}.` };
    valeursBesoin[pid] = b;
  }

  const frequence = await frequenceDe('encours-livraison');
  await remplacerSaisie(EncoursLigne, rapportId, propres, frequence, userId);
  for (const [pid, b] of Object.entries(valeursBesoin)) {
    await ecrireLigne(EncoursBesoin, { rapport_id: rapportId, produit_id: Number(pid) }, { besoin_tm: b }, frequence, userId);
  }
  return { message: 'Encours enregistrés avec succès.' };
};

// Fournisseur absent de la liste : ajoute depuis l'ecran Encours (meme table que Parametres > Fournisseurs).
// Un fournisseur de meme nom (actif ou supprime) est repris au lieu d'etre cree en double.
const sansAccents = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
const ajouterFournisseur = async (libelleSaisi, userId) => {
  const libelle = String(libelleSaisi ?? '').replace(/\s+/g, ' ').trim();
  if (libelle.length < 2 || libelle.length > 150) throw { status: 400, message: 'Nom du fournisseur : 2 à 150 caractères.' };
  const cle = sansAccents(libelle).toUpperCase();
  const tous = await Fournisseur.findAll();
  const meme = tous.find(f => sansAccents(f.libelle).toUpperCase() === cle);
  if (meme) {
    if (meme.del) await meme.update({ del: 0, deleted_at: null, deleted_by: null, updated_by: userId, updated_at: new Date() });
    return { message: meme.del ? `Fournisseur « ${meme.libelle} » réactivé.` : `Fournisseur « ${meme.libelle} » déjà dans la liste.`, fournisseur: { id: meme.id, code: meme.code, libelle: meme.libelle } };
  }
  // Code unique tire du nom (ex. « Gulf Trading » -> GULF_TRADING)
  const base = cle.replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 26) || 'FOURNISSEUR';
  const codes = new Set(tous.map(f => f.code));
  let code = base; let i = 2;
  while (codes.has(code)) code = `${base}_${i++}`.slice(0, 30);
  const f = await Fournisseur.create({ code, libelle, del: 0, created_by: userId, updated_by: userId });
  return { message: `Fournisseur « ${libelle} » ajouté.`, fournisseur: { id: f.id, code: f.code, libelle: f.libelle } };
};

module.exports = { getSaisieData, saveSaisie, getEncours, ajouterFournisseur, STATUTS };
