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
const sequelize = require('../config/database');
const { DataTypes } = require('sequelize');

// ── Audit mixin fields (appliqué sur tous les modèles)
const auditFields = {
  created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  created_by: { type: DataTypes.INTEGER, allowNull: true },
  updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  updated_by: { type: DataTypes.INTEGER, allowNull: true },
  deleted_at: { type: DataTypes.DATE, allowNull: true },
  deleted_by: { type: DataTypes.INTEGER, allowNull: true },
  del: { type: DataTypes.TINYINT, defaultValue: 0 },
};

// ── ENTREPRISE
const Entreprise = sequelize.define('Entreprise', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  nom: { type: DataTypes.STRING(100), allowNull: false },
  acronyme: { type: DataTypes.STRING(20), allowNull: false, unique: true },
  description: { type: DataTypes.TEXT, allowNull: true },
  ...auditFields,
}, { tableName: 'entreprises', timestamps: false });

// ── DIRECTION
const Direction = sequelize.define('Direction', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  entreprise_id: { type: DataTypes.INTEGER, allowNull: false },
  acronyme: { type: DataTypes.STRING(30), allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: true },
  ...auditFields,
}, { tableName: 'directions', timestamps: false });

// ── AGENT
const Agent = sequelize.define('Agent', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  direction_id: { type: DataTypes.INTEGER, allowNull: false },
  matricule: { type: DataTypes.STRING(20), allowNull: false, unique: true },
  nom: { type: DataTypes.STRING(100), allowNull: false },
  prenoms: { type: DataTypes.STRING(150), allowNull: true },
  ...auditFields,
}, { tableName: 'agents', timestamps: false });

// ── UTILISATEUR
const Utilisateur = sequelize.define('Utilisateur', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  agent_id: { type: DataTypes.INTEGER, allowNull: false, unique: true },
  username: { type: DataTypes.STRING(50), allowNull: false, unique: true },
  email: { type: DataTypes.STRING(150), allowNull: false, unique: true },
  tel: { type: DataTypes.STRING(20), allowNull: true },
  password: { type: DataTypes.STRING(255), allowNull: false },
  is_admin: { type: DataTypes.TINYINT, defaultValue: 0 },
  must_change_password: { type: DataTypes.TINYINT, defaultValue: 0 },
  password_changed_at: { type: DataTypes.DATE, allowNull: true },
  failed_login_attempts: { type: DataTypes.INTEGER, defaultValue: 0 },
  locked_until: { type: DataTypes.DATE, allowNull: true },
  derniere_connexion_at: { type: DataTypes.DATE, allowNull: true },
  derniere_connexion_ip: { type: DataTypes.STRING(45), allowNull: true },
  // Double authentification (TOTP) : secrets chiffres, codes de secours en empreintes
  totp_secret: { type: DataTypes.STRING(255), allowNull: true },
  totp_secret_attente: { type: DataTypes.STRING(255), allowNull: true },
  totp_codes_secours: { type: DataTypes.TEXT, allowNull: true },
  totp_active_le: { type: DataTypes.DATE, allowNull: true },
  ...auditFields,
}, {
  tableName: 'utilisateurs',
  timestamps: false,
  // Le hash du mot de passe et les secrets de double authentification ne sont jamais charges
  // (ni renvoyes au client) sauf via scope('withPassword')
  defaultScope: { attributes: { exclude: ['password', 'failed_login_attempts', 'locked_until', 'totp_secret', 'totp_secret_attente', 'totp_codes_secours'] } },
  scopes: { withPassword: {} },
});

// ── PERMISSION
const Permission = sequelize.define('Permission', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  utilisateur_id: { type: DataTypes.INTEGER, allowNull: false },
  module: { type: DataTypes.STRING(50), allowNull: false },
  action: { type: DataTypes.STRING(30), allowNull: false },
  depot_id: { type: DataTypes.INTEGER, allowNull: true, defaultValue: null },
  ...auditFields,
}, { tableName: 'permissions', timestamps: false });

