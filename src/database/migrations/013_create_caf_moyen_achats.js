module.exports = {
  name: '013_create_caf_moyen_achats',
  async up(sequelize) {
    const [cols] = await sequelize.query(`SHOW TABLES LIKE 'caf_moyen_achats'`);
    if (cols.length > 0) return;
    await sequelize.query(`
      CREATE TABLE caf_moyen_achats (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        annee       SMALLINT     NOT NULL,
        mois        TINYINT      NOT NULL,
        corridor    VARCHAR(50)  NOT NULL,
        produit_id  INT          NOT NULL,
        valeur_caf  DECIMAL(10,3) DEFAULT NULL,
        del         TINYINT(1)   NOT NULL DEFAULT 0,
        created_by  INT          DEFAULT NULL,
        updated_by  INT          DEFAULT NULL,
        UNIQUE KEY uq_caf (annee, mois, corridor, produit_id, del)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
  },
};
