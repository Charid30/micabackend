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
// Deblocage sur le serveur, quand l'administrateur est lui-meme banni et ne peut plus ouvrir l'ecran
// Detection d'intrusion (l'API en cours d'execution le prend en compte en 30 secondes au plus) :
//   npm run debannir -- liste
//   npm run debannir -- 41.203.10.5
//   npm run debannir -- compte kevin
//   npm run debannir -- tout
require('dotenv').config();
const { sequelize, IpBannie, Utilisateur } = require('../src/models');

(async () => {
  sequelize.options.logging = false;
  const [cible, valeur] = process.argv.slice(2);
  const leve = { actif: 0, leve_le: new Date(), leve_par: 'serveur' };
  if (!cible || cible === 'liste') {
    const ips = await IpBannie.findAll({ where: { actif: 1 }, raw: true });
    const comptes = await Utilisateur.findAll({ where: { del: 0 }, attributes: ['username', 'suspendu_le', 'suspendu_motif'], raw: true });
    console.log('Adresses bannies :', ips.length ? '' : 'aucune');
    ips.forEach(b => console.log(`  ${b.ip}  (${b.motif})`));
    const suspendus = comptes.filter(c => c.suspendu_le);
    console.log('Comptes suspendus :', suspendus.length ? '' : 'aucun');
    suspendus.forEach(c => console.log(`  ${c.username}  (${c.suspendu_motif})`));
  } else if (cible === 'tout') {
    const [n] = await IpBannie.update(leve, { where: { actif: 1 } });
    console.log(`${n} adresse(s) débloquée(s).`);
  } else if (cible === 'compte') {
    const [n] = await Utilisateur.update({ suspendu_le: null, suspendu_motif: null }, { where: { username: valeur || '', del: 0 } });
    console.log(n ? `Compte ${valeur} réactivé.` : `Compte ${valeur} introuvable ou non suspendu.`);
  } else {
    const [n] = await IpBannie.update(leve, { where: { ip: cible, actif: 1 } });
    console.log(n ? `Adresse ${cible} débloquée.` : `Adresse ${cible} non bannie.`);
  }
  await sequelize.close();
})().catch(async (e) => { console.error('Erreur :', e.message); await sequelize.close(); process.exit(1); });
