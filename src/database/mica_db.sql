-- ============================================================
-- MICA DB — Script de création base de données MySQL/XAMPP
-- SONABHY · Plateforme de suivi des stocks
-- ============================================================

CREATE DATABASE IF NOT EXISTS mica_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE mica_db;

-- ============================================================
-- 1. ENTREPRISE
-- ============================================================
CREATE TABLE IF NOT EXISTS entreprises (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  nom           VARCHAR(100) NOT NULL,
  acronyme      VARCHAR(20)  NOT NULL UNIQUE,
  description   TEXT,
  created_at    DATETIME     DEFAULT CURRENT_TIMESTAMP,
  created_by    INT,
  updated_at    DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by    INT,
  deleted_at    DATETIME,
  deleted_by    INT,
  del           TINYINT(1)   DEFAULT 0
) ENGINE=InnoDB;

-- ============================================================
-- 2. DIRECTION
-- ============================================================
CREATE TABLE IF NOT EXISTS directions (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  entreprise_id   INT         NOT NULL,
  acronyme        VARCHAR(30) NOT NULL,
  description     TEXT,
  created_at      DATETIME    DEFAULT CURRENT_TIMESTAMP,
  created_by      INT,
  updated_at      DATETIME    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by      INT,
  deleted_at      DATETIME,
  deleted_by      INT,
  del             TINYINT(1)  DEFAULT 0,
  FOREIGN KEY (entreprise_id) REFERENCES entreprises(id)
) ENGINE=InnoDB;

-- ============================================================
-- 3. AGENT
-- ============================================================
CREATE TABLE IF NOT EXISTS agents (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  direction_id    INT          NOT NULL,
  matricule       VARCHAR(20)  NOT NULL UNIQUE,
  nom             VARCHAR(100) NOT NULL,
  prenoms         VARCHAR(150),
  created_at      DATETIME     DEFAULT CURRENT_TIMESTAMP,
  created_by      INT,
  updated_at      DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by      INT,
  deleted_at      DATETIME,
  deleted_by      INT,
  del             TINYINT(1)   DEFAULT 0,
  FOREIGN KEY (direction_id) REFERENCES directions(id)
) ENGINE=InnoDB;

-- ============================================================
-- 4. UTILISATEUR
-- ============================================================
CREATE TABLE IF NOT EXISTS utilisateurs (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  agent_id    INT          NOT NULL UNIQUE,
  username    VARCHAR(50)  NOT NULL UNIQUE,
  email       VARCHAR(150) NOT NULL UNIQUE,
  tel         VARCHAR(20),
  password    VARCHAR(255) NOT NULL,
  is_admin    TINYINT(1)   DEFAULT 0,
  created_at  DATETIME     DEFAULT CURRENT_TIMESTAMP,
  created_by  INT,
  updated_at  DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by  INT,
  deleted_at  DATETIME,
  deleted_by  INT,
  del         TINYINT(1)   DEFAULT 0,
  FOREIGN KEY (agent_id) REFERENCES agents(id)
) ENGINE=InnoDB;

-- ============================================================
-- 5. PERMISSION
-- ============================================================
CREATE TABLE IF NOT EXISTS permissions (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  utilisateur_id  INT         NOT NULL,
  module          VARCHAR(50) NOT NULL,
  action          VARCHAR(30) NOT NULL,
  created_at      DATETIME    DEFAULT CURRENT_TIMESTAMP,
  created_by      INT,
  updated_at      DATETIME    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by      INT,
  deleted_at      DATETIME,
  deleted_by      INT,
  del             TINYINT(1)  DEFAULT 0,
  UNIQUE KEY uq_perm (utilisateur_id, module, action),
  FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id)
) ENGINE=InnoDB;