// ── PRODUIT
const Produit = sequelize.define('Produit', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  code: { type: DataTypes.STRING(20), allowNull: false, unique: true },
  libelle: { type: DataTypes.STRING(100), allowNull: false },
  unite: { type: DataTypes.STRING(20), allowNull: false },
  densite_t_m3: { type: DataTypes.DECIMAL(6, 4), allowNull: true },   // densite a 15 °C (conversion tonnes -> litres)
  ...auditFields,
}, { tableName: 'produits', timestamps: false });

// ── DEPOT
const Depot = sequelize.define('Depot', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  code: { type: DataTypes.STRING(30), allowNull: false, unique: true },
  libelle: { type: DataTypes.STRING(100), allowNull: false },
  type: { type: DataTypes.ENUM('INTERIEUR', 'EXTERIEUR'), allowNull: false },
  pays: { type: DataTypes.STRING(50), allowNull: true },
  ...auditFields,
}, { tableName: 'depots', timestamps: false });

// ── CORRIDOR
const Corridor = sequelize.define('Corridor', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  code: { type: DataTypes.STRING(30), allowNull: false, unique: true },
  libelle: { type: DataTypes.STRING(100), allowNull: false },
  ...auditFields,
}, { tableName: 'corridors', timestamps: false });

// ── FOURNISSEUR
const Fournisseur = sequelize.define('Fournisseur', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  code: { type: DataTypes.STRING(30), allowNull: false, unique: true },
  libelle: { type: DataTypes.STRING(150), allowNull: false },
  ...auditFields,
}, { tableName: 'fournisseurs', timestamps: false });

// ── MARKETEUR
const Marketeur = sequelize.define('Marketeur', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  code: { type: DataTypes.STRING(20), allowNull: false, unique: true },
  libelle: { type: DataTypes.STRING(200), allowNull: false },
  ...auditFields,
}, { tableName: 'marketeurs', timestamps: false });

// ── RAPPORT HEBDO
const RapportHebdo = sequelize.define('RapportHebdo', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  annee: { type: DataTypes.INTEGER, allowNull: false },
  semaine_iso: { type: DataTypes.INTEGER, allowNull: false },
  date_debut: { type: DataTypes.DATEONLY, allowNull: false },
  date_fin: { type: DataTypes.DATEONLY, allowNull: false },
  statut: { type: DataTypes.ENUM('BROUILLON', 'PUBLIE'), defaultValue: 'BROUILLON' },
  date_publication: { type: DataTypes.DATE, allowNull: true },
  publie_par: { type: DataTypes.INTEGER, allowNull: true },
  ...auditFields,
}, { tableName: 'rapports_hebdo', timestamps: false });

// ── STOCK DEPOT
const StockDepot = sequelize.define('StockDepot', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  rapport_id: { type: DataTypes.INTEGER, allowNull: false },
  depot_id: { type: DataTypes.INTEGER, allowNull: false },
  produit_id: { type: DataTypes.INTEGER, allowNull: false },
  date_saisie: { type: DataTypes.DATEONLY, allowNull: true, defaultValue: null },
  stock_bacs: { type: DataTypes.DECIMAL(15, 3), defaultValue: 0 },
  stock_embranchement: { type: DataTypes.DECIMAL(15, 3), defaultValue: 0 },
  stock_impompable: { type: DataTypes.DECIMAL(15, 3), defaultValue: 0 },
  stock_disponible: { type: DataTypes.DECIMAL(15, 3), defaultValue: 0 },
  autonomie: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  ...auditFields,
}, { tableName: 'stocks_depot', timestamps: false });

// ── CONSOMMATION JOURNALIERE
const ConsommationJournaliere = sequelize.define('ConsommationJournaliere', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  rapport_id: { type: DataTypes.INTEGER, allowNull: false },
  depot_id: { type: DataTypes.INTEGER, allowNull: false },
  produit_id: { type: DataTypes.INTEGER, allowNull: false },
  conso_moyenne: { type: DataTypes.DECIMAL(15, 3), allowNull: false },
  stock_securite: { type: DataTypes.DECIMAL(15, 3), defaultValue: 0 },
  ...auditFields,
}, { tableName: 'consommations_journalieres', timestamps: false });

