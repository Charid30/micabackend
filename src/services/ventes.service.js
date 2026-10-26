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
const { RapportHebdo, VenteMarketeur, Marketeur, Produit } = require('../models');
const { getOrCreateRapportSemaine } = require('../utils/rapport.utils');
const { infoSaisie, lignesSaisie, remplacerSaisie, frequenceDe } = require('./frequence.service');

const PRODUIT_ORDER = ['SUPER91', 'PETROLE', 'GASOIL', 'DDO', 'JET_A1', 'GAZ', 'FUEL_OIL'];

const getSaisieData = async (userId) => {
  const rapport = await getOrCreateRapportSemaine(userId);

  const info = await infoSaisie('ventes');
  const [marketeurs, produitsRaw, toutes] = await Promise.all([
    Marketeur.findAll({ where: { del: 0 }, attributes: ['id', 'code', 'libelle'], order: [['libelle', 'ASC']] }),
    Produit.findAll({ where: { del: 0 }, attributes: ['id', 'code', 'libelle'] }),
    VenteMarketeur.findAll({ where: { rapport_id: rapport.id, del: 0 } }),
  ]);
  const ventes = lignesSaisie(toutes, info.frequence, null);

  const produits = produitsRaw.sort((a, b) => {
    const ia = PRODUIT_ORDER.indexOf(a.code);
    const ib = PRODUIT_ORDER.indexOf(b.code);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  // Construire la matrice {marketeur_id: {produit_id: quantite}}
  const matrix = {};
  for (const v of ventes) {
    if (!matrix[v.marketeur_id]) matrix[v.marketeur_id] = {};
    matrix[v.marketeur_id][v.produit_id] = parseFloat(v.quantite) || 0;
  }

  return {
    rapport: {
      id: rapport.id, annee: rapport.annee, semaine_iso: rapport.semaine_iso,
      date_debut: rapport.date_debut, date_fin: rapport.date_fin, statut: rapport.statut,
    },
    ...info,
    marketeurs: marketeurs.map(m => ({ id: m.id, code: m.code, libelle: m.libelle })),
    produits: produits.map(p => ({ id: p.id, code: p.code, libelle: p.libelle })),
    matrix,
  };
};

const saveSaisie = async (rapportId, ventesData, userId) => {
  const rapport = await RapportHebdo.findOne({ where: { id: rapportId, del: 0 } });
  if (!rapport) throw new Error('Rapport introuvable.');
  if (rapport.statut === 'PUBLIE') throw new Error('Ce rapport est déjà publié.');

  // Remplace la saisie du jour (quotidien) ou de la semaine ; seules les quantites > 0 sont gardees
  const lignes = ventesData
    .filter(v => v.marketeur_id && v.produit_id && parseFloat(v.quantite) > 0)
    .map(v => ({ marketeur_id: v.marketeur_id, produit_id: v.produit_id, quantite: parseFloat(v.quantite) }));
  await remplacerSaisie(VenteMarketeur, rapportId, lignes, await frequenceDe('ventes'), userId);

  return { message: 'Ventes enregistrées avec succès.' };
};

module.exports = { getSaisieData, saveSaisie };
