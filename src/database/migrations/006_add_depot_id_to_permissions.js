const { DataTypes } = require('sequelize');

module.exports = async (sequelize) => {
  const qi = sequelize.getQueryInterface();
  const cols = await qi.describeTable('permissions');
  if (!cols.depot_id) {
    await qi.addColumn('permissions', 'depot_id', {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null,
    });
    console.log('  ✔ permissions.depot_id ajoutée');
  } else {
    console.log('  – permissions.depot_id déjà présente');
  }
};
