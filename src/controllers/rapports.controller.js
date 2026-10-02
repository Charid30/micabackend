const { getListe, getApercu, archiver } = require('../services/rapports.service');

exports.getListe = async (req, res) => {
  try {
    const data = await getListe();
    res.json(data);
  } catch (err) {
    console.error('[Rapports] GET liste :', err.message);
    res.status(500).json({ message: err.message || 'Erreur serveur.' });
  }
};

exports.archiver = async (req, res) => {
  try {
    const data = await archiver(parseInt(req.params.id), req.user.id);
    res.json(data);
  } catch (err) {
    console.error('[Rapports] POST archiver :', err.message);
    res.status(400).json({ message: err.message || 'Erreur serveur.' });
  }
};

exports.getApercu = async (req, res) => {
  try {
    const { id } = req.params;
    const data = await getApercu(parseInt(id));
    res.json(data);
  } catch (err) {
    console.error('[Rapports] GET apercu :', err.message);
    res.status(500).json({ message: err.message || 'Erreur serveur.' });
  }
};
