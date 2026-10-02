const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/utilisateurs.controller');
const { authorize } = require('../middleware/auth');

const adminOnly = (req, res, next) => {
  if (!req.user?.is_admin) return res.status(403).json({ message: 'Accès réservé aux administrateurs.' });
  next();
};

router.get('/', adminOnly, ctrl.getAll);
router.get('/modules', adminOnly, ctrl.getModules);
router.get('/:id', adminOnly, ctrl.getById);
router.post('/', adminOnly, ctrl.create);
router.put('/:id', adminOnly, ctrl.update);
router.delete('/:id', adminOnly, ctrl.remove);
router.post('/:id/reset-password', adminOnly, ctrl.resetPassword);
router.get('/:id/permissions', adminOnly, ctrl.getPermissions);
router.post('/:id/permissions', adminOnly, ctrl.savePermissions);

module.exports = router;
