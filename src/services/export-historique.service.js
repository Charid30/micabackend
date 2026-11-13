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
// Export Excel de l'historique des saisies sur une période choisie (écran Historique).
// Un onglet par saisie que le compte a le droit de lire :
//  - Synthèse : stock disponible des dépôts intérieurs par produit, semaine par semaine
//    (dernière valeur saisie de chaque dépôt dans la semaine, comme le rapport) ;
//  - Stocks, Dépôts intérieurs, Corridors, Ventes : chaque saisie, avec son auteur et son heure.
// Un compte limité à certains dépôts ne voit que leurs stocks.
const ExcelJS = require('exceljs');
const { Op } = require('sequelize');
const {
  RapportHebdo, StockDepot, CamionDepot, ChargementCorridor, VenteMarketeur,
  Depot, Produit, Corridor, Marketeur, Utilisateur, Agent,
} = require('../models');
const { derniereValeurParRapport } = require('./frequence.service');

const MAX_JOURS = 366;
const VERT = 'FF235347';
const VERT_FONCE = 'FF0B2B26';
const VERT_PALE = 'FFEEF7F1';
const BORDURE = { style: 'thin', color: { argb: 'FFD6E5DB' } };
const FMT_DATE = 'dd/mm/yyyy';
const FMT_HEURE = 'dd/mm/yyyy hh:mm';
const FMT_M3 = '#,##0';
const FMT_ENTIER = '#,##0';

const lit = (user, module) => user.is_admin || (user.permissions || []).some(p => p.module === module && ['READ', 'WRITE'].includes(p.action));
const depotsRestreints = (user) => {
  if (user.is_admin) return null;
  const perms = (user.permissions || []).filter(p => p.module === 'stocks');
  if (!perms.length || perms.some(p => !p.depot_id)) return null;
  return [...new Set(perms.map(p => p.depot_id))];
};
const dateExcel = (iso) => (iso ? new Date(`${String(iso).slice(0, 10)}T00:00:00Z`) : null);
const jjmmaaaa = (iso) => String(iso).slice(0, 10).split('-').reverse().join('/');
const nombre = (v) => (v === null || v === undefined ? null : Number(v));

const validerPeriode = (debut, fin) => {
  const re = /^\d{4}-\d{2}-\d{2}$/;
  if (!re.test(debut || '') || !re.test(fin || '') || isNaN(Date.parse(debut)) || isNaN(Date.parse(fin))) {
    throw { status: 400, message: 'Période invalide (dates attendues : AAAA-MM-JJ).' };
  }
  if (fin < debut) throw { status: 400, message: 'La date de fin précède la date de début.' };
  if ((Date.parse(fin) - Date.parse(debut)) / 86400000 > MAX_JOURS) {
    throw { status: 400, message: 'Période trop longue : un an au plus.' };
  }
};

const nomsDesComptes = async (ids) => {
  const liste = [...new Set(ids.filter(Boolean))];
  if (!liste.length) return {};
  const comptes = await Utilisateur.findAll({
    where: { id: liste }, attributes: ['id', 'username'],
    include: [{ model: Agent, as: 'agent', attributes: ['nom', 'prenoms'] }],
  });
  return Object.fromEntries(comptes.map(c => [c.id, c.agent ? `${c.agent.prenoms || ''} ${String(c.agent.nom || '').toUpperCase()}`.trim() : c.username]));
};

// ── Mise en forme commune : titre, sous-titre, en-tête vert, lignes alternées, filtres, volets figés
const feuille = (wb, nom, titre, sousTitre, colonnes) => {
  const ws = wb.addWorksheet(nom, { views: [{ state: 'frozen', ySplit: 4, showGridLines: false }] });
  ws.columns = colonnes.map(c => ({ key: c.cle, width: c.largeur || 14 }));
  // Titre et sous-titre non fusionnés : le texte déborde librement sur les colonnes voisines
  ws.getCell('A1').value = titre;
  ws.getCell('A1').font = { name: 'Arial', bold: true, size: 14, color: { argb: VERT_FONCE } };
  ws.getRow(1).height = 24;
  ws.getCell('A2').value = sousTitre;
  ws.getCell('A2').font = { name: 'Arial', size: 10, color: { argb: 'FF6B7F78' } };
  const entete = ws.getRow(4);
  colonnes.forEach((c, i) => {
    const cell = entete.getCell(i + 1);
    cell.value = c.titre;
    cell.font = { name: 'Arial', bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: VERT } };
    cell.alignment = { vertical: 'middle', horizontal: c.format ? 'right' : 'left', wrapText: true };
    cell.border = { bottom: BORDURE };
  });
  entete.height = 30;
  return ws;
};

