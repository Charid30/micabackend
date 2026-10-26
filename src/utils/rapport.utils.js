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
const { RapportHebdo } = require('../models');

const JOUR = 86400000;
const iso = (d) => d.toISOString().split('T')[0];

// Numero de semaine ISO (et annee ISO) d'une date, calcule en UTC (Ouagadougou = UTC+0)
function getISOWeek(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return { semaine: Math.ceil(((d - yearStart) / JOUR + 1) / 7), annee: d.getUTCFullYear() };
}

/**
 * Cycle metier vendredi -> jeudi contenant la date.
 *   debut = vendredi le plus recent (la date elle-meme si c'est un vendredi), fin = jeudi suivant
 *   numero = semaine ISO du lundi du cycle (debut + 3 j)
 * Exemple : vendredi 09/10/2026 -> jeudi 15/10/2026 = semaine 42 (lundi 12/10)
 * Le cycle ne depend que de la date : une saisie du vendredi, samedi ou dimanche va toujours
 * dans le nouveau cycle, que la publication du vendredi ait eu lieu ou non.
 */
function cycleDe(date) {
  const jour = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const recul = (jour.getUTCDay() - 5 + 7) % 7;           // jours depuis le vendredi
  const debut = new Date(jour.getTime() - recul * JOUR);
  const fin = new Date(debut.getTime() + 6 * JOUR);
  const { semaine, annee } = getISOWeek(new Date(debut.getTime() + 3 * JOUR));
  return { annee, semaine, debut: iso(debut), fin: iso(fin) };
}

/**
 * Retourne (ou cree) le rapport BROUILLON du cycle en cours pour la saisie.
 * Si le rapport du cycle en cours a deja ete publie (archivage anticipe), la saisie passe au cycle suivant.
 */
const getOrCreateRapportSemaine = async (userId) => {
  let cycle = cycleDe(new Date());
  for (let i = 0; i < 4; i++) {
    const existant = await RapportHebdo.findOne({ where: { annee: cycle.annee, semaine_iso: cycle.semaine, del: 0 } });
    if (!existant || existant.statut !== 'PUBLIE') break;
    cycle = cycleDe(new Date(Date.parse(cycle.fin) + JOUR));
  }

  const [rapport, created] = await RapportHebdo.findOrCreate({
    where: { annee: cycle.annee, semaine_iso: cycle.semaine, del: 0 },
    defaults: { annee: cycle.annee, semaine_iso: cycle.semaine, date_debut: cycle.debut, date_fin: cycle.fin, statut: 'BROUILLON', created_by: userId },
  });
  // Corriger les dates d'un rapport cree par un ancien calcul
  if (!created && rapport.statut === 'BROUILLON' && (rapport.date_debut !== cycle.debut || rapport.date_fin !== cycle.fin)) {
    await rapport.update({ date_debut: cycle.debut, date_fin: cycle.fin });
  }
  // Menus en frequence permanente : valeurs de la semaine precedente reprises si rien n'est encore saisi
  try { await require('../services/frequence.service').reporterPermanents(rapport, userId); }
  catch (e) { console.error('[Frequences] Report des valeurs permanentes :', e.message); }
  return rapport;
};

module.exports = { getOrCreateRapportSemaine, cycleDe };
