require('dotenv').config({ path: require('path').resolve(__dirname, '../../../.env') });
const bcrypt = require('bcryptjs');
const sequelize = require('../../config/database');
const { Entreprise, Direction, Agent, Utilisateur } = require('../../models');

async function seed() {
  try {
    await sequelize.authenticate();
    console.log('Connexion base de données OK.');

    // 1. Entreprise SONABHY
    const [sonabhy] = await Entreprise.findOrCreate({
      where: { acronyme: 'SONABHY' },
      defaults: {
        nom: 'Société Nationale Burkinabé d\'Hydrocarbures',
        acronyme: 'SONABHY',
        description: 'Gestion nationale des hydrocarbures au Burkina Faso',
        created_by: 1,
      },
    });
    console.log(`Entreprise SONABHY : id=${sonabhy.id}`);

    // 2. Direction SI (système d'information)
    const [direction] = await Direction.findOrCreate({
      where: { acronyme: 'DSI', entreprise_id: sonabhy.id },
      defaults: {
        entreprise_id: sonabhy.id,
        acronyme: 'DSI',
        description: 'Direction des Systèmes d\'Information',
        created_by: 1,
      },
    });
    console.log(`Direction DSI : id=${direction.id}`);

    // 3. Agent admin
    const [agent] = await Agent.findOrCreate({
      where: { matricule: 'ADMIN-001' },
      defaults: {
        direction_id: direction.id,
        matricule: 'ADMIN-001',
        nom: 'Administrateur',
        prenoms: 'Système',
        created_by: 1,
      },
    });
    console.log(`Agent admin : id=${agent.id}`);

    // 4. Utilisateur admin
    const hash = await bcrypt.hash('P@ssw0rd', 10);
    const [user, created] = await Utilisateur.findOrCreate({
      where: { username: 'admin' },
      defaults: {
        agent_id: agent.id,
        username: 'admin',
        email: 'admin@sonabhy.bf',
        password: hash,
        is_admin: 1,
        created_by: 1,
      },
    });

    if (created) {
      console.log('Utilisateur admin créé avec succès.');
    } else {
      // Met à jour le mot de passe si l'utilisateur existait déjà
      await user.update({ password: hash, is_admin: 1, updated_by: user.id });
      console.log('Utilisateur admin existant : mot de passe réinitialisé.');
    }

    console.log('\n=== Seed terminé ===');
    console.log(`  username : admin`);
    console.log(`  email    : admin@sonabhy.bf`);
    console.log(`  password : P@ssw0rd`);
    console.log('====================\n');

    process.exit(0);
  } catch (err) {
    console.error('Erreur seed :', err.message);
    process.exit(1);
  }
}

seed();
