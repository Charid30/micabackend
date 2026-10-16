const { RapportHebdo, VenteMarketeur, FinanceDette, Produit, Marketeur } = require('../models');
const { getAutonomie, trierProduits } = require('./autonomie.service');
const { getTresorerie } = require('./tresorerie.service');
const { getReporting } = require('./reporting.service');

const PRODUIT_LIBELLE = { SUPER91: 'Essence', PETROLE: 'Pétrole', GASOIL: 'Gasoil', DDO: 'DDO', JET_A1: 'Jet A1', FUEL_OIL: 'Fuel', GAZ: 'Gaz' };

const getListe = async () => {
  const rapports = await RapportHebdo.findAll({
    where: { del: 0 },
    order: [['annee', 'DESC'], ['semaine_iso', 'DESC']],
    attributes: ['id', 'annee', 'semaine_iso', 'date_debut', 'date_fin', 'statut'],
  });
  return rapports;
};

const getApercu = async (rapportId) => {
  const rapport = await RapportHebdo.findOne({ where: { id: rapportId, del: 0 } });
  if (!rapport) throw { status: 404, message: 'Rapport introuvable.' };

  // Autonomie : calcul unique (services/autonomie.service), stocks au jeudi de fin de semaine
  const [autonomie, tresorerie, ventes, dettes, produitsRaw, marketeurs] = await Promise.all([
    getAutonomie(rapport),
    getTresorerie(rapport),
    VenteMarketeur.findAll({
      where: { rapport_id: rapportId, del: 0 },
      include: [
        { model: Produit,   as: 'produit',   attributes: ['code'] },
        { model: Marketeur, as: 'marketeur', attributes: ['id', 'libelle'] },
      ],
    }),
    FinanceDette.findAll({ where: { rapport_id: rapportId, del: 0 } }),
    Produit.findAll({ where: { del: 0 }, attributes: ['id', 'code', 'libelle', 'unite'] }),
    Marketeur.findAll({ where: { del: 0 }, attributes: ['id', 'code', 'libelle'], order: [['libelle', 'ASC']] }),
  ]);

  const produits = trierProduits(produitsRaw);
  const produitCodes = produits.map(p => p.code);
  const densite = autonomie.parametres.densite_gaz;

  // Section « Situation des stocks » : volumes en litres (m³ x 1000), gaz en tonnes (m³ x densite)
  const enUnite = (code, m3) => (code === 'GAZ' ? Math.round(m3 * densite * 10) / 10 : Math.round(m3 * 1000));
  const unite = (code) => (code === 'GAZ' ? 'tonnes' : 'litres');
  const libelleCourt = (l) => PRODUIT_LIBELLE[l.produit_code] || l.produit_libelle;

  const stocksInterieurs = autonomie.synthese_interieure.map(l => ({
    produit: libelleCourt(l), code: l.produit_code, unite: unite(l.produit_code),
    netStock: enUnite(l.produit_code, l.volume_total - l.impompable),
    conso: enUnite(l.produit_code, l.conso_moyenne),
    autonomie: l.autonomie, couleur: l.couleur,
  }));
  const stocksExterieurs = autonomie.synthese_exterieure
    .filter(l => l.volume_total !== 0 || l.besoin_journalier > 0)
    .map(l => ({
      produit: libelleCourt(l), code: l.produit_code, unite: unite(l.produit_code),
      netStock: enUnite(l.produit_code, l.volume_total),
      conso: enUnite(l.produit_code, l.besoin_journalier),
      autonomie: l.autonomie, couleur: l.couleur, exclus: l.exclus,
    }));

  const produitsLibelle = {};
  for (const p of produits) produitsLibelle[p.code] = p.libelle;
  const interByCode = {}; stocksInterieurs.forEach(x => { interByCode[x.code] = x; });
  const exterByCode = {}; stocksExterieurs.forEach(x => { exterByCode[x.code] = x; });
  const stocksListe = produitCodes.map(code => {
    const i = interByCode[code] || { netStock: 0, conso: 0 };
    const e = exterByCode[code] || { netStock: 0, conso: 0 };
    const stock = i.netStock + e.netStock;
    const conso = i.conso + e.conso;
    return { produit: produitsLibelle[code] || code, code, stock, conso, autonomie: conso > 0 ? Math.round(stock / conso) : 0 };
  });

  // ── Ventes : matrice {marketeur_id: {produit_code: quantite}}
  const ventesMatrix = {};
  const ventesTotauxMap = {};
  let totalVentes = 0;

  for (const v of ventes) {
    const mId = v.marketeur_id;
    const pCode = v.produit?.code;
    const qty = parseFloat(v.quantite) || 0;
    if (!pCode || qty === 0) continue;

    if (!ventesMatrix[mId]) ventesMatrix[mId] = {};
    ventesMatrix[mId][pCode] = (ventesMatrix[mId][pCode] || 0) + qty;
    ventesTotauxMap[pCode] = (ventesTotauxMap[pCode] || 0) + qty;
    totalVentes += qty;
  }

  const ventesTotauxListe = produitCodes.map(code => ({
    produit: produitsLibelle[code] || code,
    code,
    total: ventesTotauxMap[code] || 0,
  }));

  // Filtrer marketeurs qui ont au moins une vente pour ce rapport
  const marketeurIdsAvecVentes = new Set(ventes.map(v => v.marketeur_id));
  const marketeursActifs = marketeurs.filter(m => marketeurIdsAvecVentes.has(m.id));

  // ── Dettes
  let detteEtat = 0;
  let engagementFourn = 0;
  for (const d of dettes) {
    if (d.sens === 'DETTE_ETAT_VERS_SONABHY') detteEtat += parseFloat(d.montant) || 0;
    else engagementFourn += parseFloat(d.montant) || 0;
  }

  return {
    rapport: {
      id: rapport.id, annee: rapport.annee, semaine_iso: rapport.semaine_iso,
      date_debut: rapport.date_debut, date_fin: rapport.date_fin, statut: rapport.statut,
    },
    produits: produitCodes,
    stocksListe,
    stocksInterieurs,
    stocksExterieurs,
    marketeurs: marketeursActifs.map(m => ({ id: m.id, libelle: m.libelle })),
    ventesMatrix,
    ventesTotauxMap,
    ventesTotauxListe,
    totalVentes,
    detteEtat,
    engagementFourn,
    autonomie,
    tresorerie,
    // Contenu au format du document REPORTING (apercu, PDF, Excel)
    reporting: await getReporting(rapport),
  };
};

const archiver = async (rapportId, userId) => {
  const rapport = await RapportHebdo.findOne({ where: { id: rapportId, del: 0 } });
  if (!rapport) throw new Error('Rapport introuvable.');
  if (rapport.statut === 'PUBLIE') throw new Error('Ce rapport est déjà archivé.');
  await rapport.update({
    statut: 'PUBLIE',
    date_publication: new Date(),
    updated_by: userId,
  });
  return { message: `Rapport semaine ${rapport.semaine_iso}/${rapport.annee} archivé.` };
};

// Suppression logique d'un rapport (brouillon ou publie), reservee a l'administrateur.
// Les donnees saisies restent en base (rattachees au rapport supprime) et ne sont plus affichees.
const supprimer = async (rapportId, userId) => {
  const rapport = await RapportHebdo.findOne({ where: { id: rapportId, del: 0 } });
  if (!rapport) throw { status: 404, message: 'Rapport introuvable.' };
  await rapport.update({ del: 1, deleted_at: new Date(), deleted_by: userId, updated_by: userId, updated_at: new Date() });
  return { message: `Rapport semaine ${rapport.semaine_iso}/${rapport.annee} supprimé.` };
};

module.exports = { getListe, getApercu, archiver, supprimer };
