const { getListe, getApercu, archiver } = require('../services/rapports.service');
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