const remplir = (ws, colonnes, lignes) => {
  lignes.forEach((l, i) => {
    const row = ws.addRow(l);
    row.eachCell({ includeEmpty: true }, (cell, n) => {
      const c = colonnes[n - 1];
      if (!c) return;
      cell.font = { name: 'Arial', size: 10, bold: !!l._total };
      if (c.format) { cell.numFmt = c.format; cell.alignment = { horizontal: 'right' }; }
      cell.border = { bottom: BORDURE };
      if (l._total) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDAF1DE' } };
      else if (i % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: VERT_PALE } };
    });
  });
  if (!lignes.length) {
    ws.mergeCells(5, 1, 5, colonnes.length);
    ws.getCell('A5').value = 'Aucune saisie sur cette période.';
    ws.getCell('A5').font = { name: 'Arial', italic: true, size: 10, color: { argb: 'FF6B7F78' } };
  } else {
    ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4 + lignes.length, column: colonnes.length } };
  }
};

const colonnesAuteur = [
  { cle: 'saisi_par', titre: 'Saisi par', largeur: 24 },
  { cle: 'saisi_le', titre: 'Saisi le', largeur: 17, format: FMT_HEURE },
  { cle: 'modifie_par', titre: 'Modifié par', largeur: 24 },
  { cle: 'modifie_le', titre: 'Modifié le', largeur: 17, format: FMT_HEURE },
];

