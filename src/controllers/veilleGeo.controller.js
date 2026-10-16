/* ==================================================================
 *  Auteur : BATIONO Ulrich Rachid Kévin
 *           Expert en Sécurité Informatique
 *           Développeur FullStack
 *           Tel: +226 51 57 82 89 // 66 72 02 32
 *           Whatsapp: +226 51 57 82 89
 *           Mail: bkevin@sonabhy.bf // bationor10@gmail.com
 *  Projet : MICA – SONABHY
 * ================================================================== */
const veilleGeoService = require('../services/veilleGeo.service');
const { sendError } = require('../utils/http-error');

exports.getSaisieData = async (req, res) => {
  try {
    const data = await veilleGeoService.getSaisieData(req.user.id);
    res.json(data);
  } catch (err) {
    console.error('[VeilleGeo] GET :', err.message);
    sendError(res, err);
  }
};

exports.saveSaisie = async (req, res) => {
  try {
    const { rapport_id, zones } = req.body;
    if (!rapport_id || !Array.isArray(zones)) {
      return res.status(400).json({ message: 'Données invalides.' });
    }
    const result = await veilleGeoService.saveSaisie(rapport_id, zones, req.user.id);
    res.json(result);
  } catch (err) {
    console.error('[VeilleGeo] POST :', err.message);
    sendError(res, err, 400);
  }
};
