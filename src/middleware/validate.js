/* ==================================================================
 *  Auteur : BATIONO Ulrich Rachid Kévin
 *           Expert en Sécurité Informatique
 *           Développeur FullStack
 *           Tel: +226 51 57 82 89 // 66 72 02 32
 *           Whatsapp: +226 51 57 82 89
 *           Mail: bkevin@sonabhy.bf // bationor10@gmail.com
 *  Projet : MICA – SONABHY
 * ================================================================== */
// Règles de validation des entrées (express-validator).
// Chaque export est un tableau de middlewares à placer avant le contrôleur.
const { body, param, validationResult } = require('express-validator');

const PROFILS = ['ADMIN', 'GESTIONNAIRE', 'LECTEUR'];
const ACTIONS = ['READ', 'WRITE', 'NONE'];

// Renvoie la première erreur sous forme { message }
const check = (rules) => [
  ...rules,
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg });
    next();
  },
];

const str = (field, { min = 1, max, label = field, optional = false } = {}) => {
  let chain = body(field);
  if (optional) chain = chain.optional({ values: 'null' });
  return chain
    .isString().withMessage(`${label} invalide.`)
    .bail()
    .trim()
    .isLength({ min, max }).withMessage(`${label} : entre ${min} et ${max} caractères.`);
};

const id = (field, label = field, { optional = false } = {}) => {
  let chain = body(field);
  if (optional) chain = chain.optional({ values: 'null' });
  return chain.isInt({ min: 1 }).withMessage(`${label} invalide.`).toInt();
};

const idParam = param('id').isInt({ min: 1 }).withMessage('Identifiant invalide.').toInt();