-- ============================================================
-- 6. PRODUIT (référentiel)
-- ============================================================
CREATE TABLE IF NOT EXISTS produits (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  code        VARCHAR(20)  NOT NULL UNIQUE,
  libelle     VARCHAR(100) NOT NULL,
  unite       VARCHAR(20)  NOT NULL,
  created_at  DATETIME     DEFAULT CURRENT_TIMESTAMP,
  created_by  INT,
  updated_at  DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by  INT,
  deleted_at  DATETIME,
  deleted_by  INT,
  del         TINYINT(1)   DEFAULT 0
) ENGINE=InnoDB;

-- ============================================================
-- 7. DEPOT (référentiel)
-- ============================================================
CREATE TABLE IF NOT EXISTS depots (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  code        VARCHAR(30)  NOT NULL UNIQUE,
  libelle     VARCHAR(100) NOT NULL,
  type        ENUM('INTERIEUR','EXTERIEUR') NOT NULL,
  pays        VARCHAR(50),
  created_at  DATETIME     DEFAULT CURRENT_TIMESTAMP,
  created_by  INT,
  updated_at  DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by  INT,
  deleted_at  DATETIME,
  deleted_by  INT,
  del         TINYINT(1)   DEFAULT 0
) ENGINE=InnoDB;

-- ============================================================
-- 8. CORRIDOR (référentiel)
-- ============================================================
CREATE TABLE IF NOT EXISTS corridors (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  code        VARCHAR(30)  NOT NULL UNIQUE,
  libelle     VARCHAR(100) NOT NULL,
  created_at  DATETIME     DEFAULT CURRENT_TIMESTAMP,
  created_by  INT,
  updated_at  DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by  INT,
  deleted_at  DATETIME,
  deleted_by  INT,
  del         TINYINT(1)   DEFAULT 0
) ENGINE=InnoDB;

-- ============================================================
-- 9. FOURNISSEUR (référentiel)
-- ============================================================
CREATE TABLE IF NOT EXISTS fournisseurs (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  code        VARCHAR(30)  NOT NULL UNIQUE,
  libelle     VARCHAR(150) NOT NULL,
  created_at  DATETIME     DEFAULT CURRENT_TIMESTAMP,
  created_by  INT,
  updated_at  DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by  INT,
  deleted_at  DATETIME,
  deleted_by  INT,
  del         TINYINT(1)   DEFAULT 0
) ENGINE=InnoDB;

-- ============================================================
-- 10. MARKETEUR (référentiel)
-- ============================================================
CREATE TABLE IF NOT EXISTS marketeurs (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  code        VARCHAR(20)  NOT NULL UNIQUE,
  libelle     VARCHAR(200) NOT NULL,
  created_at  DATETIME     DEFAULT CURRENT_TIMESTAMP,
  created_by  INT,
  updated_at  DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by  INT,
  deleted_at  DATETIME,
  deleted_by  INT,
  del         TINYINT(1)   DEFAULT 0
) ENGINE=InnoDB;

-- ============================================================
-- 11. RAPPORT HEBDO
-- ============================================================
CREATE TABLE IF NOT EXISTS rapports_hebdo (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  annee             INT         NOT NULL,
  semaine_iso       INT         NOT NULL,
  date_debut        DATE        NOT NULL,
  date_fin          DATE        NOT NULL,
  statut            ENUM('BROUILLON','PUBLIE') DEFAULT 'BROUILLON',
  date_publication  DATETIME,
  publie_par        INT,
  created_at        DATETIME    DEFAULT CURRENT_TIMESTAMP,
  created_by        INT,
  updated_at        DATETIME    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by        INT,
  deleted_at        DATETIME,
  deleted_by        INT,
  del               TINYINT(1)  DEFAULT 0,
  UNIQUE KEY uq_semaine (annee, semaine_iso)
) ENGINE=InnoDB;

