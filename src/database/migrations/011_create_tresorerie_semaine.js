/* ==================================================================
 *  Auteur : BATIONO Ulrich Rachid Kévin
 *           Expert en Sécurité Informatique
 *           Développeur FullStack
 *           Tel: +226 51 57 82 89 // 66 72 02 32
 *           Whatsapp: +226 51 57 82 89
 *           Mail: bkevin@sonabhy.bf // bationor10@gmail.com
 *  Projet : MICA – SONABHY
 *  Merci
 * ================================================================== */
module.exports = {
  name: '011_create_tresorerie_semaine',
  async up(sequelize) {
    const [cols] = await sequelize.query(`SHOW TABLES LIKE 'tresorerie_semaine'`);
    if (cols.length > 0) return;
    await sequelize.query(`
      CREATE TABLE tresorerie_semaine (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        rapport_id  INT          NOT NULL,
        code        VARCHAR(50)  NOT NULL,
        montant_n1  DECIMAL(20,2) DEFAULT NULL,
        montant_n   DECIMAL(20,2) DEFAULT NULL,
        del         TINYINT(1)   NOT NULL DEFAULT 0,
        created_by  INT          DEFAULT NULL,
        updated_by  INT          DEFAULT NULL,
        UNIQUE KEY uq_treso (rapport_id, code, del)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
  },
};
