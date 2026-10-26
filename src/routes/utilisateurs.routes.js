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
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/utilisateurs.controller');
const v = require('../middleware/validate');

const adminOnly = (req, res, next) => {
  if (!req.user?.is_admin) return res.status(403).json({ message: 'Accès réservé aux administrateurs.' });
  next();
};

router.use(adminOnly);

router.get('/', ctrl.getAll);
router.get('/modules', ctrl.getModules);
router.get('/:id', v.idParam, ctrl.getById);
router.post('/', v.createUtilisateur, ctrl.create);
router.put('/:id', v.updateUtilisateur, ctrl.update);
router.delete('/:id', v.idParam, ctrl.remove);
router.post('/:id/reset-password', v.resetPassword, ctrl.resetPassword);
router.get('/:id/permissions', v.idParam, ctrl.getPermissions);
router.post('/:id/permissions', v.savePermissions, ctrl.savePermissions);

module.exports = router;
