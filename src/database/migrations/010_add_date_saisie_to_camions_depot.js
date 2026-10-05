module.exports = {
  name: '010_add_date_saisie_to_camions_depot',
  description: 'Ajout de date_saisie (DATE nullable) dans camions_depot pour saisie quotidienne',
  async up(sequelize) {
    const cols = await sequelize.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'camions_depot'`,
      { type: sequelize.QueryTypes.SELECT }
    );
    const existing = cols.map(c => c.COLUMN_NAME);
    if (!existing.includes('date_saisie')) {
      await sequelize.query(`ALTER TABLE camions_depot ADD COLUMN date_saisie DATE NULL DEFAULT NULL`);
      await sequelize.query(`CREATE INDEX idx_camions_depot_date ON camions_depot(rapport_id, depot_id, produit_id, date_saisie)`);
    }
  },
};
