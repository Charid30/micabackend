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
const camionsService = require('../services/camions.service');
const { sendError } = require('../utils/http-error');

exports.getAnalyseMensuelle = async (req, res) => {
  try {
    const annee = parseInt(req.query.annee) || new Date().getFullYear();
    const data = await camionsService.getAnalyseMensuelle(annee);
    res.json(data);
  } catch (err) {
    console.error('[Camions] Analyse mensuelle :', err.message);
    sendError(res, err);
  }
};

exports.getSaisieData = async (req, res) => {
  try {
    const data = await camionsService.getSaisieData(req.user.id);
    res.json(data);
  } catch (err) {
    console.error('[Camions] GET :', err.message);
    sendError(res, err);
  }
};

exports.saveSaisie = async (req, res) => {
  try {
    const { rapport_id, sections } = req.body;
    if (!rapport_id || !Array.isArray(sections)) {
      return res.status(400).json({ message: 'Données invalides.' });
    }
    const result = await camionsService.saveSaisie(rapport_id, sections, req.user.id);
    res.json(result);
  } catch (err) {
    console.error('[Camions] POST :', err.message);
    sendError(res, err, 400);
  }
};