-- ============================================================
-- 12. STOCK DEPOT
-- ============================================================
CREATE TABLE IF NOT EXISTS stocks_depot (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  rapport_id        INT             NOT NULL,
  depot_id          INT             NOT NULL,
  produit_id        INT             NOT NULL,
  stock_bacs        DECIMAL(15,3)   DEFAULT 0,
  stock_impompable  DECIMAL(15,3)   DEFAULT 0,
  stock_disponible  DECIMAL(15,3)   DEFAULT 0,
  autonomie         DECIMAL(10,2)   DEFAULT 0,
  created_at        DATETIME        DEFAULT CURRENT_TIMESTAMP,
  created_by        INT,
  updated_at        DATETIME        DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by        INT,
  deleted_at        DATETIME,
  deleted_by        INT,
  del               TINYINT(1)      DEFAULT 0,
  UNIQUE KEY uq_stock (rapport_id, depot_id, produit_id),
  FOREIGN KEY (rapport_id)  REFERENCES rapports_hebdo(id),
  FOREIGN KEY (depot_id)    REFERENCES depots(id),
  FOREIGN KEY (produit_id)  REFERENCES produits(id)
) ENGINE=InnoDB;

-- ============================================================
-- 13. CONSOMMATION JOURNALIERE
-- ============================================================
CREATE TABLE IF NOT EXISTS consommations_journalieres (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  rapport_id      INT             NOT NULL,
  depot_id        INT             NOT NULL,
  produit_id      INT             NOT NULL,
  conso_moyenne   DECIMAL(15,3)   NOT NULL,
  stock_securite  DECIMAL(15,3)   DEFAULT 0,
  created_at      DATETIME        DEFAULT CURRENT_TIMESTAMP,
  created_by      INT,
  updated_at      DATETIME        DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by      INT,
  deleted_at      DATETIME,
  deleted_by      INT,
  del             TINYINT(1)      DEFAULT 0,
  UNIQUE KEY uq_conso (rapport_id, depot_id, produit_id),
  FOREIGN KEY (rapport_id)  REFERENCES rapports_hebdo(id),
  FOREIGN KEY (depot_id)    REFERENCES depots(id),
  FOREIGN KEY (produit_id)  REFERENCES produits(id)
) ENGINE=InnoDB;

-- ============================================================
-- 14. CHARGEMENT CORRIDOR
-- ============================================================
CREATE TABLE IF NOT EXISTS chargements_corridors (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  rapport_id          INT     NOT NULL,
  corridor_id         INT     NOT NULL,
  produit_id          INT     NOT NULL,
  camions_en_attente  INT     DEFAULT 0,
  camions_charges     INT     DEFAULT 0,
  bons_emis           INT     DEFAULT 0,
  objectif_journalier INT,
  created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_by          INT,
  updated_at          DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by          INT,
  deleted_at          DATETIME,
  deleted_by          INT,
  del                 TINYINT(1) DEFAULT 0,
  UNIQUE KEY uq_charg (rapport_id, corridor_id, produit_id),
  FOREIGN KEY (rapport_id)   REFERENCES rapports_hebdo(id),
  FOREIGN KEY (corridor_id)  REFERENCES corridors(id),
  FOREIGN KEY (produit_id)   REFERENCES produits(id)
) ENGINE=InnoDB;

-- ============================================================
-- 15. ENCOURS LIVRAISON
-- ============================================================
CREATE TABLE IF NOT EXISTS encours_livraisons (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  rapport_id      INT           NOT NULL,
  fournisseur_id  INT           NOT NULL,
  produit_id      INT           NOT NULL,
  quantite_tm     DECIMAL(15,3) NOT NULL,
  port_livraison  VARCHAR(50),
  date_debut      DATE          NOT NULL,
  date_fin        DATE          NOT NULL,
  created_at      DATETIME      DEFAULT CURRENT_TIMESTAMP,
  created_by      INT,
  updated_at      DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by      INT,
  deleted_at      DATETIME,
  deleted_by      INT,
  del             TINYINT(1)    DEFAULT 0,
  FOREIGN KEY (rapport_id)     REFERENCES rapports_hebdo(id),
  FOREIGN KEY (fournisseur_id) REFERENCES fournisseurs(id),
  FOREIGN KEY (produit_id)     REFERENCES produits(id)
) ENGINE=InnoDB;