// ── CHARGEMENT CORRIDOR
const ChargementCorridor = sequelize.define('ChargementCorridor', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  rapport_id: { type: DataTypes.INTEGER, allowNull: false },
  corridor_id: { type: DataTypes.INTEGER, allowNull: false },
  produit_id: { type: DataTypes.INTEGER, allowNull: false },
  date_saisie: { type: DataTypes.DATEONLY, allowNull: true, defaultValue: null },
  camions_en_attente: { type: DataTypes.INTEGER, defaultValue: 0 },
  camions_charges: { type: DataTypes.INTEGER, defaultValue: 0 },
  bons_emis: { type: DataTypes.INTEGER, defaultValue: 0 },
  objectif_journalier: { type: DataTypes.INTEGER, allowNull: true },
  ...auditFields,
}, { tableName: 'chargements_corridors', timestamps: false });

// ── ENCOURS LIVRAISON
const EncoursLivraison = sequelize.define('EncoursLivraison', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  rapport_id: { type: DataTypes.INTEGER, allowNull: false },
  fournisseur_id: { type: DataTypes.INTEGER, allowNull: false },
  produit_id: { type: DataTypes.INTEGER, allowNull: false },
  quantite_tm: { type: DataTypes.DECIMAL(15, 3), allowNull: false },
  port_livraison: { type: DataTypes.STRING(50), allowNull: true },
  date_debut: { type: DataTypes.DATEONLY, allowNull: false },
  date_fin: { type: DataTypes.DATEONLY, allowNull: false },
  ...auditFields,
}, { tableName: 'encours_livraisons', timestamps: false });

// ── VENTE MARKETEUR
const VenteMarketeur = sequelize.define('VenteMarketeur', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  rapport_id: { type: DataTypes.INTEGER, allowNull: false },
  date_saisie: { type: DataTypes.DATEONLY, allowNull: true, defaultValue: null },
  marketeur_id: { type: DataTypes.INTEGER, allowNull: false },
  produit_id: { type: DataTypes.INTEGER, allowNull: false },
  quantite: { type: DataTypes.DECIMAL(15, 3), defaultValue: 0 },
  ...auditFields,
}, { tableName: 'ventes_marketeurs', timestamps: false });

// ── FINANCE DETTE
const FinanceDette = sequelize.define('FinanceDette', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  rapport_id: { type: DataTypes.INTEGER, allowNull: false },
  designation: { type: DataTypes.STRING(255), allowNull: false },
  montant: { type: DataTypes.DECIMAL(20, 2), allowNull: false },
  sens: { type: DataTypes.ENUM('DETTE_ETAT_VERS_SONABHY', 'ENGAGEMENT_FOURNISSEUR'), allowNull: false },
  ...auditFields,
}, { tableName: 'finances_dettes', timestamps: false });

// ── CAMION DEPOT
const CamionDepot = sequelize.define('CamionDepot', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  rapport_id: { type: DataTypes.INTEGER, allowNull: false },
  depot_id: { type: DataTypes.INTEGER, allowNull: false },
  produit_id: { type: DataTypes.INTEGER, allowNull: false },
  date_saisie: { type: DataTypes.DATEONLY, allowNull: true, defaultValue: null },
  camions_en_attente: { type: DataTypes.INTEGER, defaultValue: 0 },
  camions_recus: { type: DataTypes.INTEGER, defaultValue: 0 },
  camions_depotes: { type: DataTypes.INTEGER, defaultValue: 0 },
  ...auditFields,
}, { tableName: 'camions_depot', timestamps: false });