const exporterHistorique = async (user, { debut, fin }) => {
  validerPeriode(debut, fin);
  const modules = {
    stocks: lit(user, 'stocks'), depots: lit(user, 'depots-int'), corridors: lit(user, 'corridors'), ventes: lit(user, 'ventes'),
  };
  if (!Object.values(modules).some(Boolean)) throw { status: 403, message: 'Aucune saisie exportable avec vos droits.' };

  // Semaines qui recoupent la période
  const rapports = await RapportHebdo.findAll({
    where: { del: 0, date_debut: { [Op.lte]: fin }, date_fin: { [Op.gte]: debut } },
    order: [['date_debut', 'ASC']], attributes: ['id', 'annee', 'semaine_iso', 'date_debut', 'date_fin', 'statut'],
  });
  const ids = rapports.map(r => r.id);
  const semaine = Object.fromEntries(rapports.map(r => [r.id, r]));
  const libSemaine = (id) => (semaine[id] ? `S${semaine[id].semaine_iso}/${semaine[id].annee}` : '');
  // Saisies datées dans la période ; anciennes saisies hebdomadaires (sans date) : celles des semaines de la période
  const dansPeriode = { [Op.or]: [{ date_saisie: { [Op.between]: [debut, fin] } }, { date_saisie: null, rapport_id: ids.length ? ids : [0] }] };
  const auteurs = (r) => [r.created_by, r.updated_by];

  const [depots, produits, corridors, marketeurs] = await Promise.all([
    Depot.findAll({ attributes: ['id', 'libelle', 'type', 'pays'], raw: true }),
    Produit.findAll({ where: { del: 0 }, attributes: ['id', 'libelle'], order: [['libelle', 'ASC']], raw: true }),
    Corridor.findAll({ attributes: ['id', 'libelle'], raw: true }),
    Marketeur.findAll({ attributes: ['id', 'libelle'], raw: true }),
  ]);
  const parId = (liste) => Object.fromEntries(liste.map(x => [x.id, x]));
  const D = parId(depots); const P = parId(produits); const C = parId(corridors); const M = parId(marketeurs);
  const restreints = depotsRestreints(user);

  const tri = [['date_saisie', 'ASC'], ['id', 'ASC']];
  const stocks = modules.stocks ? await StockDepot.findAll({
    where: { del: 0, ...dansPeriode, ...(restreints ? { depot_id: restreints } : {}) }, order: tri, raw: true,
  }) : [];
  const camions = modules.depots ? await CamionDepot.findAll({ where: { del: 0, ...dansPeriode }, order: tri, raw: true }) : [];
  const chargements = modules.corridors ? await ChargementCorridor.findAll({ where: { del: 0, ...dansPeriode }, order: tri, raw: true }) : [];
  const ventes = modules.ventes ? await VenteMarketeur.findAll({ where: { del: 0, ...dansPeriode }, order: tri, raw: true }) : [];
  const noms = await nomsDesComptes([...stocks, ...camions, ...chargements, ...ventes].flatMap(auteurs));

  const commun = (r) => ({
    date: dateExcel(r.date_saisie || semaine[r.rapport_id]?.date_fin),
    semaine: libSemaine(r.rapport_id),
    saisi_par: noms[r.created_by] || null,
    saisi_le: r.created_at ? new Date(r.created_at) : null,
    modifie_par: r.updated_by ? noms[r.updated_by] || null : null,
    modifie_le: r.updated_by && r.updated_at ? new Date(r.updated_at) : null,
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Indicateur SONABHY';
  wb.created = new Date();
  const periode = `Du ${jjmmaaaa(debut)} au ${jjmmaaaa(fin)}`;
  const genere = `${periode} · exporté le ${jjmmaaaa(new Date().toISOString())} à ${new Date().toISOString().slice(11, 16)}`;

  // ── Synthèse hebdomadaire (stock disponible intérieur par produit)
  if (modules.stocks) {
    const interieurs = stocks.filter(s => D[s.depot_id]?.type === 'INTERIEUR');
    const derniers = derniereValeurParRapport(interieurs, r => `${r.depot_id}_${r.produit_id}`);
    const total = {};
    derniers.forEach(r => { const k = `${r.rapport_id}|${r.produit_id}`; total[k] = (total[k] || 0) + (Number(r.stock_disponible) || 0); });
    const presents = produits.filter(p => rapports.some(r => total[`${r.id}|${p.id}`] !== undefined));
    const cols = [
      { cle: 'semaine', titre: 'Semaine', largeur: 11 },
      { cle: 'du', titre: 'Du', largeur: 12, format: FMT_DATE },
      { cle: 'au', titre: 'Au', largeur: 12, format: FMT_DATE },
      { cle: 'statut', titre: 'Rapport', largeur: 11 },
      ...presents.map(p => ({ cle: `p${p.id}`, titre: `${p.libelle} (m³)`, largeur: 15, format: FMT_M3 })),
    ];
    const ws = feuille(wb, 'Synthèse', 'Stock disponible des dépôts intérieurs', `${genere} · dernière valeur saisie de chaque dépôt dans la semaine${restreints ? ' · dépôts de votre périmètre' : ''}`, cols);
    remplir(ws, cols, rapports.map(r => ({
      semaine: `S${r.semaine_iso}/${r.annee}`, du: dateExcel(r.date_debut), au: dateExcel(r.date_fin),
      statut: r.statut === 'PUBLIE' ? 'Publié' : 'En cours',
      ...Object.fromEntries(presents.map(p => [`p${p.id}`, total[`${r.id}|${p.id}`] ?? null])),
    })));
  }

  // ── Stocks (chaque saisie)
  if (modules.stocks) {
    const cols = [
      { cle: 'date', titre: 'Date', largeur: 12, format: FMT_DATE },
      { cle: 'semaine', titre: 'Semaine', largeur: 10 },
      { cle: 'type', titre: 'Type', largeur: 11 },
      { cle: 'depot', titre: 'Dépôt', largeur: 24 },
      { cle: 'produit', titre: 'Produit', largeur: 14 },
      { cle: 'bacs', titre: 'Stock bacs (m³)', largeur: 15, format: FMT_M3 },
      { cle: 'embr', titre: 'Embranchement (m³)', largeur: 17, format: FMT_M3 },
      { cle: 'dispo', titre: 'Stock disponible (m³)', largeur: 18, format: FMT_M3 },
      ...colonnesAuteur,
    ];
    const ws = feuille(wb, 'Stocks', 'Saisies des stocks', `${genere}${restreints ? ' · dépôts de votre périmètre' : ''}`, cols);
    remplir(ws, cols, stocks.map(r => {
      const d = D[r.depot_id] || {};
      return {
        ...commun(r), type: d.type === 'EXTERIEUR' ? 'Extérieur' : 'Intérieur',
        depot: d.libelle, produit: P[r.produit_id]?.libelle,
        bacs: nombre(r.stock_bacs), embr: d.type === 'EXTERIEUR' ? null : nombre(r.stock_embranchement), dispo: nombre(r.stock_disponible),
      };
    }));
  }

  // ── Dépôts intérieurs (camions)
  if (modules.depots) {
    const cols = [
      { cle: 'date', titre: 'Date', largeur: 12, format: FMT_DATE },
      { cle: 'semaine', titre: 'Semaine', largeur: 10 },
      { cle: 'depot', titre: 'Dépôt', largeur: 24 },
      { cle: 'produit', titre: 'Produit', largeur: 14 },
      { cle: 'attente', titre: 'Camions en attente', largeur: 15, format: FMT_ENTIER },
      { cle: 'recus', titre: 'Camions reçus', largeur: 13, format: FMT_ENTIER },
      { cle: 'depotes', titre: 'Camions dépotés', largeur: 14, format: FMT_ENTIER },
      ...colonnesAuteur,
    ];
    const ws = feuille(wb, 'Dépôts intérieurs', 'Saisies des dépôts intérieurs', genere, cols);
    remplir(ws, cols, camions.map(r => ({
      ...commun(r), depot: D[r.depot_id]?.libelle, produit: P[r.produit_id]?.libelle,
      attente: nombre(r.camions_en_attente), recus: nombre(r.camions_recus), depotes: nombre(r.camions_depotes),
    })));
  }

  // ── Corridors
  if (modules.corridors) {
    const cols = [
      { cle: 'date', titre: 'Date', largeur: 12, format: FMT_DATE },
      { cle: 'semaine', titre: 'Semaine', largeur: 10 },
      { cle: 'corridor', titre: 'Corridor', largeur: 22 },
      { cle: 'produit', titre: 'Produit', largeur: 14 },
      { cle: 'attente', titre: 'Camions en attente', largeur: 15, format: FMT_ENTIER },
      { cle: 'charges', titre: 'Camions chargés', largeur: 14, format: FMT_ENTIER },
      { cle: 'bons', titre: 'Bons émis', largeur: 11, format: FMT_ENTIER },
      { cle: 'objectif', titre: 'Objectif journalier', largeur: 15, format: FMT_ENTIER },
      ...colonnesAuteur,
    ];
    const ws = feuille(wb, 'Corridors', 'Saisies des corridors', genere, cols);
    remplir(ws, cols, chargements.map(r => ({
      ...commun(r), corridor: C[r.corridor_id]?.libelle, produit: P[r.produit_id]?.libelle,
      attente: nombre(r.camions_en_attente), charges: nombre(r.camions_charges), bons: nombre(r.bons_emis), objectif: nombre(r.objectif_journalier),
    })));
  }

  // ── Ventes
  if (modules.ventes) {
    const cols = [
      { cle: 'date', titre: 'Date', largeur: 12, format: FMT_DATE },
      { cle: 'semaine', titre: 'Semaine', largeur: 10 },
      { cle: 'marketeur', titre: 'Marketeur', largeur: 30 },
      { cle: 'produit', titre: 'Produit', largeur: 14 },
      { cle: 'quantite', titre: 'Quantité', largeur: 13, format: '#,##0.###' },
      ...colonnesAuteur,
    ];
    const ws = feuille(wb, 'Ventes', 'Saisies des ventes', genere, cols);
    remplir(ws, cols, ventes.map(r => ({
      ...commun(r), marketeur: M[r.marketeur_id]?.libelle, produit: P[r.produit_id]?.libelle, quantite: nombre(r.quantite),
    })));
  }

  const buffer = await wb.xlsx.writeBuffer();
  return { buffer, filename: `Indicateur_SONABHY_historique_${debut}_${fin}.xlsx` };
};

module.exports = { exporterHistorique, validerPeriode };
