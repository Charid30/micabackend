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
// Messages ciblés : un administrateur écrit à un ou plusieurs comptes ; le message s'affiche à la
// prochaine connexion (ou aussitôt si le compte est connecté) jusqu'à ce qu'il soit marqué comme lu.
// Une ligne par destinataire porte l'accusé de lecture (date et heure).
const tableExiste = async (sequelize, t) => (await sequelize.query(
  `SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
  { replacements: [t], type: sequelize.QueryTypes.SELECT })).length > 0;

module.exports = {
  name: '041_messages',
  description: 'Messages ciblés affichés à la connexion, avec accusé de lecture',
  async up(sequelize) {
    if (!await tableExiste(sequelize, 'messages')) {
      await sequelize.query(`
        CREATE TABLE messages (
          id INT AUTO_INCREMENT PRIMARY KEY,
          titre VARCHAR(150) NOT NULL,
          contenu TEXT NOT NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          created_by INT NULL,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_by INT NULL,
          deleted_at DATETIME NULL,
          deleted_by INT NULL,
          del TINYINT NOT NULL DEFAULT 0,
          KEY ix_messages_del (del, created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    }
    if (!await tableExiste(sequelize, 'messages_destinataires')) {
      await sequelize.query(`
        CREATE TABLE messages_destinataires (
          id INT AUTO_INCREMENT PRIMARY KEY,
          message_id INT NOT NULL,
          utilisateur_id INT NOT NULL,
          lu_le DATETIME NULL,
          lu_ip VARCHAR(45) NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY uq_message_destinataire (message_id, utilisateur_id),
          KEY ix_destinataire_non_lu (utilisateur_id, lu_le),
          CONSTRAINT fk_md_message FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
          CONSTRAINT fk_md_utilisateur FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    }
  },
};
