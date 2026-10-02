const authService = require('../services/auth.service');

exports.login = async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: 'Identifiant et mot de passe requis.' });
  }
  // Limite la taille des inputs pour éviter les attaques par charge
  if (typeof username !== 'string' || username.length > 100 ||
      typeof password !== 'string' || password.length > 200) {
    return res.status(400).json({ message: 'Données invalides.' });
  }
  try {
    const result = await authService.login(username.trim(), password);
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || 'Erreur serveur.' });
  }
};

exports.me = async (req, res) => {
  try {
    const user = await authService.getMe(req.user.id);
    res.json({ utilisateur: user });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || 'Erreur serveur.' });
  }
};

exports.changePassword = async (req, res) => {
  const { ancienMotDePasse, nouveauMotDePasse } = req.body;
  if (!ancienMotDePasse || !nouveauMotDePasse) {
    return res.status(400).json({ message: 'Les deux mots de passe sont requis.' });
  }
  try {
    await authService.changePassword(req.user.id, ancienMotDePasse, nouveauMotDePasse);
    res.json({ message: 'Mot de passe modifié avec succès.' });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || 'Erreur serveur.' });
  }
};