-- ============================================================
-- 16. VENTE MARKETEUR
-- ============================================================
CREATE TABLE IF NOT EXISTS ventes_marketeurs (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  rapport_id      INT             NOT NULL,
  marketeur_id    INT             NOT NULL,
  produit_id      INT             NOT NULL,
  quantite        DECIMAL(15,3)   DEFAULT 0,
  created_at      DATETIME        DEFAULT CURRENT_TIMESTAMP,
  created_by      INT,
  updated_at      DATETIME        DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by      INT,
  deleted_at      DATETIME,
  deleted_by      INT,
  del             TINYINT(1)      DEFAULT 0,
  FOREIGN KEY (rapport_id)    REFERENCES rapports_hebdo(id),
  FOREIGN KEY (marketeur_id)  REFERENCES marketeurs(id),
  FOREIGN KEY (produit_id)    REFERENCES produits(id)
) ENGINE=InnoDB;

-- ============================================================
-- 17. FINANCE DETTE
-- ============================================================
CREATE TABLE IF NOT EXISTS finances_dettes (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  rapport_id  INT             NOT NULL,
  designation VARCHAR(255)    NOT NULL,
  montant     DECIMAL(20,2)   NOT NULL,
  sens        ENUM('DETTE_ETAT_VERS_SONABHY','ENGAGEMENT_FOURNISSEUR') NOT NULL,
  created_at  DATETIME        DEFAULT CURRENT_TIMESTAMP,
  created_by  INT,
  updated_at  DATETIME        DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by  INT,
  deleted_at  DATETIME,
  deleted_by  INT,
  del         TINYINT(1)      DEFAULT 0,
  FOREIGN KEY (rapport_id) REFERENCES rapports_hebdo(id)
) ENGINE=InnoDB;

-- ============================================================
-- 18. CAMION DEPOT
-- ============================================================
CREATE TABLE IF NOT EXISTS camions_depot (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  rapport_id          INT     NOT NULL,
  depot_id            INT     NOT NULL,
  produit_id          INT     NOT NULL,
  camions_en_attente  INT     DEFAULT 0,
  camions_recus       INT     DEFAULT 0,
  camions_depotes     INT     DEFAULT 0,
  created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_by          INT,
  updated_at          DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by          INT,
  deleted_at          DATETIME,
  deleted_by          INT,
  del                 TINYINT(1) DEFAULT 0,
  UNIQUE KEY uq_camion_depot (rapport_id, depot_id, produit_id),
  FOREIGN KEY (rapport_id)  REFERENCES rapports_hebdo(id),
  FOREIGN KEY (depot_id)    REFERENCES depots(id),
  FOREIGN KEY (produit_id)  REFERENCES produits(id)
) ENGINE=InnoDB;

-- ============================================================
-- 19. TEMPS ATTENTE CAMION
-- ============================================================
CREATE TABLE IF NOT EXISTS temps_attente_camions (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  rapport_id      INT             NOT NULL,
  corridor        VARCHAR(50)     NOT NULL,
  temps_attente   DECIMAL(8,2)    NOT NULL,
  created_at      DATETIME        DEFAULT CURRENT_TIMESTAMP,
  created_by      INT,
  updated_at      DATETIME        DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by      INT,
  deleted_at      DATETIME,
  deleted_by      INT,
  del             TINYINT(1)      DEFAULT 0,
  FOREIGN KEY (rapport_id) REFERENCES rapports_hebdo(id)
) ENGINE=InnoDB;

