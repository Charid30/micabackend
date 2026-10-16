/* ==================================================================
 *  Auteur : BATIONO Ulrich Rachid Kévin
 *           Expert en Sécurité Informatique
 *           Développeur FullStack
 *           Tel: +226 51 57 82 89 // 66 72 02 32
 *           Whatsapp: +226 51 57 82 89
 *           Mail: bkevin@sonabhy.bf // bationor10@gmail.com
 *  Projet : MICA – SONABHY
 * ================================================================== */
module.exports = {
  name: '009_add_date_saisie_to_chargements_corridors',
  description: 'Ajout de date_saisie (DATE nullable) dans chargements_corridors pour saisie quotidienne',
  async up(sequelize) {
    const cols = await sequelize.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'chargements_corridors'`,
      { type: sequelize.QueryTypes.SELECT }
    );
    const existing = cols.map(c => c.COLUMN_NAME);
    if (!existing.includes('date_saisie')) {
      await sequelize.query(`ALTER TABLE chargements_corridors ADD COLUMN date_saisie DATE NULL DEFAULT NULL`);
      await sequelize.query(`CREATE INDEX idx_charg_corridors_date ON chargements_corridors(rapport_id, corridor_id, produit_id, date_saisie)`);
    }
  },
};
