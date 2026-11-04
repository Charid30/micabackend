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
// Hachage des mots de passe et des codes de secours : un seul cout pour toute l'application.
// Les empreintes existantes (cout 10) restent valides : bcrypt lit le cout dans l'empreinte.
const bcrypt = require('bcryptjs');

const COUT = 12;

const hacher = (valeur) => bcrypt.hash(valeur, COUT);
const hacherSync = (valeur) => bcrypt.hashSync(valeur, COUT);

module.exports = { COUT, hacher, hacherSync };
