module.exports = {
  name: '003_nullable_niveau_risque_veille_geo',
  description: 'Rend niveau_risque nullable dans veille_geopolitique (aucun niveau obligatoire)',

  async up(sequelize) {
    await sequelize.query(`
      ALTER TABLE veille_geopolitique
        MODIFY COLUMN niveau_risque ENUM('FAIBLE','MOYEN','ELEVE') NULL DEFAULT NULL
    `);
    console.log('  ✓ niveau_risque rendu nullable');
  },
};
