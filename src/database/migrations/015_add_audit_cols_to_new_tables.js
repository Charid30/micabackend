module.exports = {
  name: '015_add_audit_cols_to_new_tables',
  async up(sequelize) {
    const addIfMissing = async (table, column, definition) => {
      const [cols] = await sequelize.query(
        `SHOW COLUMNS FROM \`${table}\` LIKE '${column}'`
      );
      if (cols.length > 0) return;
      await sequelize.query(
        `ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`
      );
    };

    for (const table of ['tresorerie_semaine', 'recommandations', 'caf_moyen_achats']) {
      await addIfMissing(table, 'created_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP');
      await addIfMissing(table, 'updated_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');
      await addIfMissing(table, 'deleted_at', 'DATETIME DEFAULT NULL');
      await addIfMissing(table, 'deleted_by', 'INT DEFAULT NULL');
    }
  },
};
