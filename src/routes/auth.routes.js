/* ==================================================================
 *  Auteur : BATIONO Ulrich Rachid Kévin
 *           Expert en Sécurité Informatique
 *           Développeur FullStack
 *           Tel: +226 51 57 82 89 // 66 72 02 32
 *           Whatsapp: +226 51 57 82 89
 *           Mail: bkevin@sonabhy.bf // bationor10@gmail.com
 *  Projet : MICA – SONABHY
 * ================================================================== */
const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth');
const v = require('../middleware/validate');

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

router.post('/login', loginLimiter, v.login, authController.login);
// Etape 2 de la connexion (double authentification) : meme limitation que la connexion
router.post('/login/2fa', loginLimiter, v.codeDoubleAuth, authController.loginDoubleAuth);
router.post('/logout', authController.logout);
router.get('/me', authenticate, authController.me);
router.put('/change-password', authenticate, passwordLimiter, v.changePassword, authController.changePassword);
router.put('/force-change-password', authenticate, passwordLimiter, v.forcedChangePassword, authController.forcedChangePassword);

module.exports = router;
