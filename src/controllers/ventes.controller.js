/* ==================================================================
 *  Auteur : BATIONO Ulrich Rachid Kévin
 *           Expert en Sécurité Informatique
 *           Développeur FullStack
 *           Tel: +226 51 57 82 89 // 66 72 02 32
 *           Whatsapp: +226 51 57 82 89
 *           Mail: bkevin@sonabhy.bf // bationor10@gmail.com
 *  Projet : MICA – SONABHY
 * ================================================================== */
const { getSaisieData, saveSaisie } = require('../services/ventes.service');
const { sendError } = require('../utils/http-error');

exports.getSemaineCourante = async (req, res) => {
  try {
    const data = await getSaisieData(req.user.id);
    res.json(data);
  } catch (err) {
    console.error('[Ventes] GET :', err.message);
    sendError(res, err);
  }
};

exports.postSaisie = async (req, res) => {
  try {
    const { rapport_id, ventes } = req.body;
    if (!rapport_id || !Array.isArray(ventes)) {
      return res.status(400).json({ message: 'rapport_id et ventes[] requis.' });
    }
    const result = await saveSaisie(rapport_id, ventes, req.user.id);
    res.json(result);
  } catch (err) {
    console.error('[Ventes] POST :', err.message);
    sendError(res, err);
  }
};
