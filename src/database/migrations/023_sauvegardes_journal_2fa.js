/* ==================================================================
 *  Auteur : BATIONO Ulrich Rachid Kévin
 *           Expert en Sécurité Informatique
 *           Développeur FullStack
 *           Tel: +226 51 57 82 89 // 66 72 02 32
 *           Whatsapp: +226 51 57 82 89
 *           Mail: bkevin@sonabhy.bf // bationor10@gmail.com
 *  Projet : MICA – SONABHY
 * ================================================================== */
// Securite et exploitation
//  - sauvegardes       : historique des sauvegardes de la base (planifiees et manuelles)
//  - journal_actions   : journal d'audit des actions d'ecriture (qui, quoi, quand, depuis ou)
//  - utilisateurs.*    : double authentification (TOTP) — secret chiffre, secret en attente
//                        d'activation, codes de secours (empreintes), date d'activation
//  - parametres de la double authentification (Parametres > Securite, administrateurs) :
//      DOUBLE_AUTH_ADMIN_OBLIGATOIRE (0 : facultative ; 1 : exigee des administrateurs apres le delai)
//      DOUBLE_AUTH_DELAI_JOURS (7) : delai laisse aux administrateurs pour la configurer
//      DOUBLE_AUTH_OBLIGATOIRE_DEPUIS : date d'activation de l'obligation (geree par l'application)
// Idempotente.
const tableExists = async (sequelize, name) => (await sequelize.query(`SHOW TABLES LIKE '${name}'`))[0].length > 0;
const columnExists = async (sequelize, table, col) => (await sequelize.query(`SHOW COLUMNS FROM ${table} LIKE '${col}'`))[0].length > 0;

module.exports = {
  name: '023_sauvegardes_journal_2fa',
  async up(sequelize) {
    if (!await tableExists(sequelize, 'sauvegardes')) {
      await sequelize.query(`
        CREATE TABLE sauvegardes (
          id               INT AUTO_INCREMENT PRIMARY KEY,
          fichier          VARCHAR(255) NULL,
          taille           BIGINT       NULL,
          statut           ENUM('OK','ECHEC') NOT NULL,
          message          VARCHAR(500) NULL,
          origine          ENUM('PLANIFIEE','MANUELLE','RATTRAPAGE') NOT NULL,
          duree_ms         INT          NULL,
          copie_secondaire TINYINT(1)   NOT NULL DEFAULT 0,
          created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
          created_by       INT          NULL,
          INDEX idx_sauvegardes_date (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
    }
    if (!await tableExists(sequelize, 'journal_actions')) {
      await sequelize.query(`
        CREATE TABLE journal_actions (
          id             INT AUTO_INCREMENT PRIMARY KEY,
          utilisateur_id INT          NULL,
          username       VARCHAR(50)  NULL,
          action         VARCHAR(40)  NOT NULL,
          module         VARCHAR(60)  NOT NULL,
          route          VARCHAR(255) NOT NULL,
          cible          VARCHAR(255) NULL,
          details        TEXT         NULL,
          statut_http    SMALLINT     NULL,
          succes         TINYINT(1)   NOT NULL DEFAULT 1,
          ip             VARCHAR(45)  NULL,
          created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_journal_date (created_at),
          INDEX idx_journal_utilisateur (utilisateur_id, created_at),
          INDEX idx_journal_module (module, created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
    }
    if (!await columnExists(sequelize, 'utilisateurs', 'totp_secret')) {
      await sequelize.query(`
        ALTER TABLE utilisateurs
          ADD COLUMN totp_secret         VARCHAR(255) NULL AFTER derniere_connexion_ip,
          ADD COLUMN totp_secret_attente VARCHAR(255) NULL AFTER totp_secret,
          ADD COLUMN totp_codes_secours  TEXT         NULL AFTER totp_secret_attente,
          ADD COLUMN totp_active_le      DATETIME     NULL AFTER totp_codes_secours
      `);
    }
    const PARAMETRES = [
      ['DOUBLE_AUTH_ADMIN_OBLIGATOIRE', '0', 'Double authentification obligatoire pour les administrateurs (0 = facultative, 1 = obligatoire après le délai).'],
      ['DOUBLE_AUTH_DELAI_JOURS', '7', 'Délai (jours) laissé aux administrateurs pour configurer la double authentification une fois rendue obligatoire.'],
      ['DOUBLE_AUTH_OBLIGATOIRE_DEPUIS', '', "Date à laquelle l'obligation a été activée (gérée par l'application)."],
    ];
    for (const [cle, valeur, description] of PARAMETRES) {
      const [rows] = await sequelize.query('SELECT id FROM parametres WHERE cle = ?', { replacements: [cle] });
      if (!rows.length) {
        await sequelize.query('INSERT INTO parametres (cle, valeur, description, del) VALUES (?, ?, ?, 0)', { replacements: [cle, valeur, description] });
      }
    }
  },
};
