/* ==================================================================
 *  Auteur : BATIONO Ulrich Rachid Kévin
 *           Expert en Sécurité Informatique
 *           Développeur FullStack
 *           Tel: +226 51 57 82 89 // 66 72 02 32
 *           Whatsapp: +226 51 57 82 89
 *           Mail: bkevin@sonabhy.bf // bationor10@gmail.com
 *  Projet : MICA – SONABHY
 * ================================================================== */
// Profil utilisateur et securite des comptes
//  - utilisateurs.derniere_connexion_at / derniere_connexion_ip : affiches sur le profil
//  - connexions_utilisateurs : historique des connexions (reussies et echouees) de chaque compte
//  - parametres MOT_DE_PASSE_DUREE_JOURS (90, 0 = pas d'expiration) et MOT_DE_PASSE_RAPPEL_JOURS (7)
//  - comptes sans date de changement de mot de passe : date fixee a la veille du deploiement, pour que
//    la duree de validite parte d'aujourd'hui (et non de la creation du compte) sans fermer les
//    sessions en cours (les jetons ont 8 h de validite).
// Idempotente.
const tableExists = async (sequelize, name) => (await sequelize.query(`SHOW TABLES LIKE '${name}'`))[0].length > 0;
const columnExists = async (sequelize, table, col) => (await sequelize.query(`SHOW COLUMNS FROM ${table} LIKE '${col}'`))[0].length > 0;

const PARAMETRES = [
  ['MOT_DE_PASSE_DUREE_JOURS', '90', 'Durée de validité du mot de passe en jours (0 = pas d\'expiration).'],
  ['MOT_DE_PASSE_RAPPEL_JOURS', '7', 'Nombre de jours avant l\'expiration du mot de passe à partir duquel un rappel est affiché.'],
];

module.exports = {
  name: '022_profil_connexions',
  async up(sequelize) {
    if (!await columnExists(sequelize, 'utilisateurs', 'derniere_connexion_at')) {
      await sequelize.query(`
        ALTER TABLE utilisateurs
          ADD COLUMN derniere_connexion_at DATETIME NULL AFTER locked_until,
          ADD COLUMN derniere_connexion_ip VARCHAR(45) NULL AFTER derniere_connexion_at
      `);
    }
    if (!await tableExists(sequelize, 'connexions_utilisateurs')) {
      await sequelize.query(`
        CREATE TABLE connexions_utilisateurs (
          id             INT AUTO_INCREMENT PRIMARY KEY,
          utilisateur_id INT          NOT NULL,
          succes         TINYINT(1)   NOT NULL,
          motif          VARCHAR(60)  NULL,
          ip             VARCHAR(45)  NULL,
          navigateur     VARCHAR(255) NULL,
          created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_connexions_utilisateur (utilisateur_id, created_at),
          CONSTRAINT fk_connexions_utilisateur FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs (id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
    }
    for (const [cle, valeur, description] of PARAMETRES) {
      const [rows] = await sequelize.query('SELECT id FROM parametres WHERE cle = ?', { replacements: [cle] });
      if (!rows.length) {
        await sequelize.query('INSERT INTO parametres (cle, valeur, description, del) VALUES (?, ?, ?, 0)', { replacements: [cle, valeur, description] });
      }
    }
    await sequelize.query('UPDATE utilisateurs SET password_changed_at = DATE_SUB(NOW(), INTERVAL 1 DAY) WHERE password_changed_at IS NULL');
  },
};
