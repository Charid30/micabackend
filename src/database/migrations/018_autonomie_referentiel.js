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
// Autonomie des stocks (onglet "Autonomie" du fichier Indicateurs.xlsx)
//  - referentiels_stock    : impompable et consommation moyenne par depot x produit (valeurs "figees",
//                            revues une fois par an), avec date d'effet pour conserver l'historique ;
//                            exclusion d'une ligne du total exterieur (ex. Petrole du Benin en dette de produit)
//  - besoins_exterieurs    : besoin journalier par produit pour les depots exterieurs (fixe par la DSTA)
//  - actions_stocks        : actions entreprises pour relever le niveau des stocks (redigees par la DSTA)
//  - stocks_depot          : ajout du stock en embranchement (saisi chaque jour, a cote du stock en bacs)
//  - parametres            : seuil rouge, objectif de couverture, densite du gaz
// Idempotente : chaque etape verifie l'existant avant d'agir.
const AUDIT = `
  created_at  DATETIME     DEFAULT CURRENT_TIMESTAMP,
  created_by  INT          DEFAULT NULL,
  updated_at  DATETIME     DEFAULT CURRENT_TIMESTAMP,
  updated_by  INT          DEFAULT NULL,
  deleted_at  DATETIME     DEFAULT NULL,
  deleted_by  INT          DEFAULT NULL,
  del         TINYINT(1)   NOT NULL DEFAULT 0`;

// Besoins journaliers exterieurs valides par la DSTA (colonne "Autonomie des depots exterieurs")
const BESOINS_INITIAUX = { SUPER91: 4600, PETROLE: 30, GASOIL: 3750, DDO: 155, JET_A1: 250, FUEL_OIL: 850, GAZ: 850 };
const DATE_EFFET_INITIALE = '2026-01-01';

const PARAMETRES = [
  ['AUTONOMIE_SEUIL_ROUGE_JOURS', '10', "Autonomie inferieure a ce nombre de jours : affichee en rouge (jaune jusqu'a l'objectif, vert au-dela)"],
  ['COUVERTURE_OBJECTIF_PCT', '100', 'Objectif de taux de couverture du stock de securite (%)'],
  ['GAZ_DENSITE_T_M3', '0.56', 'Densite du gaz (tonnes par m3) : conversion des m3 saisis en tonnes dans les syntheses'],
  ['STOCK_SECURITE_REGLEMENTAIRE_JOURS', '90', 'Stock de securite reglementaire (information ; objectif interne = seuil par produit)'],
];

const tableExists = async (sequelize, name) => (await sequelize.query(`SHOW TABLES LIKE '${name}'`))[0].length > 0;
const columnExists = async (sequelize, table, col) => (await sequelize.query(`SHOW COLUMNS FROM ${table} LIKE '${col}'`))[0].length > 0;

