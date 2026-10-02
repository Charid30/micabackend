module.exports = {
  name: '006_add_depot_id_to_permissions',
  description: 'Ajout de depot_id (nullable) dans permissions pour restriction par dépôt',

  async up(sequelize) {
    const cols = await sequelize.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'permissions'`,
      { type: sequelize.QueryTypes.SELECT }
    );
    const existing = cols.map(c => c.COLUMN_NAME);
    if (!existing.includes('depot_id')) {
      await sequelize.query(
        `ALTER TABLE permissions ADD COLUMN depot_id INT NULL DEFAULT NULL`
      );
      console.log('  ✔ permissions.depot_id ajoutée');
    } else {
      console.log('  – permissions.depot_id déjà présente');
    }
  },
};
