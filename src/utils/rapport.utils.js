const { RapportHebdo } = require('../models');

function getISOWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

// Cycle métier vendredi → jeudi :
//   debut = lundi de la semaine ISO - 3 j  (= vendredi précédent)
//   fin   = lundi de la semaine ISO + 3 j  (= jeudi de cette semaine)
// Exemple sem. 39 : lundi 21/09 → debut 18/09, fin 24/09
// Exemple sem. 40 : lundi 28/09 → debut 25/09, fin 01/10
function getISOWeekDates(date) {
  const d = new Date(date);
  const day = d.getUTCDay() || 7; // 1=Lun … 7=Dim
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day + 1));
  const debut = new Date(monday);
  debut.setUTCDate(monday.getUTCDate() - 3);
  const fin = new Date(monday);
  fin.setUTCDate(monday.getUTCDate() + 3);
  return { debut: debut.toISOString().split('T')[0], fin: fin.toISOString().split('T')[0] };
}

/**
 * Retourne (ou crée) le rapport BROUILLON pour la saisie.
 *
 * Règle métier (cycle vendredi→jeudi) :
 *   Dès que le rapport de la semaine ISO courante est PUBLIE,
 *   la saisie passe à la semaine suivante — quel que soit le jour.
 *   La nouvelle semaine démarre le vendredi de la semaine ISO suivante.
 */
const getOrCreateRapportSemaine = async (userId) => {
  const now = new Date();
  const annee = now.getUTCFullYear();
  const semaine = getISOWeek(now);
  const { debut, fin } = getISOWeekDates(now);

  // Si le rapport de la semaine ISO courante est déjà PUBLIE,
  // ouvrir la semaine suivante (vendredi→jeudi), peu importe le jour actuel.
  const rapportCourant = await RapportHebdo.findOne({
    where: { annee, semaine_iso: semaine, del: 0 },
  });

  if (rapportCourant && rapportCourant.statut === 'PUBLIE') {
    const currentDay = now.getUTCDay() || 7; // 1=Lun … 7=Dim
    const nextMonday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    nextMonday.setUTCDate(nextMonday.getUTCDate() + (8 - currentDay)); // prochain lundi
    const nextAnnee   = nextMonday.getUTCFullYear();
    const nextSemaine = getISOWeek(nextMonday);
    const { debut: nextDebut, fin: nextFin } = getISOWeekDates(nextMonday);

    const [rapport, created] = await RapportHebdo.findOrCreate({
      where: { annee: nextAnnee, semaine_iso: nextSemaine, del: 0 },
      defaults: { annee: nextAnnee, semaine_iso: nextSemaine, date_debut: nextDebut, date_fin: nextFin, statut: 'BROUILLON', created_by: userId },
    });
    // Corriger les dates si le rapport existait avec un ancien calcul
    if (!created && (rapport.date_debut !== nextDebut || rapport.date_fin !== nextFin)) {
      await rapport.update({ date_debut: nextDebut, date_fin: nextFin });
    }
    return rapport;
  }

  const [rapport] = await RapportHebdo.findOrCreate({
    where: { annee, semaine_iso: semaine, del: 0 },
    defaults: { annee, semaine_iso: semaine, date_debut: debut, date_fin: fin, statut: 'BROUILLON', created_by: userId },
  });
  return rapport;
};

module.exports = { getOrCreateRapportSemaine };
