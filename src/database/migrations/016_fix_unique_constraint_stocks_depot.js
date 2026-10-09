module.exports = {
  name: '016_fix_unique_constraint_stocks_depot',
  async up(sequelize) {
    // Vérifier si l'ancienne contrainte uq_stock (sans date_saisie) existe encore
    const [oldKeys] = await sequelize.query(`
      SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'stocks_depot'
        AND CONSTRAINT_NAME = 'uq_stock'
        AND CONSTRAINT_TYPE = 'UNIQUE'
    `);

    if (oldKeys.length > 0) {
      await sequelize.query(`ALTER TABLE stocks_depot DROP INDEX uq_stock`);
    }

    // Vérifier si la nouvelle contrainte (avec date_saisie) existe déjà
    const [newKeys] = await sequelize.query(`
      SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'stocks_depot'
        AND CONSTRAINT_NAME = 'uq_stock_daily'
        AND CONSTRAINT_TYPE = 'UNIQUE'
    `);

    if (newKeys.length === 0) {
      // Avec date_saisie dans la clé, chaque jour a sa propre ligne
      // Les lignes impompable (date_saisie IS NULL) sont gérées par le code (findOne avant create)
      await sequelize.query(`
        ALTER TABLE stocks_depot
        ADD UNIQUE KEY uq_stock_daily (rapport_id, depot_id, produit_id, date_saisie)
      `);
    }
  },
};