module.exports = {
  name: '018_autonomie_referentiel',
  async up(sequelize) {
    // ── 1. Referentiel depot x produit
    if (!await tableExists(sequelize, 'referentiels_stock')) {
      await sequelize.query(`
        CREATE TABLE referentiels_stock (
          id            INT AUTO_INCREMENT PRIMARY KEY,
          depot_id      INT           NOT NULL,
          produit_id    INT           NOT NULL,
          impompable    DECIMAL(15,3) NOT NULL DEFAULT 0,
          conso_moyenne DECIMAL(15,3) NOT NULL DEFAULT 0,
          exclu_total   TINYINT(1)    NOT NULL DEFAULT 0,
          date_effet    DATE          NOT NULL,
          ${AUDIT},
          KEY idx_ref_depot_produit (depot_id, produit_id, date_effet)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      // Valeurs initiales : dernieres valeurs saisies (impompable de reference, consommation moyenne)
      const [depots] = await sequelize.query(`SELECT id, code, type FROM depots WHERE del = 0`);
      const [produits] = await sequelize.query(`SELECT id, code FROM produits WHERE del = 0`);
      for (const d of depots) {
        for (const p of produits) {
          const [[imp]] = await sequelize.query(`
            SELECT sd.stock_impompable AS v FROM stocks_depot sd JOIN rapports_hebdo r ON r.id = sd.rapport_id
            WHERE sd.depot_id = ? AND sd.produit_id = ? AND sd.date_saisie IS NULL AND sd.del = 0
            ORDER BY r.date_fin DESC LIMIT 1`, { replacements: [d.id, p.id] });
          const [[conso]] = await sequelize.query(`
            SELECT cj.conso_moyenne AS v FROM consommations_journalieres cj JOIN rapports_hebdo r ON r.id = cj.rapport_id
            WHERE cj.depot_id = ? AND cj.produit_id = ? AND cj.del = 0
            ORDER BY r.date_fin DESC LIMIT 1`, { replacements: [d.id, p.id] });
          const exclu = d.code === 'BENIN' && p.code === 'PETROLE' ? 1 : 0;   // dette de produit (question 12)
          await sequelize.query(`
            INSERT INTO referentiels_stock (depot_id, produit_id, impompable, conso_moyenne, exclu_total, date_effet)
            VALUES (?, ?, ?, ?, ?, ?)`, {
            replacements: [d.id, p.id, d.type === 'INTERIEUR' ? (imp?.v || 0) : 0,
              d.type === 'INTERIEUR' ? (conso?.v || 0) : 0, exclu, DATE_EFFET_INITIALE],
          });
        }
      }
    }

    // ── 2. Besoins journaliers exterieurs par produit
    if (!await tableExists(sequelize, 'besoins_exterieurs')) {
      await sequelize.query(`
        CREATE TABLE besoins_exterieurs (
          id               INT AUTO_INCREMENT PRIMARY KEY,
          produit_id       INT           NOT NULL,
          besoin_journalier DECIMAL(15,3) NOT NULL DEFAULT 0,
          date_effet       DATE          NOT NULL,
          ${AUDIT},
          KEY idx_besoin_produit (produit_id, date_effet)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
      const [produits] = await sequelize.query(`SELECT id, code FROM produits WHERE del = 0`);
      for (const p of produits) {
        await sequelize.query(`INSERT INTO besoins_exterieurs (produit_id, besoin_journalier, date_effet) VALUES (?, ?, ?)`,
          { replacements: [p.id, BESOINS_INITIAUX[p.code] ?? 0, DATE_EFFET_INITIALE] });
      }
    }

    // ── 3. Actions entreprises (par rapport, depot, produit)
    if (!await tableExists(sequelize, 'actions_stocks')) {
      await sequelize.query(`
        CREATE TABLE actions_stocks (
          id         INT AUTO_INCREMENT PRIMARY KEY,
          rapport_id INT  NOT NULL,
          depot_id   INT  NOT NULL,
          produit_id INT  NOT NULL,
          action     TEXT NOT NULL,
          ${AUDIT},
          UNIQUE KEY uq_action (rapport_id, depot_id, produit_id, del)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
    }

    // ── 4. Stock en embranchement (saisi chaque jour, separe du stock en bacs)
    if (!await columnExists(sequelize, 'stocks_depot', 'stock_embranchement')) {
      await sequelize.query(`ALTER TABLE stocks_depot ADD COLUMN stock_embranchement DECIMAL(15,3) NOT NULL DEFAULT 0 AFTER stock_bacs`);
      // Saisies existantes : le "stock disponible" saisi devient le stock en bacs (embranchement inconnu = 0)
      await sequelize.query(`UPDATE stocks_depot SET stock_bacs = stock_disponible
                             WHERE date_saisie IS NOT NULL AND (stock_bacs IS NULL OR stock_bacs = 0)`);
    }

    // ── 5. Parametres de calcul
    for (const [cle, valeur, description] of PARAMETRES) {
      const [[exists]] = await sequelize.query(`SELECT id FROM parametres WHERE cle = ?`, { replacements: [cle] });
      if (!exists) {
        await sequelize.query(`INSERT INTO parametres (cle, valeur, description) VALUES (?, ?, ?)`, { replacements: [cle, valeur, description] });
      }
    }
  },
};
