module.exports = {
  name: '005_add_is_admin_to_utilisateurs',
  description: 'Ajout colonne is_admin à la table utilisateurs',

  async up(sequelize) {
    const cols = await sequelize.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'utilisateurs'`,
      { type: sequelize.QueryTypes.SELECT }
    );
    const existing = cols.map(c => c.COLUMN_NAME);

    if (!existing.includes('is_admin')) {
      await sequelize.query(
        `ALTER TABLE utilisateurs ADD COLUMN is_admin TINYINT(1) NOT NULL DEFAULT 0 AFTER password`
      );
      console.log('  ✓ Colonne is_admin ajoutée à utilisateurs');

      // L'utilisateur admin initial (id=1) est mis en admin
      await sequelize.query(`UPDATE utilisateurs SET is_admin = 1 WHERE id = 1`);
      console.log('  ✓ Premier utilisateur (id=1) marqué admin');
    } else {
      console.log('  – is_admin existe déjà, migration ignorée');
    }
  },
};
