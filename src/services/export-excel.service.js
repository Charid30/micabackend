/* ==================================================================
 *  Auteur : BATIONO Ulrich Rachid Kévin
 *           Expert en Sécurité Informatique
 *           Développeur FullStack
 *           Tel: +226 51 57 82 89 // 66 72 02 32
 *           Whatsapp: +226 51 57 82 89
 *           Mail: bkevin@sonabhy.bf // bationor10@gmail.com
 *  Projet : MICA – SONABHY
 * ================================================================== */
// Export Excel d'un rapport hebdomadaire, au format du classeur de reference Indicateurs.xlsx :
//  - onglet « Autonomie » : depots interieurs, synthese interieure, depots exterieurs, synthese exterieure
//  - onglet « Treso »     : situation de la tresorerie (N, N-1, variation, tendance)
// Les valeurs sont celles calculees par l'application (meme calcul que l'ecran et le PDF) ;
// les cellules derivees sont ecrites en formules pour que le classeur reste exploitable.
const ExcelJS = require('exceljs');
const { RapportHebdo } = require('../models');
const { getAutonomie } = require('./autonomie.service');
const { getTresorerie } = require('./tresorerie.service');
const { getReporting } = require('./reporting.service');

const VERT_SONABHY = 'FF116810';
const GRIS = 'FFF2F2F2';
const JAUNE_OBJECTIF = 'FFFFFF00';
const COULEURS = {
  rouge: { fill: 'FFFFC7CE', font: 'FF9C0006' },
  jaune: { fill: 'FFFFEB9C', font: 'FF9C5700' },
  vert:  { fill: 'FFC6EFCE', font: 'FF006100' },
};
const LIBELLES = { SUPER91: 'Super', PETROLE: 'Pétrole', GASOIL: 'Gasoil', DDO: 'DDO', JET_A1: 'Jet A1', GAZ: 'Gaz', FUEL_OIL: 'Fuel oil' };
const FMT_ENTIER = '#,##0';
const FMT_JOURS = '0.0';
const BORDURE = { style: 'thin', color: { argb: 'FFBFBFBF' } };

const libelle = (l) => LIBELLES[l.produit_code] || l.produit_libelle;
const col = (n) => { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
const jjmm = (d) => { const [, m, j] = String(d).split('-'); return `${j}/${m}`; };

const fill = (cell, argb) => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } }; };
const entete = (cell, texte) => {
  cell.value = texte;
  fill(cell, VERT_SONABHY);
  cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  cell.border = { top: BORDURE, left: BORDURE, bottom: BORDURE, right: BORDURE };
};
const titre = (ws, plage, texte) => {
  ws.mergeCells(plage);
  const c = ws.getCell(plage.split(':')[0]);
  entete(c, texte);
  c.font = { bold: true, size: 13, color: { argb: 'FFFFFFFF' } };
};
const valeur = (cell, v, numFmt, { gris = false, gras = false } = {}) => {
  cell.value = v;
  if (numFmt) cell.numFmt = numFmt;
  if (gris) fill(cell, GRIS);
  if (gras) cell.font = { ...(cell.font || {}), bold: true };
  cell.border = { top: BORDURE, left: BORDURE, bottom: BORDURE, right: BORDURE };
};
const colorer = (cell, couleur) => {
  if (!COULEURS[couleur]) return;
  fill(cell, COULEURS[couleur].fill);
  cell.font = { bold: true, color: { argb: COULEURS[couleur].font } };
};
const formule = (f, result) => ({ formula: f, result: result ?? undefined });
const pertinente = (l) => l.volume_total !== 0 || l.conso_moyenne > 0 || l.impompable > 0;

