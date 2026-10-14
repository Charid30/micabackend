const jwt = require('jsonwebtoken');
const jwtConfig = require('../config/jwt');
const { Utilisateur, Agent, Permission } = require('../models');

const COOKIE_NAME = 'mica_token';
const isProd = process.env.NODE_ENV === 'production';

// Options du cookie de session : inaccessible au JavaScript (HttpOnly), HTTPS uniquement en prod,
// jamais envoyé depuis un autre site (SameSite=Strict)
const cookieOptions = () => ({
  httpOnly: true,
  secure: isProd,
  sameSite: 'strict',
  path: '/',
});

const readCookie = (req, name) => {
  const raw = req.headers.cookie;
  if (!raw) return null;
  for (const part of raw.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === name) return decodeURIComponent(part.slice(idx + 1).trim());
  }
  return null;
};

const extractToken = (req) => {
  const fromCookie = readCookie(req, COOKIE_NAME);
  if (fromCookie) return fromCookie;
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) return header.split(' ')[1];
  return null;
};

// Identifiant du compte si la requete porte une session valide (signature et expiration verifiees), sinon null.
// Sert a la limitation de debit : un jeton forge ou expire ne donne pas acces au quota "utilisateur".
// Resultat memorise sur la requete (le limiteur l'appelle pour la cle et pour la limite).
const getSessionUserId = (req) => {
  if (req._sessionUserId !== undefined) return req._sessionUserId;
  let id = null;
  const token = extractToken(req);
  if (token) {
    try { id = jwt.verify(token, jwtConfig.secret, { algorithms: ['HS256'] }).id ?? null; } catch { id = null; }
  }
  req._sessionUserId = id;
  return id;
};

// Protection CSRF : un formulaire ou une image d'un site tiers ne peut pas ajouter cet en-tête,
// et CORS refuse l'en-tête aux origines non autorisées.
const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];
const requireAjaxHeader = (req, res, next) => {
  if (SAFE_METHODS.includes(req.method)) return next();
  if (req.get('X-Requested-With') !== 'XMLHttpRequest') {
    return res.status(403).json({ message: 'Requête refusée.' });
  }
  next();
};

const authenticate = async (req, res, next) => {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ message: 'Token manquant ou invalide.' });
  }
  try {
    const decoded = jwt.verify(token, jwtConfig.secret, { algorithms: ['HS256'] });
    const user = await Utilisateur.findOne({
      where: { id: decoded.id, del: 0 },
      include: [
        { model: Agent, as: 'agent' },
        { model: Permission, as: 'permissions', required: false },
      ],
    });
    if (!user) return res.status(401).json({ message: 'Utilisateur introuvable.' });

    // Invalidation token après changement de mot de passe
    if (user.password_changed_at) {
      // Comparaison à la seconde (précision de iat) pour que le jeton délivré juste après le changement reste valide
      const changedAtSec = Math.floor(new Date(user.password_changed_at).getTime() / 1000);
      if (decoded.iat < changedAtSec) {
        return res.status(401).json({ message: 'Session expirée, veuillez vous reconnecter.' });
      }
    }

    req.user = user;
    next();
  } catch {
    return res.status(401).json({ message: 'Token expiré ou invalide.' });
  }
};

const authorize = (module, requiredAction) => (req, res, next) => {
  if (req.user.is_admin) return next();

  const perms = req.user.permissions ?? [];
  const allowed = perms.some((p) => {
    if (p.module !== module) return false;
    if (requiredAction === 'READ') return p.action === 'READ' || p.action === 'WRITE';
    return p.action === 'WRITE';
  });

  if (!allowed) {
    return res.status(403).json({ message: `Accès refusé : permission ${requiredAction} requise sur le module "${module}".` });
  }
  next();
};

const authorizeAny = (...moduleActions) => (req, res, next) => {
  if (req.user.is_admin) return next();
  const perms = req.user.permissions ?? [];
  const allowed = moduleActions.some(([module, action]) =>
    perms.some((p) => {
      if (p.module !== module) return false;
      if (action === 'READ') return p.action === 'READ' || p.action === 'WRITE';
      return p.action === 'WRITE';
    })
  );
  if (!allowed) return res.status(403).json({ message: 'Accès refusé.' });
  next();
};

// Lecture libre (utilisateur connecté), écriture soumise à la permission WRITE du module
const writeRequires = (module) => (req, res, next) =>
  SAFE_METHODS.includes(req.method) ? next() : authorize(module, 'WRITE')(req, res, next);

module.exports = {
  authenticate, authorize, authorizeAny, writeRequires, requireAjaxHeader, getSessionUserId,
  COOKIE_NAME, cookieOptions,
};
