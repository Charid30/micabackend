/* ==================================================================
 *  Auteur : BATIONO Ulrich Rachid Kévin
 *           Expert en Sécurité Informatique
 *           Développeur FullStack
 *           Tel: +226 51 57 82 89 // 66 72 02 32
 *           Whatsapp: +226 51 57 82 89
 *           Mail: bkevin@sonabhy.bf // bationor10@gmail.com
 *  Projet : MICA – SONABHY
 * ================================================================== */
module.exports = {
  name: '014_add_password_changed_at',
  async up(sequelize) {
    const [cols] = await sequelize.query(`SHOW COLUMNS FROM utilisateurs LIKE 'password_changed_at'`);
    if (cols.length > 0) return;
    await sequelize.query(
      `ALTER TABLE utilisateurs ADD COLUMN password_changed_at DATETIME DEFAULT NULL AFTER must_change_password`
    );
  },
};
