const jwt = require('jsonwebtoken');
const jwtConfig = require('../config/jwt');
const { Utilisateur, Agent, Permission } = require('../models');

const authenticate = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Token manquant ou invalide.' });
  }
  const token = header.split(' ')[1];
  try {
    const decoded = jwt.verify(token, jwtConfig.secret);
    const user = await Utilisateur.findOne({
      where: { id: decoded.id, del: 0 },
      include: [
        { model: Agent, as: 'agent' },
        { model: Permission, as: 'permissions', required: false },
      ],
    });
    if (!user) return res.status(401).json({ message: 'Utilisateur introuvable.' });
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
    // WRITE implique READ
    if (requiredAction === 'READ') return p.action === 'READ' || p.action === 'WRITE';
    return p.action === 'WRITE';
  });

  if (!allowed) {
    return res.status(403).json({ message: `Accès refusé : permission ${requiredAction} requise sur le module "${module}".` });
  }
  next();
};

// Autorise si l'utilisateur a AU MOINS UNE des paires [module, action]
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

module.exports = { authenticate, authorize, authorizeAny };
