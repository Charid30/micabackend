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
const authService = require('../services/auth.service');
const { contexteRequete } = require('../services/securite-compte.service');
const { sendError } = require('../utils/http-error');
const { COOKIE_NAME, cookieOptions, readCookie } = require('../middleware/auth');
const COOKIE_2FA = 'mica_2fa';

const SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000; // aligné sur JWT_EXPIRES_IN (8h)

const setSessionCookie = (res, token) =>
  res.cookie(COOKIE_NAME, token, { ...cookieOptions(), maxAge: SESSION_MAX_AGE_MS });

exports.login = async (req, res) => {
  const { username, password } = req.body;
  try {
    const resultat = await authService.login(username.trim(), password, contexteRequete(req));
    if (resultat.etape2fa) {
      // Mot de passe correct : le code de double authentification est demande (cookie temporaire, 5 min)
      res.cookie(COOKIE_2FA, resultat.jeton2fa, { ...cookieOptions(), maxAge: 5 * 60 * 1000 });
      return res.json({ double_auth: true });
    }
    const { token, utilisateur } = resultat;
    setSessionCookie(res, token);
    // Le jeton n'est jamais exposé au JavaScript du navigateur
    res.json({ utilisateur });
  } catch (err) {
    sendError(res, err);
  }
};

exports.loginDoubleAuth = async (req, res) => {
  try {
    const jeton = readCookie(req, COOKIE_2FA);
    const { token, utilisateur } = await authService.loginDoubleAuth(jeton, req.body.code, contexteRequete(req));
    res.clearCookie(COOKIE_2FA, cookieOptions());
    setSessionCookie(res, token);
    res.json({ utilisateur });
  } catch (err) {
    sendError(res, err);
  }
};

exports.logout = (req, res) => {
  res.clearCookie(COOKIE_NAME, cookieOptions());
  res.json({ message: 'Déconnecté.' });
};

exports.me = async (req, res) => {
  try {
    res.json({ utilisateur: await authService.getMe(req.user.id) });
  } catch (err) {
    sendError(res, err);
  }
};

exports.forcedChangePassword = async (req, res) => {
  const { nouveauMotDePasse } = req.body;
  try {
    await authService.forcedChangePassword(req.user.id, nouveauMotDePasse);
    // Les anciens jetons sont invalidés : on délivre une nouvelle session
    setSessionCookie(res, authService.issueToken(req.user));
    res.json({ message: 'Mot de passe modifié avec succès.' });
  } catch (err) {
    sendError(res, err);
  }
};

exports.changePassword = async (req, res) => {
  const { ancienMotDePasse, nouveauMotDePasse } = req.body;
  try {
    await authService.changePassword(req.user.id, ancienMotDePasse, nouveauMotDePasse);
    setSessionCookie(res, authService.issueToken(req.user));
    res.json({ message: 'Mot de passe modifié avec succès.' });
  } catch (err) {
    sendError(res, err);
  }
};
