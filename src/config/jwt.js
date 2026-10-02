require('dotenv').config();

const secret = process.env.JWT_SECRET;
if (!secret || secret.length < 32 || secret === 'votre_secret_jwt_tres_long_et_securise') {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be set to a strong secret in production.');
  }
  console.warn('[SECURITY] JWT_SECRET non défini ou valeur par défaut — À CHANGER avant la mise en production.');
}

module.exports = {
  secret: secret || 'mica_dev_secret_change_in_prod',
  expiresIn: process.env.JWT_EXPIRES_IN || '8h',
};
