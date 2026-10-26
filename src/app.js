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
// ============================================================
//  API MICA - point d'entree
//  Ordre des protections appliquees a chaque requete :
//   1. CORS limite a l'origine configuree (CORS_ORIGIN), cookies autorises
//   2. Helmet (en-tetes de securite HTTP)
//   3. Limitation de debit : par compte si session valide, par IP sinon
//   4. Anti-CSRF : en-tete X-Requested-With exige sur les ecritures (/api)
//   5. Routes : authentification (cookie HttpOnly) puis permissions par module
//   6. Erreurs : messages techniques jamais renvoyes au client (utils/http-error.js)
// ============================================================
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const { authenticate, requireAjaxHeader, getSessionUserId } = require('./middleware/auth');
const { sendError } = require('./utils/http-error');

const sequelize = require('./config/database');
const routes = require('./routes');
const { startScheduler } = require('./services/scheduler.service');
const { startSauvegardes } = require('./services/sauvegarde.service');
const { journaliser, startPurgeJournal } = require('./services/journal.service');

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
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true, // cookie de session HttpOnly
}));

// ── Helmet (sécurité des headers HTTP)
app.use(helmet());

// ── Rate limiting global (15 min)
//  - agent connecte (session valide) : 1000 requetes PAR COMPTE ; plusieurs agents derriere la meme
//    adresse IP (reseau du bureau) ne partagent plus un quota commun
//  - requete sans session valide (bots, inconnus) : 100 requetes PAR IP, plus strict qu'avant
//  - la connexion garde sa propre limite (10 essais) et le verrouillage de compte (5 echecs)
const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_USER = 1000;
const RATE_LIMIT_ANONYMOUS = 100;
app.use(rateLimit({
  windowMs: RATE_WINDOW_MS,
  limit: (req) => (getSessionUserId(req) ? RATE_LIMIT_USER : RATE_LIMIT_ANONYMOUS),
  // ipKeyGenerator regroupe les adresses IPv6 par bloc : changer d'adresse dans son bloc ne contourne pas la limite
  keyGenerator: (req) => {
    const userId = getSessionUserId(req);
    return userId ? `user:${userId}` : `ip:${ipKeyGenerator(req.ip)}`;
  },
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Trop de requêtes, veuillez réessayer plus tard.' },
}));

app.use(morgan(isProd ? 'combined' : 'dev'));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ── Fichiers statiques (rapports PDF) — protégés par auth
app.use('/storage', authenticate, express.static(path.join(__dirname, '..', 'storage')));

// ── Routes API (protection CSRF : en-tête X-Requested-With exigé sur les requêtes d'écriture)
// Journal d'audit : chaque action d'ecriture est enregistree a la fin de la reponse
app.use('/api', requireAjaxHeader, journaliser, routes);

// ── Route santé (interne uniquement, pas d'info sensible)
app.get('/health', (req, res) => res.json({ status: 'OK' }));

// ── Erreurs globales : ne pas exposer le détail en production
app.use((err, req, res, next) => {
  // Erreurs du parseur JSON / taille de requête : message neutre
  if (err.expose && err.status >= 400 && err.status < 500) {
    return res.status(err.status).json({ message: 'Requête invalide.' });
  }
  sendError(res, err);
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
    await startSauvegardes();
    startPurgeJournal();

    app.listen(PORT, () => {
      console.log(`Serveur démarré sur http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Erreur de démarrage :', err.message);
    process.exit(1);
  }
};

start();
