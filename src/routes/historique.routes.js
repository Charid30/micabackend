const express = require('express');
const router = express.Router();
const svc = require('../services/historique.service');

const parse = (req) => Math.min(Math.max(parseInt(req.query.semaines) || 12, 4), 52);

router.get('/stocks',      async (req, res) => { try { res.json(await svc.getStocks(parse(req)));      } catch (e) { res.status(500).json({ message: e.message }); } });
router.get('/corridors',   async (req, res) => { try { res.json(await svc.getCorridors(parse(req)));   } catch (e) { res.status(500).json({ message: e.message }); } });
router.get('/tresorerie',  async (req, res) => { try { res.json(await svc.getTresorerie(parse(req)));  } catch (e) { res.status(500).json({ message: e.message }); } });
router.get('/ventes',      async (req, res) => { try { res.json(await svc.getVentes(parse(req)));      } catch (e) { res.status(500).json({ message: e.message }); } });

module.exports = router;
