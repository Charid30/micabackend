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
const { authorizeAny } = require('../middleware/auth');
const svc = require('../services/historique.service');
const { sendError } = require('../utils/http-error');

const parse = (req) => Math.min(Math.max(parseInt(req.query.semaines) || 12, 4), 52);

// Accessible à tout utilisateur ayant au moins une permission READ sur l'un de ces modules
const anyRead = authorizeAny(
  ['stocks', 'READ'], ['corridors', 'READ'], ['tresorerie', 'READ'],
  ['ventes', 'READ'], ['recommandations', 'READ'], ['caf_moyen', 'READ']
);

router.get('/stocks',     anyRead, async (req, res) => { try { res.json(await svc.getStocks(parse(req)));     } catch (e) { sendError(res, e); } });
router.get('/corridors',  anyRead, async (req, res) => { try { res.json(await svc.getCorridors(parse(req)));  } catch (e) { sendError(res, e); } });
router.get('/tresorerie', anyRead, async (req, res) => { try { res.json(await svc.getTresorerie(parse(req))); } catch (e) { sendError(res, e); } });
router.get('/ventes',     anyRead, async (req, res) => { try { res.json(await svc.getVentes(parse(req)));     } catch (e) { sendError(res, e); } });

module.exports = router;
