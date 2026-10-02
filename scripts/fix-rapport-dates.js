/**
 * Script one-shot : recalcule date_debut / date_fin de tous les rapports
 * selon le cycle métier vendredi → jeudi.
 *   debut = lundi ISO - 3 j  (vendredi précédent)
 *   fin   = lundi ISO + 3 j  (jeudi de la semaine)
 * Exemple sem. 39/2026 : 18/09 – 24/09
 * Exemple sem. 40/2026 : 25/09 – 01/10
 *
 * Lancer une seule fois : node scripts/fix-rapport-dates.js
 */
require('dotenv').config();
const { sequelize, RapportHebdo } = require('../src/models');

function getMondayOfISOWeek(annee, semaine) {
  // Le 4 janvier est toujours en semaine 1
  const jan4 = new Date(Date.UTC(annee, 0, 4));
  const dayOfJan4 = jan4.getUTCDay() || 7;
  const mondayWeek1 = new Date(jan4);
  mondayWeek1.setUTCDate(jan4.getUTCDate() - dayOfJan4 + 1);
  const monday = new Date(mondayWeek1);
  monday.setUTCDate(mondayWeek1.getUTCDate() + (semaine - 1) * 7);
  return monday;
}

function getWeekDatesFriToThu(annee, semaine) {
  const monday = getMondayOfISOWeek(annee, semaine);
  const debut = new Date(monday);
  debut.setUTCDate(monday.getUTCDate() - 3); // vendredi précédent
  const fin = new Date(monday);
  fin.setUTCDate(monday.getUTCDate() + 3);   // jeudi de la semaine
  return {
    debut: debut.toISOString().split('T')[0],
    fin: fin.toISOString().split('T')[0],
  };
}

async function main() {
  await sequelize.authenticate();
  const rapports = await RapportHebdo.findAll({ where: { del: 0 } });
  let fixed = 0;
  for (const r of rapports) {
    const { debut, fin } = getWeekDatesFriToThu(r.annee, r.semaine_iso);
    if (r.date_debut !== debut || r.date_fin !== fin) {
      console.log(`Sem. ${r.semaine_iso}/${r.annee} : ${r.date_debut}–${r.date_fin}  →  ${debut}–${fin}`);
      await r.update({ date_debut: debut, date_fin: fin });
      fixed++;
    }
  }
  console.log(`\n${fixed} rapport(s) corrigé(s).`);
  await sequelize.close();
}

main().catch((err) => { console.error(err); process.exit(1); });