// ── TEMPS ATTENTE CAMION
const TempsAttenteCamion = sequelize.define('TempsAttenteCamion', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  rapport_id:      { type: DataTypes.INTEGER,     allowNull: false },
  date_saisie:     { type: DataTypes.DATEONLY, allowNull: true, defaultValue: null },
  site_type:       { type: DataTypes.STRING(30),  allowNull: true },
  site_nom:        { type: DataTypes.STRING(100), allowNull: true },
  nb_camions:      { type: DataTypes.INTEGER,     defaultValue: 0 },
  temps_moyen:     { type: DataTypes.DECIMAL(8, 2), allowNull: true },
  temps_mini:      { type: DataTypes.DECIMAL(8, 2), allowNull: true },
  temps_maxi:      { type: DataTypes.DECIMAL(8, 2), allowNull: true },
  objectif_jours:  { type: DataTypes.DECIMAL(4, 1), allowNull: true },
  ...auditFields,
}, { tableName: 'temps_attente_camions', timestamps: false });

// ── VEILLE MARCHE
const VeilleMarche = sequelize.define('VeilleMarche', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  rapport_id: { type: DataTypes.INTEGER, allowNull: false },
  date_saisie: { type: DataTypes.DATEONLY, allowNull: true, defaultValue: null },
  produit: { type: DataTypes.STRING(30), allowNull: false },
  prix_semaine_n: { type: DataTypes.DECIMAL(10, 4), allowNull: true },
  prix_semaine_n1: { type: DataTypes.DECIMAL(10, 4), allowNull: true },
  taux_change_usd: { type: DataTypes.DECIMAL(10, 4), allowNull: false, defaultValue: 0 },
  ...auditFields,
}, { tableName: 'veille_marche', timestamps: false });

// ── VEILLE GEOPOLITIQUE
const VeilleGeopolitique = sequelize.define('VeilleGeopolitique', {
  id:            { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  rapport_id:    { type: DataTypes.INTEGER, allowNull: false },
  date_saisie:   { type: DataTypes.DATEONLY, allowNull: true, defaultValue: null },
  zone:          { type: DataTypes.STRING(100), allowNull: true },
  evenement:     { type: DataTypes.TEXT, allowNull: false },
  niveau_risque: { type: DataTypes.ENUM('FAIBLE', 'MOYEN', 'ELEVE'), allowNull: true, defaultValue: null },
  impact:        { type: DataTypes.TEXT, allowNull: true },
  ...auditFields,
}, { tableName: 'veille_geopolitique', timestamps: false });

// ── ACHAT TRADER
const AchatTrader = sequelize.define('AchatTrader', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  rapport_id: { type: DataTypes.INTEGER, allowNull: false },
  produit_id: { type: DataTypes.INTEGER, allowNull: false },
  fournisseur_id: { type: DataTypes.INTEGER, allowNull: false },
  type_operation: { type: DataTypes.STRING(50), allowNull: false },
  lieu_livraison: { type: DataTypes.STRING(100), allowNull: false },
  date_livraison: { type: DataTypes.DATEONLY, allowNull: false },
  quantite_tm: { type: DataTypes.DECIMAL(15, 3), allowNull: false },
  quantite_m3_15: { type: DataTypes.DECIMAL(15, 3), allowNull: true },
  quantite_m3_ambiant: { type: DataTypes.DECIMAL(15, 3), allowNull: true },
  periode_cotation: { type: DataTypes.STRING(100), allowNull: true },
  prix_unitaire_caf_usd: { type: DataTypes.DECIMAL(12, 4), allowNull: false },
  taux_change: { type: DataTypes.DECIMAL(10, 4), allowNull: false },
  montant_trans_cfa: { type: DataTypes.DECIMAL(20, 2), allowNull: false },
  frais_lc_cfa: { type: DataTypes.DECIMAL(20, 2), allowNull: true },
  prime_trader_usd: { type: DataTypes.DECIMAL(10, 4), allowNull: true },
  prime_structure_usd: { type: DataTypes.DECIMAL(10, 4), allowNull: true },
  gains_pertes_usd: { type: DataTypes.DECIMAL(15, 4), allowNull: true },
  gains_perte_fcfa: { type: DataTypes.DECIMAL(20, 2), allowNull: true },
  ...auditFields,
}, { tableName: 'achats_traders', timestamps: false });