module.exports = {
  idParam: check([idParam]),

  // ── Authentification
  login: check([
    str('username', { max: 100, label: 'Identifiant' }),
    body('password').isString().isLength({ min: 1, max: 128 }).withMessage('Mot de passe invalide.'),
  ]),
  forcedChangePassword: check([
    body('nouveauMotDePasse').isString().isLength({ min: 1, max: 128 }).withMessage('Le nouveau mot de passe est requis.'),
  ]),
  changePassword: check([
    body('ancienMotDePasse').isString().isLength({ min: 1, max: 128 }).withMessage('Les deux mots de passe sont requis.'),
    body('nouveauMotDePasse').isString().isLength({ min: 1, max: 128 }).withMessage('Les deux mots de passe sont requis.'),
  ]),

  // ── Utilisateurs
  createUtilisateur: check([
    id('agent_id', 'Agent'),
    str('username', { min: 3, max: 50, label: "Nom d'utilisateur" })
      .matches(/^[A-Za-z0-9._-]+$/).withMessage("Nom d'utilisateur : lettres, chiffres, point, tiret et underscore uniquement."),
    body('email').isString().bail().trim().isEmail().withMessage('Adresse e-mail invalide.').isLength({ max: 150 }),
    str('tel', { min: 0, max: 20, label: 'Téléphone', optional: true }),
    body('password').isString().isLength({ min: 1, max: 128 }).withMessage('Mot de passe requis.'),
    body('profil').optional().isIn(PROFILS).withMessage('Profil invalide.'),
    body('must_change_password').optional().isBoolean({ loose: true }),
  ]),
  updateUtilisateur: check([
    idParam,
    str('username', { min: 3, max: 50, label: "Nom d'utilisateur", optional: true })
      .matches(/^[A-Za-z0-9._-]+$/).withMessage("Nom d'utilisateur : lettres, chiffres, point, tiret et underscore uniquement."),
    body('email').optional().isString().bail().trim().isEmail().withMessage('Adresse e-mail invalide.').isLength({ max: 150 }),
    str('tel', { min: 0, max: 20, label: 'Téléphone', optional: true }),
    body('is_admin').optional().isBoolean({ loose: true }).withMessage('Valeur is_admin invalide.'),
  ]),
  resetPassword: check([
    idParam,
    body('password').isString().isLength({ min: 1, max: 128 }).withMessage('Nouveau mot de passe requis.'),
    body('must_change_password').optional().isBoolean({ loose: true }),
  ]),
  savePermissions: check([
    idParam,
    body('permissions').isArray({ max: 200 }).withMessage('Format invalide.'),
    body('permissions.*.module').isString().isLength({ min: 1, max: 50 }).withMessage('Module invalide.'),
    body('permissions.*.action').isIn(ACTIONS).withMessage('Action invalide.'),
    body('permissions.*.depot_id').optional({ values: 'null' }).isInt({ min: 1 }).withMessage('Dépôt invalide.'),
  ]),

  // ── Structures
  agent: (isUpdate) => check([
    ...(isUpdate ? [idParam] : []),
    id('direction_id', 'Direction', { optional: isUpdate }),
    str('matricule', { max: 20, label: 'Matricule', optional: isUpdate }),
    str('nom', { max: 100, label: 'Nom', optional: isUpdate }),
    str('prenoms', { min: 0, max: 150, label: 'Prénoms', optional: true }),
  ]),
  direction: (isUpdate) => check([
    ...(isUpdate ? [idParam] : []),
    id('entreprise_id', 'Entreprise', { optional: isUpdate }),
    str('acronyme', { max: 30, label: 'Acronyme', optional: isUpdate }),
    str('description', { min: 0, max: 1000, label: 'Description', optional: true }),
  ]),
  entreprise: (isUpdate) => check([
    ...(isUpdate ? [idParam] : []),
    str('nom', { max: 100, label: 'Nom', optional: isUpdate }),
    str('acronyme', { max: 20, label: 'Acronyme', optional: isUpdate }),
    str('description', { min: 0, max: 1000, label: 'Description', optional: true }),
  ]),

  // ── Données de référence (produits, dépôts, corridors, fournisseurs, marketeurs)
  reference: (isUpdate, extra = []) => check([
    ...(isUpdate ? [idParam] : []),
    str('code', { max: 30, label: 'Code', optional: isUpdate }),
    str('libelle', { max: 200, label: 'Libellé', optional: isUpdate }),
    ...extra,
  ]),
  produitExtra: [str('unite', { max: 20, label: 'Unité', optional: true })],
  depotExtra: [
    body('type').optional().isIn(['INTERIEUR', 'EXTERIEUR']).withMessage('Type de dépôt invalide.'),
    str('pays', { min: 0, max: 50, label: 'Pays', optional: true }),
  ],

  // ── Saisie quotidienne des stocks
  saisieStocks: check([
    id('rapport_id', 'Rapport'),
    body('lignes').isArray({ min: 1, max: 500 }).withMessage('Lignes de saisie invalides.'),
    body('lignes.*.depot_id').isInt({ min: 1 }).withMessage('Dépôt invalide.').toInt(),
    body('lignes.*.produit_id').isInt({ min: 1 }).withMessage('Produit invalide.').toInt(),
    body('lignes.*.stock_bacs').optional({ values: 'null' }).isFloat({ min: -1e12, max: 1e12 }).withMessage('Stock en bacs invalide.').toFloat(),
    body('lignes.*.stock_embranchement').optional({ values: 'null' }).isFloat({ min: 0, max: 1e12 }).withMessage('Stock en embranchement invalide.').toFloat(),
    body('lignes.*.action').optional({ values: 'null' }).isString().isLength({ max: 2000 }).withMessage('Action trop longue (2000 caractères maximum).'),
  ]),

  // ── Référentiel des stocks
  referentielDepots: check([
    body('date_effet').isISO8601({ strict: true }).withMessage("Date d'effet invalide."),
    body('lignes').isArray({ min: 1, max: 500 }).withMessage('Lignes invalides.'),
    body('lignes.*.depot_id').isInt({ min: 1 }).withMessage('Dépôt invalide.').toInt(),
    body('lignes.*.produit_id').isInt({ min: 1 }).withMessage('Produit invalide.').toInt(),
    body('lignes.*.impompable').optional({ values: 'null' }).isFloat({ min: 0, max: 1e12 }).withMessage('Impompable invalide.').toFloat(),
    body('lignes.*.conso_moyenne').optional({ values: 'null' }).isFloat({ min: 0, max: 1e12 }).withMessage('Consommation moyenne invalide.').toFloat(),
    body('lignes.*.exclu_total').optional({ values: 'null' }).isBoolean({ loose: true }).withMessage('Valeur "exclu du total" invalide.'),
  ]),
  referentielBesoins: check([
    body('date_effet').isISO8601({ strict: true }).withMessage("Date d'effet invalide."),
    body('besoins').isArray({ min: 1, max: 100 }).withMessage('Besoins invalides.'),
    body('besoins.*.produit_id').isInt({ min: 1 }).withMessage('Produit invalide.').toInt(),
    body('besoins.*.besoin_journalier').isFloat({ min: 0, max: 1e12 }).withMessage('Besoin journalier invalide.').toFloat(),
  ]),
  referentielParametres: check([
    body('seuil_rouge_jours').isFloat({ min: 0, max: 365 }).withMessage('Seuil rouge invalide (0 à 365 jours).').toFloat(),
    body('couverture_objectif_pct').isFloat({ min: 1, max: 1000 }).withMessage('Objectif de couverture invalide.').toFloat(),
    body('densite_gaz').isFloat({ min: 0.01, max: 2 }).withMessage('Densité du gaz invalide (0,01 à 2 t/m³).').toFloat(),
  ]),

  referentielDensites: check([
    body('densites').isArray({ min: 1, max: 100 }).withMessage('Densités invalides.'),
    body('densites.*.produit_id').isInt({ min: 1 }).withMessage('Produit invalide.').toInt(),
    body('densites.*.densite').isFloat({ min: 0.3, max: 1.5 }).withMessage('Densité invalide (0,3 à 1,5 t/m³).').toFloat(),
  ]),

  // ── Trésorerie
  saisieTresorerie: check([
    id('rapport_id', 'Rapport'),
    body('lignes').isArray({ max: 200 }).withMessage('Lignes invalides.'),
    body('lignes.*.code').isString().isLength({ min: 1, max: 50 }).withMessage('Code de ligne invalide.'),
    body('lignes.*.montant_n').optional({ values: 'null' }).isFloat({ min: -1e15, max: 1e15 }).withMessage('Montant invalide.').toFloat(),
  ]),
  ligneTresorerie: (isUpdate) => check([
    ...(isUpdate ? [idParam] : []),
    str('libelle', { max: 255, label: 'Libellé', optional: isUpdate }),
    body('sens').optional().isIn(['AVOIR', 'DETTE']).withMessage('Sens invalide (AVOIR ou DETTE).'),
    body('type').optional().isIn(['SAISIE', 'SOUS_TOTAL']).withMessage('Type invalide (SAISIE ou SOUS_TOTAL).'),
    body('parent_id').optional({ values: 'null' }).isInt({ min: 1 }).withMessage('Sous-total invalide.').toInt(),
    body('ordre').optional().isInt({ min: 0, max: 100000 }).withMessage('Ordre invalide.').toInt(),
    body('actif').optional().isBoolean({ loose: true }).withMessage('Valeur actif invalide.'),
  ]),

  // ── Paramètres
  parametre: check([
    idParam,
    body('valeur').exists().withMessage('Valeur requise.')
      .customSanitizer(v => (v === null ? '' : String(v)))
      .isLength({ max: 500 }).withMessage('Valeur trop longue.'),
  ]),
  alerte: check([
    idParam,
    body('seuil_jours').optional().isInt({ min: 0, max: 365 }).withMessage('Seuil invalide (0 à 365 jours).').toInt(),
    body('actif').optional().isBoolean({ loose: true }).withMessage('Valeur actif invalide.'),
  ]),
};

// Ne conserve que les champs autorisés (empêche d'écrire del, created_by, id…)
module.exports.pick = (obj, fields) =>
  fields.reduce((acc, f) => (obj[f] !== undefined ? { ...acc, [f]: obj[f] } : acc), {});