// ─────────────────────────────── Onglet Autonomie
function feuilleAutonomie(wb, rapport, a) {
  const ws = wb.addWorksheet('Autonomie', { views: [{ showGridLines: false }] });
  const objectif = a.depots_interieurs[0]?.lignes[0]?.objectif_jours ?? 15;
  const interieurs = a.depots_interieurs;
  const exterieurs = a.depots_exterieurs;
  const largeurs = [16, 21, 17, 19, 18, 15, 18, 20, 17, 16, 38, 3, 14];
  largeurs.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

  // ── Depots interieurs (A:K)
  titre(ws, 'A1:K1', `SUIVI DE L'AUTONOMIE PAR SITE ET PAR PRODUIT DEPÔTS INTERIEURS – Semaine ${rapport.semaine_iso}/${rapport.annee} (stocks au ${jjmm(a.date_stocks || rapport.date_fin)})`);
  ws.getRow(1).height = 25.5;
  ws.getCell('A2').value = 'Objectif autonomie minimale (jours) :'; ws.getCell('A2').font = { bold: true };
  valeur(ws.getCell('E2'), objectif, null, { gras: true }); fill(ws.getCell('E2'), JAUNE_OBJECTIF);
  ws.mergeCells('G2:I2');
  ws.getCell('G2').value = 'Objectif taux de couverture stock sécurité :'; ws.getCell('G2').font = { bold: true };
  valeur(ws.getCell('J2'), a.parametres.couverture_objectif_pct / 100, '0%', { gras: true }); fill(ws.getCell('J2'), JAUNE_OBJECTIF);

  ['Site', 'Produit', 'Stock disponible en bacs (m3)', 'Stock en Embranchement (m3)', 'Volume total des stocks (m³)',
    'Impompable*', 'Consommation moyenne j. (m3/j)*', 'Autonomie (jours)', 'Stock de sécurité réglementaire (m3)*',
    'Taux de couverture stock sécurité', 'Actions entreprises pour relever le niveau des stocks']
    .forEach((t, i) => entete(ws.getCell(4, i + 1), t));
  ws.getRow(4).height = 42;

  let r = 5;
  const cellules = {};              // produit_code -> [{ E, F, G }] (adresses des lignes de detail, pour la synthese)
  for (const d of interieurs) {
    const lignes = d.lignes.filter(pertinente);
    lignes.forEach((l, i) => {
      const gris = i % 2 === 1;
      const ligne = ws.getRow(r);
      valeur(ligne.getCell(1), d.depot_libelle, null, { gris });
      valeur(ligne.getCell(2), libelle(l), null, { gris });
      valeur(ligne.getCell(3), l.stock_bacs, FMT_ENTIER, { gris });
      valeur(ligne.getCell(4), l.stock_embranchement, FMT_ENTIER, { gris });
      valeur(ligne.getCell(5), formule(`C${r}+D${r}`, l.volume_total), FMT_ENTIER, { gris });
      valeur(ligne.getCell(6), l.impompable, FMT_ENTIER, { gris });
      valeur(ligne.getCell(7), l.conso_moyenne, FMT_ENTIER, { gris });
      valeur(ligne.getCell(8), formule(`IFERROR((E${r}-F${r})/G${r},"-")`, l.autonomie ?? '-'), FMT_JOURS, { gris, gras: true });
      colorer(ligne.getCell(8), l.couleur);
      const refObjectif = l.objectif_jours === objectif ? '$E$2' : String(l.objectif_jours);
      valeur(ligne.getCell(9), formule(`${refObjectif}*G${r}`, l.stock_securite), FMT_ENTIER, { gris });
      valeur(ligne.getCell(10), formule(`IFERROR(E${r}/I${r},"-")`, l.couverture === null ? '-' : l.couverture / 100), '0%', { gris, gras: true });
      if (l.couverture_ok === false) ligne.getCell(10).font = { bold: true, color: { argb: COULEURS.rouge.font } };
      valeur(ligne.getCell(11), l.action || '', null, { gris });
      ligne.getCell(11).alignment = { wrapText: true, vertical: 'top' };
      (cellules[l.produit_code] ||= []).push({ E: `E${r}`, F: `F${r}`, G: `G${r}`, depot: d.depot_code });
      r++;
    });
  }
  ws.mergeCells(`A${r}:K${r}`);
  ws.getCell(`A${r}`).value = '*Données figées (référentiel) : impompable et consommation moyenne revus chaque année ; stock de sécurité = objectif × consommation moyenne. Le stock de sécurité réglementaire de 90 jours est donné à titre indicatif.';
  fill(ws.getCell(`A${r}`), GRIS); ws.getCell(`A${r}`).alignment = { wrapText: true };
  ws.getRow(r).height = 28;
  const finInterieur = r;

  // ── Synthese interieure (a droite, a partir de la colonne M)
  const c0 = 13;                                  // M
  const nbD = interieurs.length;
  const cTotal = c0 + nbD + 1, cAuto = cTotal + 1, cTonnes = cAuto + 1;
  for (let c = c0; c <= cTonnes; c++) ws.getColumn(c).width = c === c0 ? 14 : 17;
  ws.mergeCells(2, c0, 2, cTonnes);
  entete(ws.getCell(2, c0), 'SITUATION DES STOCKS INTERIEURES');
  entete(ws.getCell(4, c0), 'Produit');
  interieurs.forEach((d, i) => entete(ws.getCell(4, c0 + 1 + i), `Volume ${d.depot_libelle} en m3`));
  entete(ws.getCell(4, cTotal), 'Total Stock dépôt intérieurs en m3');
  entete(ws.getCell(4, cAuto), 'Autonomie des dépôts intérieurs (en jours)');
  entete(ws.getCell(4, cTonnes), 'Équivalent en tonnes (gaz)');

  let rs = 5;
  a.synthese_interieure.forEach((l, i) => {
    const gris = i % 2 === 1;
    const refs = cellules[l.produit_code] || [];
    valeur(ws.getCell(rs, c0), libelle(l), null, { gris });
    interieurs.forEach((d, j) => {
      const ref = refs.find(x => x.depot === d.depot_code);
      valeur(ws.getCell(rs, c0 + 1 + j), ref ? formule(ref.E, l.par_depot[d.depot_code]) : 0, FMT_ENTIER, { gris });
    });
    valeur(ws.getCell(rs, cTotal), formule(`SUM(${col(c0 + 1)}${rs}:${col(c0 + nbD)}${rs})`, l.volume_total), FMT_ENTIER, { gris });
    // Autonomie consolidee : (somme des volumes - somme des impompables) / somme des consommations
    const f = refs.length ? `IFERROR((${col(cTotal)}${rs}-(${refs.map(x => x.F).join('+')}))/(${refs.map(x => x.G).join('+')}),"-")` : '"-"';
    valeur(ws.getCell(rs, cAuto), formule(f, l.autonomie ?? '-'), FMT_JOURS, { gris, gras: true });
    colorer(ws.getCell(rs, cAuto), l.couleur);
    valeur(ws.getCell(rs, cTonnes), l.volume_total_tonnes !== null
      ? formule(`${col(cTotal)}${rs}*${a.parametres.densite_gaz}`, l.volume_total_tonnes) : '', '#,##0.0', { gris });
    rs++;
  });
  valeur(ws.getCell(rs, c0), 'CUMUL', null, { gras: true }); fill(ws.getCell(rs, c0), 'FFE7E6E6');
  for (let c = c0 + 1; c <= cTotal; c++) {
    valeur(ws.getCell(rs, c), formule(`SUM(${col(c)}5:${col(c)}${rs - 1})`), FMT_ENTIER, { gras: true });
    fill(ws.getCell(rs, c), 'FFE7E6E6');
  }

  // ── Depots exterieurs
  let re = Math.max(finInterieur, rs) + 5;
  const debutExt = re;
  titre(ws, `A${re}:H${re}`, `SUIVI DE L'AUTONOMIE PAR SITE ET PAR PRODUIT DEPÔTS EXTERIEURS – Semaine ${rapport.semaine_iso}/${rapport.annee}`);
  ws.getRow(re).height = 20;
  re++;
  ws.getCell(`A${re}`).value = 'Objectif autonomie minimale (jours) :'; ws.getCell(`A${re}`).font = { bold: true };
  valeur(ws.getCell(`E${re}`), objectif, null, { gras: true }); fill(ws.getCell(`E${re}`), JAUNE_OBJECTIF);
  re += 2;
  const enteteExt = re;
  ['Site', 'Produit', '', '', 'Stock disponible (m3)', 'Besoins moyenne j. (m3/j)*', 'Autonomie (jours)', 'Actions entreprises pour relever le niveau des stocks']
    .forEach((t, i) => { if (t) entete(ws.getCell(re, i + 1), t); });
  ws.getRow(re).height = 45;
  re++;

  const cellulesExt = {};           // produit_code -> { pays: adresse E }
  for (const d of exterieurs) {
    const debut = re;
    d.lignes.forEach((l, i) => {
      const gris = i % 2 === 1;
      const ligne = ws.getRow(re);
      valeur(ligne.getCell(2), libelle(l), null, { gris });
      valeur(ligne.getCell(5), l.stock_disponible, FMT_ENTIER, { gris });
      if (l.negatif) ligne.getCell(5).font = { bold: true, color: { argb: COULEURS.rouge.font } };
      valeur(ligne.getCell(6), l.besoin_journalier, FMT_ENTIER, { gris });
      valeur(ligne.getCell(7), formule(`IFERROR(E${re}/F${re},"-")`, l.autonomie ?? '-'), FMT_JOURS, { gris, gras: true });
      colorer(ligne.getCell(7), l.couleur);
      valeur(ligne.getCell(8), l.action || '', null, { gris });
      ligne.getCell(8).alignment = { wrapText: true, vertical: 'top' };
      (cellulesExt[l.produit_code] ||= {})[d.depot_code] = `E${re}`;
      re++;
    });
    if (re - 1 > debut) ws.mergeCells(`A${debut}:A${re - 1}`);
    valeur(ws.getCell(`A${debut}`), d.pays || d.depot_libelle, null, { gras: true });
    ws.getCell(`A${debut}`).alignment = { vertical: 'middle', horizontal: 'center' };
    re++;                           // ligne vide entre deux pays, comme dans le classeur de reference
  }
  ws.mergeCells(`A${re}:H${re}`);
  ws.getCell(`A${re}`).value = '*Besoins moyenne j. (m3/j) : valeur fixée par la DSTA pour chaque produit (besoins des dépôts intérieurs et des clients desservis).';
  fill(ws.getCell(`A${re}`), GRIS); ws.getCell(`A${re}`).alignment = { wrapText: true };

  // ── Synthese exterieure
  const nbP = exterieurs.length;
  const eTotal = c0 + nbP + 1, eAuto = eTotal + 1, eTonnes = eAuto + 1;
  for (let c = c0 + 1; c <= eTonnes; c++) if (!ws.getColumn(c).width || ws.getColumn(c).width < 15) ws.getColumn(c).width = 15;
  ws.mergeCells(debutExt + 1, c0, debutExt + 1, eTonnes);
  entete(ws.getCell(debutExt + 1, c0), 'SITUATION DES STOCKS EXTERIEURES');
  entete(ws.getCell(enteteExt, c0), 'PRODUIT');
  exterieurs.forEach((d, i) => entete(ws.getCell(enteteExt, c0 + 1 + i), d.pays || d.depot_libelle));
  entete(ws.getCell(enteteExt, eTotal), 'Total dépôt extérieurs en m3');
  entete(ws.getCell(enteteExt, eAuto), 'Autonomie des dépôts extérieurs (en jours)');
  entete(ws.getCell(enteteExt, eTonnes), 'Équivalent en tonnes (gaz)');
  let rx = enteteExt + 1;
  const debutSynthExt = rx;
  const exclusions = [];
  a.synthese_exterieure.forEach((l, i) => {
    const gris = i % 2 === 1;
    valeur(ws.getCell(rx, c0), libelle(l), null, { gris });
    const inclus = [];
    exterieurs.forEach((d, j) => {
      const c = ws.getCell(rx, c0 + 1 + j);
      const ref = cellulesExt[l.produit_code]?.[d.depot_code];
      valeur(c, ref ? formule(ref, l.par_pays[d.depot_code]) : 0, FMT_ENTIER, { gris });
      if (l.exclus.includes(d.depot_code)) {
        c.font = { italic: true, color: { argb: 'FF808080' } };
        c.note = 'Exclu du total (dette de produit)';
        exclusions.push(`${d.pays || d.depot_libelle} – ${libelle(l)}`);
      } else inclus.push(`${col(c0 + 1 + j)}${rx}`);
    });
    valeur(ws.getCell(rx, eTotal), formule(inclus.length ? inclus.join('+') : '0', l.volume_total), FMT_ENTIER, { gris });
    valeur(ws.getCell(rx, eAuto), formule(l.besoin_journalier > 0 ? `${col(eTotal)}${rx}/${l.besoin_journalier}` : '"-"', l.autonomie ?? '-'), FMT_JOURS, { gris, gras: true });
    colorer(ws.getCell(rx, eAuto), l.couleur);
    valeur(ws.getCell(rx, eTonnes), l.volume_total_tonnes !== null
      ? formule(`${col(eTotal)}${rx}*${a.parametres.densite_gaz}`, l.volume_total_tonnes) : '', '#,##0.0', { gris });
    rx++;
  });
  valeur(ws.getCell(rx, c0), 'CUMUL', null, { gras: true }); fill(ws.getCell(rx, c0), 'FFE7E6E6');
  for (let c = c0 + 1; c <= eTotal; c++) {
    valeur(ws.getCell(rx, c), formule(`SUM(${col(c)}${debutSynthExt}:${col(c)}${rx - 1})`), FMT_ENTIER, { gras: true });
    fill(ws.getCell(rx, c), 'FFE7E6E6');
  }
  if (exclusions.length) {
    ws.getCell(rx + 1, c0).value = `Exclu(s) du total : ${exclusions.join(', ')} (dette de produit).`;
    ws.getCell(rx + 1, c0).font = { italic: true, color: { argb: 'FF808080' } };
  }

  // Legende des couleurs
  const rl = Math.max(re, rx) + 3;
  ws.getCell(`A${rl}`).value = 'Légende autonomie :'; ws.getCell(`A${rl}`).font = { bold: true };
  const p = a.parametres;
  [['rouge', `< ${p.seuil_rouge_jours} jours`], ['jaune', `${p.seuil_rouge_jours} à < ${objectif} jours`], ['vert', `≥ ${objectif} jours`]]
    .forEach(([c, t], i) => { const cell = ws.getCell(rl, 2 + i); cell.value = t; colorer(cell, c); cell.alignment = { horizontal: 'center' }; });
  ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 };
}