// ── TRESORERIE SEMAINE
const TresorerieSemaine = sequelize.define('TresorerieSemaine', {
  id:         { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  rapport_id: { type: DataTypes.INTEGER, allowNull: false },
  date_saisie: { type: DataTypes.DATEONLY, allowNull: true, defaultValue: null },
  code:       { type: DataTypes.STRING(50), allowNull: false },
  libelle:    { type: DataTypes.STRING(255), allowNull: true },   // libelle au moment de la saisie
  montant_n1: { type: DataTypes.DECIMAL(20, 2), allowNull: true },
  montant_n:  { type: DataTypes.DECIMAL(20, 2), allowNull: true },
  ...auditFields,
}, { tableName: 'tresorerie_semaine', timestamps: false });

// ── REFERENTIEL STOCK (valeurs « figées » par dépôt × produit, historisées par date d'effet)
const ReferentielStock = sequelize.define('ReferentielStock', {
  id:            { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  depot_id:      { type: DataTypes.INTEGER, allowNull: false },
  produit_id:    { type: DataTypes.INTEGER, allowNull: false },
  impompable:    { type: DataTypes.DECIMAL(15, 3), defaultValue: 0 },
  conso_moyenne: { type: DataTypes.DECIMAL(15, 3), defaultValue: 0 },
  exclu_total:   { type: DataTypes.TINYINT, defaultValue: 0 },
  date_effet:    { type: DataTypes.DATEONLY, allowNull: false },
  ...auditFields,
}, { tableName: 'referentiels_stock', timestamps: false });

// ── BESOINS EXTERIEURS (besoin journalier par produit, fixe par la DSTA)
const BesoinExterieur = sequelize.define('BesoinExterieur', {
  id:                { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  produit_id:        { type: DataTypes.INTEGER, allowNull: false },
  besoin_journalier: { type: DataTypes.DECIMAL(15, 3), defaultValue: 0 },
  date_effet:        { type: DataTypes.DATEONLY, allowNull: false },
  ...auditFields,
}, { tableName: 'besoins_exterieurs', timestamps: false });

// ── ACTIONS ENTREPRISES pour relever le niveau des stocks (DSTA)
const ActionStock = sequelize.define('ActionStock', {
  id:         { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  rapport_id: { type: DataTypes.INTEGER, allowNull: false },
  depot_id:   { type: DataTypes.INTEGER, allowNull: false },
  produit_id: { type: DataTypes.INTEGER, allowNull: false },
  action:     { type: DataTypes.TEXT, allowNull: false },
  ...auditFields,
}, { tableName: 'actions_stocks', timestamps: false });

// ── LIGNES DE TRESORERIE (configurables par le chef Tresorerie)
const TresorerieLigne = sequelize.define('TresorerieLigne', {
  id:        { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  code:      { type: DataTypes.STRING(50), allowNull: false, unique: true },
  libelle:   { type: DataTypes.STRING(255), allowNull: false },
  sens:      { type: DataTypes.ENUM('AVOIR', 'DETTE'), defaultValue: 'AVOIR' },
  type:      { type: DataTypes.ENUM('SAISIE', 'SOUS_TOTAL', 'TOTAL'), defaultValue: 'SAISIE' },
  parent_id: { type: DataTypes.INTEGER, allowNull: true },
  ordre:     { type: DataTypes.INTEGER, defaultValue: 0 },
  actif:     { type: DataTypes.TINYINT, defaultValue: 1 },
  ...auditFields,
}, { tableName: 'tresorerie_lignes', timestamps: false });

// ── RECOMMANDATIONS
const Recommandation = sequelize.define('Recommandation', {
  id:                 { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  rapport_id:         { type: DataTypes.INTEGER, allowNull: false },
  date_saisie:        { type: DataTypes.DATEONLY, allowNull: true, defaultValue: null },
  informations_utiles: { type: DataTypes.TEXT, allowNull: true },   // rubrique « Informations utiles » du rapport
  tendance_generale:  { type: DataTypes.TEXT, allowNull: true },
  risques_majeurs:    { type: DataTypes.TEXT, allowNull: true },
  impact_sonabhy:     { type: DataTypes.TEXT, allowNull: true },
  recommandations:    { type: DataTypes.TEXT, allowNull: true },
  ...auditFields,
}, { tableName: 'recommandations', timestamps: false });

// ── CAF MOYEN ACHATS
const CafMoyenAchat = sequelize.define('CafMoyenAchat', {
  id:         { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  annee:      { type: DataTypes.SMALLINT, allowNull: false },
  mois:       { type: DataTypes.TINYINT, allowNull: false },
  corridor:   { type: DataTypes.STRING(50), allowNull: false },
  produit_id: { type: DataTypes.INTEGER, allowNull: false },
  valeur_caf: { type: DataTypes.DECIMAL(10, 3), allowNull: true },
  ...auditFields,
}, { tableName: 'caf_moyen_achats', timestamps: false });

// ── PARAMETRE
const Parametre = sequelize.define('Parametre', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  cle: { type: DataTypes.STRING(60), allowNull: false, unique: true },
  valeur: { type: DataTypes.STRING(255), allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: true },
  ...auditFields,
}, { tableName: 'parametres', timestamps: false });

// ── PARAMETRE ALERTE
const ParametreAlerte = sequelize.define('ParametreAlerte', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  produit_id: { type: DataTypes.INTEGER, allowNull: false, unique: true },
  seuil_jours: { type: DataTypes.INTEGER, defaultValue: 15 },
  actif: { type: DataTypes.TINYINT, defaultValue: 1 },
  ...auditFields,
}, { tableName: 'parametres_alertes', timestamps: false });

// ══════════════════════════════════════════
// ASSOCIATIONS
// ══════════════════════════════════════════

Entreprise.hasMany(Direction, { foreignKey: 'entreprise_id', as: 'directions' });
Direction.belongsTo(Entreprise, { foreignKey: 'entreprise_id', as: 'entreprise' });

Direction.hasMany(Agent, { foreignKey: 'direction_id', as: 'agents' });
Agent.belongsTo(Direction, { foreignKey: 'direction_id', as: 'direction' });

Agent.hasOne(Utilisateur, { foreignKey: 'agent_id', as: 'utilisateur' });
Utilisateur.belongsTo(Agent, { foreignKey: 'agent_id', as: 'agent' });

// ── SAUVEGARDES de la base (planifiees, manuelles, rattrapage)
const Sauvegarde = sequelize.define('Sauvegarde', {
  id:               { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  fichier:          { type: DataTypes.STRING(255), allowNull: true },
  taille:           { type: DataTypes.BIGINT, allowNull: true },
  statut:           { type: DataTypes.ENUM('OK', 'ECHEC'), allowNull: false },
  message:          { type: DataTypes.STRING(500), allowNull: true },
  origine:          { type: DataTypes.ENUM('PLANIFIEE', 'MANUELLE', 'RATTRAPAGE'), allowNull: false },
  duree_ms:         { type: DataTypes.INTEGER, allowNull: true },
  copie_secondaire: { type: DataTypes.TINYINT, defaultValue: 0 },
  created_at:       { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  created_by:       { type: DataTypes.INTEGER, allowNull: true },
}, { tableName: 'sauvegardes', timestamps: false });

// ── JOURNAL D'AUDIT des actions d'ecriture
const JournalAction = sequelize.define('JournalAction', {
  id:             { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  utilisateur_id: { type: DataTypes.INTEGER, allowNull: true },
  username:       { type: DataTypes.STRING(50), allowNull: true },
  action:         { type: DataTypes.STRING(40), allowNull: false },
  module:         { type: DataTypes.STRING(60), allowNull: false },
  route:          { type: DataTypes.STRING(255), allowNull: false },
  cible:          { type: DataTypes.STRING(255), allowNull: true },
  details:        { type: DataTypes.TEXT, allowNull: true },
  statut_http:    { type: DataTypes.SMALLINT, allowNull: true },
  succes:         { type: DataTypes.TINYINT, defaultValue: 1 },
  ip:             { type: DataTypes.STRING(45), allowNull: true },
  created_at:     { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
}, { tableName: 'journal_actions', timestamps: false });

// ── CONNEXIONS (historique des connexions reussies et echouees de chaque compte)
const ConnexionUtilisateur = sequelize.define('ConnexionUtilisateur', {
  id:             { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  utilisateur_id: { type: DataTypes.INTEGER, allowNull: false },
  succes:         { type: DataTypes.TINYINT, allowNull: false },
  motif:          { type: DataTypes.STRING(60), allowNull: true },
  ip:             { type: DataTypes.STRING(45), allowNull: true },
  navigateur:     { type: DataTypes.STRING(255), allowNull: true },
  created_at:     { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
}, { tableName: 'connexions_utilisateurs', timestamps: false });

Utilisateur.hasMany(Permission, { foreignKey: 'utilisateur_id', as: 'permissions' });
Permission.belongsTo(Utilisateur, { foreignKey: 'utilisateur_id', as: 'utilisateur' });
// Depot auquel la permission est limitee (le type sert a l'affichage du menu interieur / exterieur)
Permission.belongsTo(Depot, { foreignKey: 'depot_id', as: 'depot' });

RapportHebdo.hasMany(StockDepot, { foreignKey: 'rapport_id', as: 'stocks' });
StockDepot.belongsTo(RapportHebdo, { foreignKey: 'rapport_id', as: 'rapport' });
Depot.hasMany(StockDepot, { foreignKey: 'depot_id' });
StockDepot.belongsTo(Depot, { foreignKey: 'depot_id', as: 'depot' });
Produit.hasMany(StockDepot, { foreignKey: 'produit_id' });
StockDepot.belongsTo(Produit, { foreignKey: 'produit_id', as: 'produit' });

RapportHebdo.hasMany(ConsommationJournaliere, { foreignKey: 'rapport_id', as: 'consommations' });
ConsommationJournaliere.belongsTo(RapportHebdo, { foreignKey: 'rapport_id' });
Depot.hasMany(ConsommationJournaliere, { foreignKey: 'depot_id' });
ConsommationJournaliere.belongsTo(Depot, { foreignKey: 'depot_id', as: 'depot' });
Produit.hasMany(ConsommationJournaliere, { foreignKey: 'produit_id' });
ConsommationJournaliere.belongsTo(Produit, { foreignKey: 'produit_id', as: 'produit' });

RapportHebdo.hasMany(ChargementCorridor, { foreignKey: 'rapport_id', as: 'chargements' });
ChargementCorridor.belongsTo(RapportHebdo, { foreignKey: 'rapport_id' });
Corridor.hasMany(ChargementCorridor, { foreignKey: 'corridor_id' });
ChargementCorridor.belongsTo(Corridor, { foreignKey: 'corridor_id', as: 'corridor' });
Produit.hasMany(ChargementCorridor, { foreignKey: 'produit_id' });
ChargementCorridor.belongsTo(Produit, { foreignKey: 'produit_id', as: 'produit' });

RapportHebdo.hasMany(EncoursLivraison, { foreignKey: 'rapport_id', as: 'encours' });
EncoursLivraison.belongsTo(RapportHebdo, { foreignKey: 'rapport_id' });
Fournisseur.hasMany(EncoursLivraison, { foreignKey: 'fournisseur_id' });
EncoursLivraison.belongsTo(Fournisseur, { foreignKey: 'fournisseur_id', as: 'fournisseur' });
Produit.hasMany(EncoursLivraison, { foreignKey: 'produit_id' });
EncoursLivraison.belongsTo(Produit, { foreignKey: 'produit_id', as: 'produit' });

RapportHebdo.hasMany(VenteMarketeur, { foreignKey: 'rapport_id', as: 'ventes' });
VenteMarketeur.belongsTo(RapportHebdo, { foreignKey: 'rapport_id' });
Marketeur.hasMany(VenteMarketeur, { foreignKey: 'marketeur_id' });
VenteMarketeur.belongsTo(Marketeur, { foreignKey: 'marketeur_id', as: 'marketeur' });
Produit.hasMany(VenteMarketeur, { foreignKey: 'produit_id' });
VenteMarketeur.belongsTo(Produit, { foreignKey: 'produit_id', as: 'produit' });

RapportHebdo.hasMany(FinanceDette, { foreignKey: 'rapport_id', as: 'dettes' });
FinanceDette.belongsTo(RapportHebdo, { foreignKey: 'rapport_id' });

RapportHebdo.hasMany(CamionDepot, { foreignKey: 'rapport_id', as: 'camions' });
CamionDepot.belongsTo(RapportHebdo, { foreignKey: 'rapport_id' });
Depot.hasMany(CamionDepot, { foreignKey: 'depot_id' });
CamionDepot.belongsTo(Depot, { foreignKey: 'depot_id', as: 'depot' });
Produit.hasMany(CamionDepot, { foreignKey: 'produit_id' });
CamionDepot.belongsTo(Produit, { foreignKey: 'produit_id', as: 'produit' });

RapportHebdo.hasMany(TempsAttenteCamion, { foreignKey: 'rapport_id', as: 'tempsAttente' });
TempsAttenteCamion.belongsTo(RapportHebdo, { foreignKey: 'rapport_id' });

RapportHebdo.hasMany(VeilleMarche, { foreignKey: 'rapport_id', as: 'veilleMarche' });
VeilleMarche.belongsTo(RapportHebdo, { foreignKey: 'rapport_id' });

RapportHebdo.hasMany(VeilleGeopolitique, { foreignKey: 'rapport_id', as: 'veilleGeo' });
VeilleGeopolitique.belongsTo(RapportHebdo, { foreignKey: 'rapport_id' });

RapportHebdo.hasMany(AchatTrader, { foreignKey: 'rapport_id', as: 'achats' });
AchatTrader.belongsTo(RapportHebdo, { foreignKey: 'rapport_id' });
Produit.hasMany(AchatTrader, { foreignKey: 'produit_id' });
AchatTrader.belongsTo(Produit, { foreignKey: 'produit_id', as: 'produit' });
Fournisseur.hasMany(AchatTrader, { foreignKey: 'fournisseur_id' });
AchatTrader.belongsTo(Fournisseur, { foreignKey: 'fournisseur_id', as: 'fournisseur' });

Produit.hasOne(ParametreAlerte, { foreignKey: 'produit_id' });
ParametreAlerte.belongsTo(Produit, { foreignKey: 'produit_id', as: 'produit' });

RapportHebdo.hasMany(TresorerieSemaine, { foreignKey: 'rapport_id', as: 'tresorerie' });
TresorerieSemaine.belongsTo(RapportHebdo, { foreignKey: 'rapport_id' });

ReferentielStock.belongsTo(Depot, { foreignKey: 'depot_id', as: 'depot' });
ReferentielStock.belongsTo(Produit, { foreignKey: 'produit_id', as: 'produit' });
BesoinExterieur.belongsTo(Produit, { foreignKey: 'produit_id', as: 'produit' });
TresorerieLigne.belongsTo(TresorerieLigne, { foreignKey: 'parent_id', as: 'parent' });

RapportHebdo.hasOne(Recommandation, { foreignKey: 'rapport_id', as: 'recommandation' });
Recommandation.belongsTo(RapportHebdo, { foreignKey: 'rapport_id' });

Produit.hasMany(CafMoyenAchat, { foreignKey: 'produit_id' });
CafMoyenAchat.belongsTo(Produit, { foreignKey: 'produit_id', as: 'produit' });

module.exports = {
  sequelize,
  ConnexionUtilisateur,
  Sauvegarde,
  JournalAction,
  Entreprise,
  Direction,
  Agent,
  Utilisateur,
  Permission,
  Produit,
  Depot,
  Corridor,
  Fournisseur,
  Marketeur,
  RapportHebdo,
  StockDepot,
  ConsommationJournaliere,
  ChargementCorridor,
  EncoursLivraison,
  VenteMarketeur,
  FinanceDette,
  CamionDepot,
  TempsAttenteCamion,
  VeilleMarche,
  VeilleGeopolitique,
  AchatTrader,
  Parametre,
  ParametreAlerte,
  TresorerieSemaine,
  TresorerieLigne,
  ReferentielStock,
  BesoinExterieur,
  ActionStock,
  Recommandation,
  CafMoyenAchat,
};
