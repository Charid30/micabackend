/* ==================================================================
 *  Auteur : BATIONO Ulrich Rachid Kévin
 *           Expert en Sécurité Informatique
 *           Développeur FullStack
 *           Tel: +226 51 57 82 89 // 66 72 02 32
 *           Whatsapp: +226 51 57 82 89
 *           Mail: bkevin@sonabhy.bf // bationor10@gmail.com
 *  Projet : MICA – SONABHY
 * ================================================================== */
const { getSaisieData, saveSaisie } = require('../services/achatsTraders.service');
const { sendError } = require('../utils/http-error');

exports.getSemaineCourante = async (req, res) => {
  try {
    const data = await getSaisieData();
    res.json(data);
  } catch (err) {
    console.error('[AchatsTraders] GET :', err.message);
    sendError(res, err);
  }
};

exports.postSaisie = async (req, res) => {
  try {
    const { achats, supprimes } = req.body;
    if (!Array.isArray(achats) || (supprimes !== undefined && !Array.isArray(supprimes))) {
      return res.status(400).json({ message: 'achats[] requis.' });
    }
    const result = await saveSaisie(achats, (supprimes || []).map(Number), req.user.id);
    res.json(result);
  } catch (err) {
    console.error('[AchatsTraders] POST :', err.message);
    sendError(res, err);
  }
};
