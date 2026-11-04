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
// PDF imprimés par Chrome (Puppeteer) : vraie pagination (lignes jamais coupées, en-têtes de tableau
// répétés, numéros de page), texte net et sélectionnable.
//
// Le HTML reçu est rendu dans un Chrome isolé : JavaScript désactivé et toute requête réseau ou fichier
// refusée (seules les images intégrées data: passent). Une page ne peut donc rien lire ni rien appeler.
const puppeteer = require('puppeteer');

const MAX_SIMULTANES = 2;
const DELAI_MS = 60000;

let navigateur = null;
let enCours = 0;
const attente = [];

const obtenirNavigateur = async () => {
  if (navigateur && navigateur.connected) return navigateur;
  navigateur = await puppeteer.launch({
    headless: true,
    args: ['--disable-gpu', '--disable-extensions', '--no-first-run', '--disable-background-networking'],
  });
  navigateur.on('disconnected', () => { navigateur = null; });
  return navigateur;
};

// Au plus MAX_SIMULTANES impressions en même temps : les suivantes attendent leur tour
const prendreTour = () => new Promise((ok) => {
  if (enCours < MAX_SIMULTANES) { enCours++; ok(); } else attente.push(ok);
});
const rendreTour = () => {
  const suivant = attente.shift();
  if (suivant) suivant(); else enCours--;
};

const echapper = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/**
 * @param {string} html  document HTML complet (styles compris)
 * @param {{ paysage?: boolean, pied?: string }} options
 * @returns {Promise<Buffer>}
 */
const imprimer = async (html, { paysage = false, pied = '' } = {}) => {
  await prendreTour();
  let page = null;
  try {
    const nav = await obtenirNavigateur();
    page = await nav.newPage();
    await page.setJavaScriptEnabled(false);
    await page.setRequestInterception(true);
    page.on('request', (r) => (r.url().startsWith('data:') ? r.continue() : r.abort()));
    page.setDefaultTimeout(DELAI_MS);
    await page.setContent(html, { waitUntil: 'load', timeout: DELAI_MS });
    const pdf = await page.pdf({
      format: 'A4',
      landscape: paysage,
      printBackground: true,
      margin: { top: '10mm', right: '10mm', bottom: '14mm', left: '10mm' },
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: `<div style="width:100%;font-family:'Times New Roman',serif;font-size:8pt;color:#555;padding:0 10mm;display:flex;justify-content:space-between">
        <span>${echapper(pied)}</span><span>Page <span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
      timeout: DELAI_MS,
    });
    return Buffer.from(pdf);
  } finally {
    if (page) await page.close().catch(() => {});
    rendreTour();
  }
};

const fermer = async () => { if (navigateur) await navigateur.close().catch(() => {}); };
process.once('SIGINT', fermer);
process.once('SIGTERM', fermer);

module.exports = { imprimer, fermer };
