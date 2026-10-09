const express = require('express');
const router = express.Router();
const { authorizeAny } = require('../middleware/auth');
const svc = require('../services/historique.service');

const parse = (req) => Math.min(Math.max(parseInt(req.query.semaines) || 12, 4), 52);

// Accessible à tout utilisateur ayant au moins une permission READ sur l'un de ces modules
const anyRead = authorizeAny(
  ['stocks', 'READ'], ['corridors', 'READ'], ['tresorerie', 'READ'],
  ['ventes', 'READ'], ['recommandations', 'READ'], ['caf_moyen', 'READ']
);

router.get('/stocks',     anyRead, async (req, res) => { try { res.json(await svc.getStocks(parse(req)));     } catch (e) { res.status(500).json({ message: e.message }); } });
router.get('/corridors',  anyRead, async (req, res) => { try { res.json(await svc.getCorridors(parse(req)));  } catch (e) { res.status(500).json({ message: e.message }); } });
router.get('/tresorerie', anyRead, async (req, res) => { try { res.json(await svc.getTresorerie(parse(req))); } catch (e) { res.status(500).json({ message: e.message }); } });
router.get('/ventes',     anyRead, async (req, res) => { try { res.json(await svc.getVentes(parse(req)));     } catch (e) { res.status(500).json({ message: e.message }); } });

module.exports = router;
