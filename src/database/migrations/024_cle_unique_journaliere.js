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
// Saisie quotidienne des corridors et des depots interieurs : l'ancienne cle unique
// (rapport, corridor|depot, produit) empechait d'enregistrer a partir du 2e jour de la
// semaine (« Cette valeur existe déjà »). On ajoute date_saisie a la cle, comme 016 pour stocks_depot.
const CLES = [
  { table: 'chargements_corridors', ancienne: 'uq_charg',        nouvelle: 'uq_charg_daily',        colonnes: 'rapport_id, corridor_id, produit_id, date_saisie' },
  { table: 'camions_depot',         ancienne: 'uq_camion_depot', nouvelle: 'uq_camion_depot_daily', colonnes: 'rapport_id, depot_id, produit_id, date_saisie' },
];

const indexExiste = async (sequelize, table, nom) => {
  const [r] = await sequelize.query(
    `SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ? LIMIT 1`,
    { replacements: [table, nom] }
  );
  return r.length > 0;
};

module.exports = {
  name: '024_cle_unique_journaliere',
  description: 'Cle unique avec date_saisie pour chargements_corridors et camions_depot',
  async up(sequelize) {
    for (const c of CLES) {
      // La nouvelle cle d'abord : les cles etrangeres sur rapport_id gardent toujours un index
      if (!await indexExiste(sequelize, c.table, c.nouvelle)) {
        await sequelize.query(`ALTER TABLE ${c.table} ADD UNIQUE KEY ${c.nouvelle} (${c.colonnes})`);
      }
      if (await indexExiste(sequelize, c.table, c.ancienne)) {
        await sequelize.query(`ALTER TABLE ${c.table} DROP INDEX ${c.ancienne}`);
      }
    }
  },
};
