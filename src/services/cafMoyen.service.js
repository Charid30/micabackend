const { CafMoyenAchat, Produit } = require('../models');

const CORRIDORS = ['ABIDJAN', 'ACCRA', 'LOME', 'COTONOU'];
const MOIS_LABELS = ['', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
                     'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

const getData = async (annee) => {
  const year = annee || new Date().getFullYear();

  const produits = await Produit.findAll({ where: { del: 0 }, order: [['libelle', 'ASC']] });

  const rows = await CafMoyenAchat.findAll({
    where: { annee: year, del: 0 },
    include: [{ model: Produit, as: 'produit', attributes: ['id', 'libelle'] }],
  });

  const idx = {};
  rows.forEach(r => {
    const key = `${r.corridor}|${r.produit_id}|${r.mois}`;
    idx[key] = parseFloat(r.valeur_caf) || null;
  });

  const moisDispos = [...new Set(rows.map(r => r.mois))].sort((a, b) => a - b);
  const moisAffichage = moisDispos.length > 0 ? moisDispos : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  const tableau = CORRIDORS.map(corridor => ({
    corridor,
    produits: produits.map(p => {
      const valeurs = {};
      moisAffichage.forEach(m => { valeurs[m] = idx[`${corridor}|${p.id}|${m}`] ?? null; });
      const vals = Object.values(valeurs).filter(v => v != null);
      const caf_moyen = vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
      return { produit_id: p.id, produit_libelle: p.libelle, valeurs, caf_moyen };
    }),
  }));

  return { annee: year, mois: moisAffichage.map(m => ({ num: m, label: MOIS_LABELS[m] })), tableau };
};

const saveEntries = async (entries, userId) => {
  for (const e of entries) {
    const { annee, mois, corridor, produit_id, valeur_caf } = e;
    if (!annee || !mois || !corridor || !produit_id) continue;
    const val = valeur_caf != null && valeur_caf !== '' ? parseFloat(valeur_caf) : null;

    const [row, created] = await CafMoyenAchat.findOrCreate({
      where: { annee, mois, corridor, produit_id, del: 0 },
      defaults: { valeur_caf: val, created_by: userId },
    });
    if (!created) await row.update({ valeur_caf: val, updated_by: userId });
  }
  return { message: 'CAF moyen enregistré avec succès.' };
};

module.exports = { getData, saveEntries, CORRIDORS, MOIS_LABELS };
