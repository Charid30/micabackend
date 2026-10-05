module.exports = {
  name: '007_add_date_saisie_to_stocks_depot',
  description: 'Ajout de date_saisie (DATE nullable) dans stocks_depot pour saisie quotidienne',
  async up(sequelize) {
    const cols = await sequelize.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'stocks_depot'`,
      { type: sequelize.QueryTypes.SELECT }
    );
    const existing = cols.map(c => c.COLUMN_NAME);
    if (!existing.includes('date_saisie')) {
      await sequelize.query(`ALTER TABLE stocks_depot ADD COLUMN date_saisie DATE NULL DEFAULT NULL`);
      await sequelize.query(`CREATE INDEX idx_stocks_depot_date ON stocks_depot(rapport_id, depot_id, produit_id, date_saisie)`);
    }
  },
};