-- ============================================================
-- 20. VEILLE MARCHE
-- ============================================================
CREATE TABLE IF NOT EXISTS veille_marche (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  rapport_id        INT             NOT NULL,
  produit           VARCHAR(30)     NOT NULL,
  prix_semaine_n    DECIMAL(10,4)   NOT NULL,
  prix_semaine_n1   DECIMAL(10,4)   NOT NULL,
  taux_change_usd   DECIMAL(10,4)   NOT NULL,
  created_at        DATETIME        DEFAULT CURRENT_TIMESTAMP,
  created_by        INT,
  updated_at        DATETIME        DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by        INT,
  deleted_at        DATETIME,
  deleted_by        INT,
  del               TINYINT(1)      DEFAULT 0,
  FOREIGN KEY (rapport_id) REFERENCES rapports_hebdo(id)
) ENGINE=InnoDB;

-- ============================================================
-- 21. VEILLE GEOPOLITIQUE
-- ============================================================
CREATE TABLE IF NOT EXISTS veille_geopolitique (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  rapport_id      INT         NOT NULL,
  evenement       TEXT        NOT NULL,
  niveau_risque   ENUM('FAIBLE','MOYEN','ELEVE') NOT NULL,
  impact          TEXT,
  created_at      DATETIME    DEFAULT CURRENT_TIMESTAMP,
  created_by      INT,
  updated_at      DATETIME    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by      INT,
  deleted_at      DATETIME,
  deleted_by      INT,
  del             TINYINT(1)  DEFAULT 0,
  FOREIGN KEY (rapport_id) REFERENCES rapports_hebdo(id)
) ENGINE=InnoDB;

-- ============================================================
-- 22. ACHAT TRADER
-- ============================================================
CREATE TABLE IF NOT EXISTS achats_traders (
  id                      INT AUTO_INCREMENT PRIMARY KEY,
  rapport_id              INT             NOT NULL,
  produit_id              INT             NOT NULL,
  fournisseur_id          INT             NOT NULL,
  type_operation          VARCHAR(50)     NOT NULL,
  lieu_livraison          VARCHAR(100)    NOT NULL,
  date_livraison          DATE            NOT NULL,
  quantite_tm             DECIMAL(15,3)   NOT NULL,
  periode_cotation        VARCHAR(100),
  prix_unitaire_caf_usd   DECIMAL(12,4)   NOT NULL,
  taux_change             DECIMAL(10,4)   NOT NULL,
  montant_trans_cfa       DECIMAL(20,2)   NOT NULL,
  prime_trader_usd        DECIMAL(10,4),
  prime_structure_usd     DECIMAL(10,4),
  gains_pertes_usd        DECIMAL(15,4),
  gains_perte_fcfa        DECIMAL(20,2),
  created_at              DATETIME        DEFAULT CURRENT_TIMESTAMP,
  created_by              INT,
  updated_at              DATETIME        DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by              INT,
  deleted_at              DATETIME,
  deleted_by              INT,
  del                     TINYINT(1)      DEFAULT 0,
  FOREIGN KEY (rapport_id)     REFERENCES rapports_hebdo(id),
  FOREIGN KEY (produit_id)     REFERENCES produits(id),
  FOREIGN KEY (fournisseur_id) REFERENCES fournisseurs(id)
) ENGINE=InnoDB;

-- ============================================================
-- 23. PARAMETRE
-- ============================================================
CREATE TABLE IF NOT EXISTS parametres (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  cle         VARCHAR(60)  NOT NULL UNIQUE,
  valeur      VARCHAR(255) NOT NULL,
  description TEXT,
  created_at  DATETIME     DEFAULT CURRENT_TIMESTAMP,
  created_by  INT,
  updated_at  DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by  INT,
  deleted_at  DATETIME,
  deleted_by  INT,
  del         TINYINT(1)   DEFAULT 0
) ENGINE=InnoDB;

