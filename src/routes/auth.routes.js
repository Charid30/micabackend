const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth');

// 10 tentatives max / 15 min par IP sur le login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Trop de tentatives de connexion. Réessayez dans 15 minutes.' },
  skipSuccessfulRequests: true,
});

// 5 changements de mot de passe max / 15 min par IP
const passwordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Trop de tentatives. Réessayez dans 15 minutes.' },
});

router.post('/login', loginLimiter, authController.login);
router.get('/me', authenticate, authController.me);
router.put('/change-password', authenticate, passwordLimiter, authController.changePassword);
router.put('/force-change-password', authenticate, passwordLimiter, authController.forcedChangePassword);

module.exports = router;
