module.exports = {
  name: '008_add_must_change_password_to_utilisateurs',
  description: 'Ajout de must_change_password (TINYINT) dans utilisateurs pour forcer changement au 1er login',
  async up(sequelize) {
    const cols = await sequelize.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'utilisateurs'`,
      { type: sequelize.QueryTypes.SELECT }
    );
    const existing = cols.map(c => c.COLUMN_NAME);
    if (!existing.includes('must_change_password')) {
      await sequelize.query(`ALTER TABLE utilisateurs ADD COLUMN must_change_password TINYINT(1) NOT NULL DEFAULT 0`);
    }
  },
};
