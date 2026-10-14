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