// ─────────────────────────────── Onglet Treso
function feuilleTresorerie(wb, rapport, t) {
  const ws = wb.addWorksheet('Treso', { views: [{ showGridLines: false }] });
  [55, 20, 20, 16, 16, 15].forEach((w, i) => { ws.getColumn(i + 1).width = w; });
  titre(ws, 'A1:F1', 'SITUATION DE LA TRESORERIE');
  ws.getRow(1).height = 25.5;
  const prec = t.rapport_precedent;
  ['Indicateur', `Semaine du ${jjmm(rapport.date_debut)} au ${jjmm(rapport.date_fin)}`,
    prec ? `Semaine ${prec.semaine_iso}/${prec.annee} (N-1)` : 'Semaine précédente (N-1)', 'Variation', 'Tendance', 'Fréquence']
    .forEach((x, i) => entete(ws.getCell(4, i + 1), x));
  ws.getRow(4).height = 30;

  // Les dettes sont affichees en negatif, comme dans le classeur de reference
  const signe = (l) => (l.sens === 'DETTE' && l.type !== 'TOTAL' ? -1 : 1);
  const adresses = {};
  let r = 5;
  t.lignes.forEach((l, i) => { adresses[l.id] = r + i; });
  t.lignes.forEach((l, i) => {
    const gris = i % 2 === 0;
    const gras = l.type !== 'SAISIE' || l.niveau === 0;
    const row = ws.getRow(r);
    const n = l.montant_n === null ? null : signe(l) * l.montant_n;
    const n1 = l.montant_n1 === null ? null : signe(l) * l.montant_n1;
    valeur(row.getCell(1), l.libelle, null, { gris, gras });
    row.getCell(1).alignment = { wrapText: true, vertical: 'middle', indent: l.niveau ? 2 : 0 };
    let fN = null, fN1 = null;
    if (l.type === 'SOUS_TOTAL') {
      const enfants = t.lignes.filter(x => x.parent_id === l.id).map(x => adresses[x.id]);
      if (enfants.length) { fN = enfants.map(a => `B${a}`).join('+'); fN1 = enfants.map(a => `C${a}`).join('+'); }
    } else if (l.type === 'TOTAL') {
      const premiers = t.lignes.filter(x => !x.parent_id && x.type !== 'TOTAL').map(x => adresses[x.id]);
      fN = premiers.map(a => `B${a}`).join('+'); fN1 = premiers.map(a => `C${a}`).join('+');
    }
    valeur(row.getCell(2), fN && n !== null ? formule(fN, n) : n, FMT_ENTIER, { gris, gras });
    valeur(row.getCell(3), fN1 && n1 !== null ? formule(fN1, n1) : n1, FMT_ENTIER, { gris, gras });
    // Variation : en % ; en FCFA quand le signe change (le % n'a alors pas de sens)
    if (l.ecart === null) valeur(row.getCell(4), '-', null, { gris });
    else if (l.changement_signe) {
      valeur(row.getCell(4), formule(`B${r}-C${r}`, signe(l) * l.ecart), '#,##0" FCFA"', { gris, gras: true });
    } else {
      // Dette (montants negatifs) : (B-C)/C donne +x % quand la dette augmente, comme dans le classeur de reference
      const f = signe(l) < 0 ? `IFERROR((B${r}-C${r})/C${r},"-")` : `IFERROR((B${r}-C${r})/ABS(C${r}),"-")`;
      valeur(row.getCell(4), formule(f, l.variation_pct), '0.0%', { gris, gras: true });
    }
    const fleche = { hausse: '▲ Hausse', baisse: '▼ Baisse', stable: '→ Stable' }[l.tendance] || '-';
    valeur(row.getCell(5), fleche, null, { gris, gras: true });
    if (l.favorable !== null) row.getCell(5).font = { bold: true, color: { argb: l.favorable ? COULEURS.vert.font : COULEURS.rouge.font } };
    row.getCell(5).alignment = { horizontal: 'center' };
    valeur(row.getCell(6), 'Hebdomadaire', null, { gris });
    row.height = l.libelle.length > 60 ? 30 : 19.5;
    r++;
  });
  r++;
  ws.mergeCells(`A${r}:F${r}`);
  ws.getCell(`A${r}`).value = 'Légende : flèche verte = évolution favorable, flèche rouge = évolution défavorable (une hausse de dette est défavorable). Variation en FCFA lorsque le solde change de signe.';
  ws.getCell(`A${r}`).font = { italic: true }; ws.getCell(`A${r}`).alignment = { wrapText: true };
  ws.getRow(r).height = 30;
  ws.pageSetup = { orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 };
}

