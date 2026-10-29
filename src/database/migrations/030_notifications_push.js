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
// Notifications push web :
//  - push_abonnements : un abonnement par navigateur (adresse d'envoi fournie par le navigateur) ;
//  - NOTIF_SAISIE_HEURE : heure du controle des saisies quotidiennes manquantes (HH:MM) ;
//  - NOTIF_SAISIE_JOURS : jours du controle (1 = lundi ... 7 = dimanche).
const tableExiste = async (sequelize, t) => (await sequelize.query(
  `SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
  { replacements: [t], type: sequelize.QueryTypes.SELECT })).length > 0;

module.exports = {
  name: '030_notifications_push',
  description: 'Notifications push web : abonnements et heure du controle des saisies',
  async up(sequelize) {
    if (!await tableExiste(sequelize, 'push_abonnements')) {
      await sequelize.query(`
        CREATE TABLE push_abonnements (
          id INT AUTO_INCREMENT PRIMARY KEY,
          utilisateur_id INT NOT NULL,
          endpoint VARCHAR(700) NOT NULL,
          endpoint_hash CHAR(64) NOT NULL,
          p256dh VARCHAR(255) NOT NULL,
          auth VARCHAR(100) NOT NULL,
          navigateur VARCHAR(255) NULL,
          dernier_envoi_at DATETIME NULL,
          created_at DATETIME NULL DEFAULT CURRENT_TIMESTAMP, created_by INT NULL,
          updated_at DATETIME NULL DEFAULT CURRENT_TIMESTAMP, updated_by INT NULL,
          deleted_at DATETIME NULL, deleted_by INT NULL, del TINYINT(1) NULL DEFAULT 0,
          UNIQUE KEY uq_push_endpoint (endpoint_hash),
          INDEX idx_push_utilisateur (utilisateur_id, del),
          CONSTRAINT fk_push_utilisateur FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    }
    await sequelize.query(`INSERT IGNORE INTO parametres (cle, valeur, description) VALUES
      ('NOTIF_SAISIE_HEURE', '20:30', 'Heure du rappel des saisies quotidiennes manquantes (HH:MM)'),
      ('NOTIF_SAISIE_JOURS', '1,2,3,4,5,6,7', 'Jours du rappel des saisies manquantes (1 = lundi ... 7 = dimanche)')`);
  },
};
