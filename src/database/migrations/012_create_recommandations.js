module.exports = {
  name: '012_create_recommandations',
  async up(sequelize) {
    const [cols] = await sequelize.query(`SHOW TABLES LIKE 'recommandations'`);
    if (cols.length > 0) return;
    await sequelize.query(`
      CREATE TABLE recommandations (
        id                  INT AUTO_INCREMENT PRIMARY KEY,
        rapport_id          INT NOT NULL UNIQUE,
        tendance_generale   TEXT DEFAULT NULL,
        risques_majeurs     TEXT DEFAULT NULL,
        impact_sonabhy      TEXT DEFAULT NULL,
        recommandations     TEXT DEFAULT NULL,
        del                 TINYINT(1) NOT NULL DEFAULT 0,
        created_by          INT DEFAULT NULL,
        updated_by          INT DEFAULT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
  },
};