-- ============================================================
-- 24. PARAMETRE ALERTE (seuil par produit)
-- ============================================================
CREATE TABLE IF NOT EXISTS parametres_alertes (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  produit_id  INT         NOT NULL UNIQUE,
  seuil_jours INT         DEFAULT 15,
  actif       TINYINT(1)  DEFAULT 1,
  created_at  DATETIME    DEFAULT CURRENT_TIMESTAMP,
  created_by  INT,
  updated_at  DATETIME    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by  INT,
  deleted_at  DATETIME,
  deleted_by  INT,
  del         TINYINT(1)  DEFAULT 0,
  FOREIGN KEY (produit_id) REFERENCES produits(id)
) ENGINE=InnoDB;

-- ============================================================
-- DONNÉES INITIALES (seed)
-- ============================================================

-- Entreprises
INSERT IGNORE INTO entreprises (nom, acronyme, description) VALUES
  ('Société Nationale Burkinabé d''Hydrocarbures', 'SONABHY', 'Société d''État gérant les hydrocarbures du Burkina Faso'),
  ('Ministère de l''Industrie, du Commerce et de l''Artisanat', 'MICA', 'Ministère de tutelle de la SONABHY');

-- Produits
INSERT IGNORE INTO produits (code, libelle, unite) VALUES
  ('SUPER91',  'Super 91',    'litres'),
  ('GASOIL',   'Gasoil',      'litres'),
  ('DDO',      'DDO',         'litres'),
  ('PETROLE',  'Pétrole',     'litres'),
  ('GAZ',      'Gaz Butane',  'kg'),
  ('FUEL_OIL', 'Fuel Oil',    'litres'),
  ('JET_A1',   'Jet A1',      'litres');

-- Dépôts intérieurs
INSERT IGNORE INTO depots (code, libelle, type, pays) VALUES
  ('BINGO', 'Dépôt de Bingo',         'INTERIEUR', 'Burkina Faso'),
  ('PENI',  'Dépôt de Péni',          'INTERIEUR', 'Burkina Faso');

-- Dépôts extérieurs
INSERT IGNORE INTO depots (code, libelle, type, pays) VALUES
  ('GHANA',       'Dépôt Ghana (TEMA)',     'EXTERIEUR', 'Ghana'),
  ('COTE_IVOIRE', 'Dépôt Côte d''Ivoire',  'EXTERIEUR', 'Côte d''Ivoire'),
  ('BENIN',       'Dépôt Bénin (Cotonou)', 'EXTERIEUR', 'Bénin'),
  ('TOGO',        'Dépôt Togo (Lomé)',     'EXTERIEUR', 'Togo');

-- Corridors
INSERT IGNORE INTO corridors (code, libelle) VALUES
  ('TEMA',       'Corridor TEMA (Ghana)'),
  ('COTE_IVOIRE','Corridor Côte d''Ivoire (Abidjan)'),
  ('COTONOU',    'Corridor Cotonou (Bénin)'),
  ('LOME',       'Corridor Lomé (Togo)');

-- Fournisseurs
INSERT IGNORE INTO fournisseurs (code, libelle) VALUES
  ('SAGE',       'SAGE Distribution'),
  ('TRAFIGURA',  'Trafigura'),
  ('MOCOH',      'MOCOH'),
  ('THEIA',      'Theia'),
  ('ATC',        'ATC'),
  ('SIR',        'SIR'),
  ('KISWENSIDA', 'KISWENSIDA'),
  ('GULF',       'Gulf');

-- Paramètres par défaut
INSERT IGNORE INTO parametres (cle, valeur, description) VALUES
  ('PUBLICATION_CRON',     '0 0 6 * * 5',   'Expression cron pour la publication hebdomadaire (défaut: vendredi 06h00)'),
  ('DATE_DEBUT_GRAPHIQUE', '2026-01-01',    'Date de début pour les graphiques d''évolution'),
  ('TIMEZONE',             'Africa/Ouagadougou', 'Fuseau horaire de l''application');

-- Paramètres alertes (seuil 15 jours par défaut pour chaque produit)
INSERT IGNORE INTO parametres_alertes (produit_id, seuil_jours)
  SELECT id, 15 FROM produits;
