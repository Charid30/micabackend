/* ==================================================================
 *  Auteur : BATIONO Ulrich Rachid Kévin
 *           Expert en Sécurité Informatique
 *           Développeur FullStack
 *           Tel: +226 51 57 82 89 // 66 72 02 32
 *           Whatsapp: +226 51 57 82 89
 *           Mail: bkevin@sonabhy.bf // bationor10@gmail.com
 *  Projet : MICA – SONABHY
 * ================================================================== */
const stocksService = require('../services/stocks.service');
const { sendError } = require('../utils/http-error');

// Droits d'ecriture de l'utilisateur sur l'ecran Stocks
//  - stocks         : quantites du jour (stock en bacs, stock en embranchement)
//  - actions-stocks : actions entreprises pour relever le niveau des stocks (DSTA)
const droitsDe = (user) => {
  const perms = user.permissions ?? [];
  const peut = (module) => user.is_admin || perms.some(p => p.module === module && p.action === 'WRITE');
  return { stocks: peut('stocks'), actions: peut('actions-stocks') };
};

exports.getSaisieData = async (req, res) => {
  try {
    res.json(await stocksService.getSaisieData(req.user, droitsDe(req.user)));
  } catch (err) {
    sendError(res, err);
  }
};

exports.saveSaisie = async (req, res) => {
  try {
    const { rapport_id, lignes } = req.body;
    res.json(await stocksService.saveSaisie(rapport_id, lignes, req.user, droitsDe(req.user)));
  } catch (err) {
    sendError(res, err, 400);
  }
};