// ─────────────────────────────── Onglet Reporting (document REPORTING de la direction)
const nbFr = (n) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(n).replace(/ | /g, ' ');
const jj = (n) => String(Math.abs(n)).padStart(2, '0');
const pluriel = (n) => (Math.abs(n) > 1 ? 's' : '');
const ligneStock = (s) => (s.sans_bac
  ? `${s.produit} : 00 (la SONABHY ne dispose pas de bac dédié)`
  : `${s.produit} : ${nbFr(s.quantite)} ${s.unite}${s.jours === null ? '' : ` soit ${s.jours < 0 ? '-' : ''}${jj(s.jours)} jour${pluriel(s.jours)}`}`);
const ligneEvolution = (s) => {
  if (s.evolution_jours === null) return null;
  if (s.evolution_jours === 0) return `${s.produit} : stable`;
  return `${s.produit} : en ${s.evolution_jours > 0 ? 'hausse' : 'baisse'} de ${jj(s.evolution_jours)} jour${pluriel(s.evolution_jours)}`;
};
const jjmmaaaa = (d) => { const [a, m, j] = String(d).split('-'); return `${j}/${m}/${a}`; };

function feuilleReporting(wb, rapport, r) {
  const ws = wb.addWorksheet('Reporting', { views: [{ showGridLines: false }] });
  [26, 18, 18, 18, 18, 18, 18, 18].forEach((w, i) => { ws.getColumn(i + 1).width = w; });
  let n = 1;
  const titreSection = (t) => {
    ws.mergeCells(n, 1, n, 8);
    const c = ws.getCell(n, 1); c.value = t; c.font = { bold: true, size: 12, color: { argb: VERT_SONABHY } };
    n += 1;
  };
  const texte = (t, { gras = false, puce = false } = {}) => {
    ws.mergeCells(n, 1, n, 8);
    const c = ws.getCell(n, 1); c.value = puce ? `•  ${t}` : t;
    c.font = { bold: gras }; c.alignment = { wrapText: true, vertical: 'top', indent: puce ? 1 : 0 };
    if (t.length > 110) ws.getRow(n).height = 15 * Math.ceil(t.length / 110);
    n += 1;
  };
  const colonneStock = (cell, s) => {
    valeur(cell, ligneStock(s));
    if (COULEURS[s.couleur]) { fill(cell, COULEURS[s.couleur].fill); cell.font = { color: { argb: COULEURS[s.couleur].font } }; }
  };

  titre(ws, 'A1:H1', `SITUATION DES STOCKS SONABHY A LA DATE DU ${jjmmaaaa(r.date)}`);
  ws.getRow(1).height = 25.5;
  n = 3;

  titreSection('1. SITUATION DES STOCKS');
  if (r.informations_utiles.length) {
    texte('Informations utiles :', { gras: true });
    r.informations_utiles.forEach(t => texte(t, { puce: true }));
    n += 1;
  }
  texte('Stocks en bacs', { gras: true });
  ws.mergeCells(n, 1, n, 4); ws.mergeCells(n, 5, n, 8);
  entete(ws.getCell(n, 1), 'Stocks dans les dépôts intérieurs');
  entete(ws.getCell(n, 5), 'Stocks dans les dépôts extérieurs');
  n += 1;
  const nb = Math.max(r.stocks.interieurs.length, r.stocks.exterieurs.length);
  for (let i = 0; i < nb; i++) {
    ws.mergeCells(n, 1, n, 4); ws.mergeCells(n, 5, n, 8);
    if (r.stocks.interieurs[i]) colonneStock(ws.getCell(n, 1), r.stocks.interieurs[i]);
    if (r.stocks.exterieurs[i]) colonneStock(ws.getCell(n, 5), r.stocks.exterieurs[i]);
    n += 1;
  }
  if (r.evolution_consommations.length) {
    ws.mergeCells(n, 1, n, 8);
    valeur(ws.getCell(n, 1), `Évolution des consommations : ${r.evolution_consommations
      .map(e => `${e.ecart < 0 ? 'baisse' : 'hausse'} ${e.produit.toLowerCase()} : ${nbFr(Math.abs(e.ecart))}`).join(' ; ')}`);
    ws.getCell(n, 1).alignment = { wrapText: true };
    n += 1;
  }
  const obsI = r.stocks.interieurs.map(ligneEvolution).filter(Boolean);
  const obsE = r.stocks.exterieurs.map(ligneEvolution).filter(Boolean);
  if (obsI.length || obsE.length) {
    ws.mergeCells(n, 1, n, 4); ws.mergeCells(n, 5, n, 8);
    const cI = ws.getCell(n, 1); const cE = ws.getCell(n, 5);
    valeur(cI, `Observations : évolution de l'autonomie\n${obsI.join('\n')}`);
    valeur(cE, `Observations : évolution de l'autonomie\n${obsE.join('\n')}`);
    cI.alignment = { wrapText: true, vertical: 'top' }; cE.alignment = { wrapText: true, vertical: 'top' };
    ws.getRow(n).height = 15 * (Math.max(obsI.length, obsE.length) + 1);
    n += 1;
  }
  n += 1;

  const e = r.encours;
  texte(`Encours de livraison (promesses de livraison)${e.du ? ` du ${jjmmaaaa(e.du)} au ${jjmmaaaa(e.au)}` : ''}`
    + `${e.ports.length ? ` (livraison ${e.ports.join(', ')})` : ''}`, { gras: true });
  if (!e.lignes.some(l => l.quantite > 0)) texte('Aucune livraison attendue.', { puce: true });
  else e.lignes.forEach(l => texte(`${l.produit} : ${l.quantite ? `${nbFr(l.quantite)} ${l.unite}${l.jours ? ` soit environ ${jj(l.jours)} jours` : ''}` : '00'}`, { puce: true }));
  n += 1;

  titreSection('2. QUANTITÉ DE PRODUITS SERVIES AUX MARKETEURS AU COURS DE LA SEMAINE');
  entete(ws.getCell(n, 1), 'PÉRIODE');
  r.ventes.produits.forEach((p, i) => entete(ws.getCell(n, 2 + i), p.produit));
  n += 1;
  r.ventes.periodes.forEach(pe => {
    valeur(ws.getCell(n, 1), pe.libelle);
    r.ventes.produits.forEach((p, i) => valeur(ws.getCell(n, 2 + i), pe.valeurs[p.code] || 0, FMT_ENTIER));
    n += 1;
  });
  if (r.ventes.evolution) {
    valeur(ws.getCell(n, 1), 'ÉVOLUTION', null, { gras: true });
    r.ventes.produits.forEach((p, i) => {
      const c = ws.getCell(n, 2 + i);
      valeur(c, r.ventes.evolution[p.code] || 0, '+#,##0;-#,##0;0', { gras: true });
      if (r.ventes.evolution[p.code] < 0) c.font = { bold: true, color: { argb: COULEURS.rouge.font } };
    });
    n += 1;
  }
  n += 1;

  titreSection('3. DETTES');
  const d = r.dettes;
  [["Dettes de l'État envers SONABHY", d.dettes_etat],
    ["Créances de l'État sur SONABHY (plus-values, fiscalité)", d.creances_etat],
    ['Engagement fournisseurs SONABHY', d.engagement_fournisseurs]]
    .forEach(([l, v]) => {
      ws.mergeCells(n, 1, n, 3); valeur(ws.getCell(n, 1), l, null, { gras: true });
      ws.mergeCells(n, 4, n, 5); valeur(ws.getCell(n, 4), v === null ? 'non renseigné' : v, '#,##0" FCFA"');
      n += 1;
    });
  n += 1;

  titreSection('4. DIFFICULTÉS MAJEURES');
  if (!r.difficultes.length) texte('Néant.', { puce: true });
  r.difficultes.forEach(t => texte(t, { puce: true }));
  if (r.recommandations.length) {
    n += 1;
    titreSection('5. RECOMMANDATIONS');
    r.recommandations.forEach(t => texte(t, { puce: true }));
  }
  ws.pageSetup = { orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 };
}

const exporterRapport = async (rapportId) => {
  const rapport = await RapportHebdo.findOne({ where: { id: rapportId, del: 0 } });
  if (!rapport) throw { status: 404, message: 'Rapport introuvable.' };
  const [autonomie, tresorerie, reporting] = await Promise.all([getAutonomie(rapport), getTresorerie(rapport), getReporting(rapport)]);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'MICA – SONABHY';
  wb.created = new Date();
  // Excel recalcule les formules a l'ouverture (valeurs toujours coherentes avec les donnees saisies)
  wb.calcProperties.fullCalcOnLoad = true;
  feuilleReporting(wb, rapport, reporting);
  feuilleAutonomie(wb, rapport, autonomie);
  feuilleTresorerie(wb, rapport, tresorerie);
  return {
    buffer: await wb.xlsx.writeBuffer(),
    filename: `MICA_Indicateurs_S${String(rapport.semaine_iso).padStart(2, '0')}_${rapport.annee}.xlsx`,
  };
};

module.exports = { exporterRapport };
