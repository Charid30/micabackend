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
// Notifications push de l'application mobile (Firebase Cloud Messaging) : un jeton par téléphone,
// rattaché au compte connecté. Retiré à la déconnexion, ou dès que Firebase le déclare invalide.
const tableExiste = async (sequelize, t) => (await sequelize.query(
  `SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
  { replacements: [t], type: sequelize.QueryTypes.SELECT })).length > 0;

module.exports = {
  name: '040_push_mobiles',
  description: 'Notifications push de l\'application mobile (jetons Firebase par téléphone)',
  async up(sequelize) {
    if (await tableExiste(sequelize, 'push_mobiles')) return;
    await sequelize.query(`
      CREATE TABLE push_mobiles (
        id INT AUTO_INCREMENT PRIMARY KEY,
        utilisateur_id INT NOT NULL,
        jeton VARCHAR(512) NOT NULL,
        jeton_hash CHAR(64) NOT NULL,
        plateforme VARCHAR(10) NOT NULL DEFAULT 'android',
        appareil VARCHAR(120) NULL,
        cree_le DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        vu_le DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        dernier_envoi_at DATETIME NULL,
        UNIQUE KEY uq_push_mobile_jeton (jeton_hash),
        KEY ix_push_mobile_utilisateur (utilisateur_id),
        CONSTRAINT fk_push_mobile_utilisateur FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  },
};
