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
 * Règle vendredi : dès que le rapport de la semaine courante est PUBLIE,
 * la saisie passe à la semaine suivante — la nouvelle semaine démarre
 * le vendredi même de publication (cycle vendredi→jeudi).
 */
const getOrCreateRapportSemaine = async (userId) => {
  const now = new Date();

  if (now.getUTCDay() === 5) {
    const semaineActuelle = getISOWeek(now);
    const anneeActuelle = now.getUTCFullYear();
    const rapportActuel = await RapportHebdo.findOne({
      where: { annee: anneeActuelle, semaine_iso: semaineActuelle, del: 0 },
    });
    if (rapportActuel && rapportActuel.statut === 'PUBLIE') {
      // La nouvelle semaine métier démarre aujourd'hui (ce vendredi)
      const nextMonday = new Date(now);
      nextMonday.setUTCDate(now.getUTCDate() + 3);
      const annee = nextMonday.getUTCFullYear();
      const semaine = getISOWeek(nextMonday);
      // debut = ce vendredi, fin = jeudi prochain
      const { debut, fin } = getISOWeekDates(now);
      const [rapport, created] = await RapportHebdo.findOrCreate({
        where: { annee, semaine_iso: semaine, del: 0 },
        defaults: { annee, semaine_iso: semaine, date_debut: debut, date_fin: fin, statut: 'BROUILLON', created_by: userId },
      });
      // Corriger les dates si le rapport existait avec l'ancien calcul (lundi→vendredi)
      if (!created && (rapport.date_debut !== debut || rapport.date_fin !== fin)) {
        await rapport.update({ date_debut: debut, date_fin: fin });
      }
      return rapport;
    }
  }

  const annee = now.getUTCFullYear();
  const semaine = getISOWeek(now);
  const { debut, fin } = getISOWeekDates(now);
  const [rapport] = await RapportHebdo.findOrCreate({
    where: { annee, semaine_iso: semaine, del: 0 },
    defaults: { annee, semaine_iso: semaine, date_debut: debut, date_fin: fin, statut: 'BROUILLON', created_by: userId },
  });
  return rapport;
};

module.exports = { getOrCreateRapportSemaine };
