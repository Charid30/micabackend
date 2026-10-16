// Tresorerie (onglet "Treso" du fichier Indicateurs.xlsx) : lignes configurables par le chef Tresorerie
//  - tresorerie_lignes      : libelle, sens (AVOIR/DETTE), type (SAISIE/SOUS_TOTAL/TOTAL), rattachement a un
//                             sous-total, ordre d'affichage, activation. Les codes historiques sont conserves.
//  - tresorerie_semaine     : ajout du libelle tel qu'il etait au moment de la saisie (les rapports archives
//                             ne changent pas si un libelle est modifie ensuite)
// Idempotente.
const LIGNES = [
  // [ordre, code, libelle, sens, type, code du sous-total parent]
  [10, 'AVOIRS_BANQUES', 'Avoirs en banques', 'AVOIR', 'SAISIE', null],
  [20, 'CREANCES_ETAT', "Sommes dues par l'État", 'AVOIR', 'SOUS_TOTAL', null],
  [21, 'CREANCES_ETAT_MOINS_VALUES', "Sommes dues par l'État à la SONABHY au titre des moins-values de l'année 2026", 'AVOIR', 'SAISIE', 'CREANCES_ETAT'],
  [22, 'CREANCES_ETAT_SUBVENTIONS', 'Subventions gaz et SONABEL à recevoir', 'AVOIR', 'SAISIE', 'CREANCES_ETAT'],
  [30, 'CREANCES_CLIENTS', 'Sommes dues par les clients (créances clients)', 'AVOIR', 'SAISIE', null],
  [40, 'VALORISATION_STOCKS', 'Valorisation des stocks (extérieur et intérieur)', 'AVOIR', 'SAISIE', null],
  [50, 'DETTES_BANQUES', 'Dettes envers les banques', 'DETTE', 'SAISIE', null],
  [60, 'DETTES_FOURNISSEURS', "Dettes envers les fournisseurs d'hydrocarbures et prestations diverses", 'DETTE', 'SAISIE', null],
  [70, 'DETTES_ETAT', "Dettes envers l'État", 'DETTE', 'SOUS_TOTAL', null],
  [71, 'DETTES_ETAT_RELIQUAT_CONVENTION', "Reliquat des sommes dues à l'État en vertu de la convention de compensation des dettes croisées n°002/2025 du 31/12/2025", 'DETTE', 'SAISIE', 'DETTES_ETAT'],
  [72, 'DETTES_ETAT_PLUS_VALUES', 'Sommes dues par la SONABHY au titre des plus-values 2026 (au 31/08/2026)', 'DETTE', 'SAISIE', 'DETTES_ETAT'],
  [73, 'DETTES_ETAT_DOUANE_RESTE', 'Reste à recouvrer lié aux droits et taxes de douane (31/12/2025)', 'DETTE', 'SAISIE', 'DETTES_ETAT'],
  [74, 'DETTES_ETAT_DOUANE_PREVISION', 'Prévision de règlement des droits et taxes de douane hebdomadaire', 'DETTE', 'SAISIE', 'DETTES_ETAT'],
  [99, 'SITUATION_SIMULEE', 'Situation de trésorerie simulée', 'AVOIR', 'TOTAL', null],
];

const tableExists = async (sequelize, name) => (await sequelize.query(`SHOW TABLES LIKE '${name}'`))[0].length > 0;
const columnExists = async (sequelize, table, col) => (await sequelize.query(`SHOW COLUMNS FROM ${table} LIKE '${col}'`))[0].length > 0;

module.exports = {
  name: '019_tresorerie_lignes',
  async up(sequelize) {
    if (!await tableExists(sequelize, 'tresorerie_lignes')) {
      await sequelize.query(`
        CREATE TABLE tresorerie_lignes (
          id         INT AUTO_INCREMENT PRIMARY KEY,
          code       VARCHAR(50)  NOT NULL,
          libelle    VARCHAR(255) NOT NULL,
          sens       ENUM('AVOIR','DETTE') NOT NULL DEFAULT 'AVOIR',
          type       ENUM('SAISIE','SOUS_TOTAL','TOTAL') NOT NULL DEFAULT 'SAISIE',
          parent_id  INT          DEFAULT NULL,
          ordre      INT          NOT NULL DEFAULT 0,
          actif      TINYINT(1)   NOT NULL DEFAULT 1,
          created_at DATETIME     DEFAULT CURRENT_TIMESTAMP,
          created_by INT          DEFAULT NULL,
          updated_at DATETIME     DEFAULT CURRENT_TIMESTAMP,
          updated_by INT          DEFAULT NULL,
          deleted_at DATETIME     DEFAULT NULL,
          deleted_by INT          DEFAULT NULL,
          del        TINYINT(1)   NOT NULL DEFAULT 0,
          UNIQUE KEY uq_treso_ligne_code (code)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
      const ids = {};
      for (const [ordre, code, libelle, sens, type, parent] of LIGNES) {
        const [id] = await sequelize.query(
          `INSERT INTO tresorerie_lignes (code, libelle, sens, type, parent_id, ordre) VALUES (?, ?, ?, ?, ?, ?)`,
          { replacements: [code, libelle, sens, type, parent ? ids[parent] : null, ordre] });
        ids[code] = id;
      }
    }

    if (!await columnExists(sequelize, 'tresorerie_semaine', 'libelle')) {
      await sequelize.query(`ALTER TABLE tresorerie_semaine ADD COLUMN libelle VARCHAR(255) DEFAULT NULL AFTER code`);
    }
  },
};
