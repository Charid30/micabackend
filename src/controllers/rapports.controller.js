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
const { getListe, getApercu, archiver, supprimer } = require('../services/rapports.service');
const { sendError } = require('../utils/http-error');

exports.getListe = async (req, res) => {
  try {
    const data = await getListe();
    res.json(data);
  } catch (err) {
    console.error('[Rapports] GET liste :', err.message);
    sendError(res, err);
  }
};

exports.archiver = async (req, res) => {
  try {
    const data = await archiver(parseInt(req.params.id), req.user.id);
    res.json(data);
  } catch (err) {
    console.error('[Rapports] POST archiver :', err.message);
    sendError(res, err, 400);
  }
};

exports.getApercu = async (req, res) => {
  try {
    const { id } = req.params;
    const data = await getApercu(parseInt(id));
    res.json(data);
  } catch (err) {
    console.error('[Rapports] GET apercu :', err.message);
    sendError(res, err);
  }
};

exports.exportExcel = async (req, res) => {
  try {
    const { buffer, filename } = await require('../services/export-excel.service').exporterRapport(req.params.id);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.send(Buffer.from(buffer));
  } catch (err) {
    console.error('[Rapports] GET export-excel :', err.message);
    sendError(res, err);
  }
};

exports.supprimer = async (req, res) => {
  try {
    res.json(await supprimer(req.params.id, req.user.id));
  } catch (err) {
    console.error('[Rapports] DELETE :', err.message);
    sendError(res, err, 400);
  }
};
