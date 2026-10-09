require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const rateLimit = require('express-rate-limit');
const { authenticate } = require('./middleware/auth');

const sequelize = require('./config/database');
const routes = require('./routes');
const { startScheduler } = require('./services/scheduler.service');

const app = express();
const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === 'production';

// ── Proxy (Apache en front) — nécessaire pour express-rate-limit et req.ip
app.set('trust proxy', 1);

// ── CORS : limité à l'origine configurée (ou localhost en dev)
const allowedOrigin = process.env.CORS_ORIGIN || 'http://localhost:4200';
app.use(cors({
  origin: allowedOrigin,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ── Helmet (sécurité des headers HTTP)
app.use(helmet());

// ── Rate limiting global : 200 req / 15 min par IP
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Trop de requêtes, veuillez réessayer plus tard.' },
}));

app.use(morgan(isProd ? 'combined' : 'dev'));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ── Fichiers statiques (rapports PDF) — protégés par auth
app.use('/storage', authenticate, express.static(path.join(__dirname, '..', 'storage')));

// ── Routes API
app.use('/api', routes);

// ── Route santé (interne uniquement, pas d'info sensible)
app.get('/health', (req, res) => res.json({ status: 'OK' }));

// ── Erreurs globales : ne pas exposer le détail en production
app.use((err, req, res, next) => {
  console.error(err.stack);
  const status = err.status || 500;
  res.status(status).json({
    message: isProd && status === 500 ? 'Erreur interne du serveur.' : (err.message || 'Erreur interne du serveur.'),
  });
});

// ── Démarrage
const start = async () => {
  try {
    await sequelize.authenticate();
    console.log('Connexion base de données établie.');
    // Synchronisation des modèles (ne jamais utiliser force:true en production)
    await sequelize.sync({ alter: false });
    console.log('Modèles synchronisés.');

    await startScheduler();

    app.listen(PORT, () => {
      console.log(`Serveur démarré sur http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Erreur de démarrage :', err.message);
    process.exit(1);
  }
};

start();
