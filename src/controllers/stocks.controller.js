const stocksService = require('../services/stocks.service');
const { sendError } = require('../utils/http-error');

exports.getSaisieData = async (req, res) => {
  try {
    const data = await stocksService.getSaisieData(req.user.id);
    res.json(data);
  } catch (err) {
    console.error('[Stocks] GET :', err.message);
    sendError(res, err);
  }
};

exports.saveSaisie = async (req, res) => {
  try {
    const { rapport_id, depots } = req.body;
    if (!rapport_id || !Array.isArray(depots)) {
      return res.status(400).json({ message: 'Données invalides.' });
    }
    const perms = req.user.permissions ?? [];
    const canWriteImpompable = req.user.is_admin || perms.some(p => p.module === 'impompable' && p.action === 'WRITE');
    const canWriteStocks     = req.user.is_admin || perms.some(p => p.module === 'stocks'     && p.action === 'WRITE');
    const result = await stocksService.saveSaisie(rapport_id, depots, req.user.id, { canWriteImpompable, canWriteStocks });
    res.json(result);
  } catch (err) {
    console.error('[Stocks] POST :', err.message);
    sendError(res, err, 400);
  }
};
