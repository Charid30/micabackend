// Réponse d'erreur uniforme : seuls les messages métier sont renvoyés au client.
// Les erreurs techniques (SQL, bugs JS…) sont journalisées côté serveur et masquées.

const GENERIC_MESSAGE = 'Erreur interne du serveur.';

// Erreur métier = levée volontairement par notre code :
//   throw { status, message }  ou  throw new Error('message lisible')
const isBusinessError = (err) => {
  if (!err || typeof err.message !== 'string') return false;
  if (Object.getPrototypeOf(err) === Object.prototype) return true;
  return Object.getPrototypeOf(err) === Error.prototype && err.name === 'Error';
};

const sendError = (res, err, fallbackStatus = 500) => {
  if (err?.name === 'SequelizeUniqueConstraintError') {
    return res.status(409).json({ message: 'Cette valeur existe déjà.' });
  }
  if (err?.name === 'SequelizeValidationError' || err?.name === 'SequelizeForeignKeyConstraintError') {
    return res.status(400).json({ message: 'Données invalides.' });
  }
  if (isBusinessError(err)) {
    return res.status(err.status || fallbackStatus).json({ message: err.message });
  }
  console.error('[Erreur serveur]', err);
  return res.status(500).json({ message: GENERIC_MESSAGE });
};

module.exports = { sendError, GENERIC_MESSAGE };
