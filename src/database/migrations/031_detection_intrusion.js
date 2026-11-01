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
// Detection d'intrusion et bannissement automatique :
//  - securite_evenements : historique des attaques detectees ;
//  - ip_bannies : adresses bannies (definitif jusqu'a la levee par un administrateur) ;
//  - utilisateurs.suspendu_le / suspendu_motif : compte suspendu suite a une attaque.
const tableExiste = async (sequelize, t) => (await sequelize.query(
  `SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
  { replacements: [t], type: sequelize.QueryTypes.SELECT })).length > 0;

const colonneExiste = async (sequelize, t, c) => (await sequelize.query(
  `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
  { replacements: [t, c], type: sequelize.QueryTypes.SELECT })).length > 0;

module.exports = {
  name: '031_detection_intrusion',
  description: 'Detection d\'intrusion : evenements, adresses bannies, comptes suspendus',
  async up(sequelize) {
    if (!await tableExiste(sequelize, 'securite_evenements')) {
      await sequelize.query(`
        CREATE TABLE securite_evenements (
          id INT AUTO_INCREMENT PRIMARY KEY,
          type VARCHAR(40) NOT NULL,
          libelle VARCHAR(120) NOT NULL,
          ip VARCHAR(45) NULL,
          utilisateur_id INT NULL,
          username VARCHAR(50) NULL,
          route VARCHAR(255) NULL,
          extrait VARCHAR(255) NULL,
          navigateur VARCHAR(255) NULL,
          mesure VARCHAR(120) NULL,
          created_at DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_secu_date (created_at),
          INDEX idx_secu_ip (ip)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    }
    if (!await tableExiste(sequelize, 'ip_bannies')) {
      await sequelize.query(`
        CREATE TABLE ip_bannies (
          id INT AUTO_INCREMENT PRIMARY KEY,
          ip VARCHAR(45) NOT NULL,
          motif VARCHAR(120) NOT NULL,
          banni_le DATETIME NOT NULL,
          actif TINYINT(1) NOT NULL DEFAULT 1,
          leve_le DATETIME NULL,
          leve_par VARCHAR(50) NULL,
          UNIQUE KEY uq_ip_bannie (ip)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    }
    if (!await colonneExiste(sequelize, 'utilisateurs', 'suspendu_le')) {
      await sequelize.query(`ALTER TABLE utilisateurs ADD COLUMN suspendu_le DATETIME NULL, ADD COLUMN suspendu_motif VARCHAR(120) NULL`);
    }
  },
};
