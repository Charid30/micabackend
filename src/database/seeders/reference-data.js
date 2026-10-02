require('dotenv').config({ path: require('path').resolve(__dirname, '../../../.env') });
const sequelize = require('../../config/database');
const { Produit, Depot, Corridor, ParametreAlerte } = require('../../models');

async function seedReferenceData() {
  try {
    await sequelize.authenticate();
    console.log('Connexion base de données OK.');

    // ── Produits
    const produits = [
      { code: 'SP',  libelle: 'Super 91',  unite: 'm3' },
      { code: 'PL',  libelle: 'Pétrole',  unite: 'm3' },
      { code: 'GO',  libelle: 'Gasoil',   unite: 'm3' },
      { code: 'DDO', libelle: 'DDO',      unite: 'm3' },
      { code: 'JA1', libelle: 'Jet A1',   unite: 'm3' },
      { code: 'FO',  libelle: 'Fuel Oil', unite: 'm3' },
      { code: 'GAZ', libelle: 'Gaz',      unite: 'kg'  },
    ];

    for (const p of produits) {
      const [row, created] = await Produit.findOrCreate({
        where: { code: p.code },
        defaults: { ...p, created_by: 1 },
      });
      console.log(`Produit ${p.code} : ${created ? 'créé' : 'existant'} (id=${row.id})`);
    }

    // ── Dépôts
    const depots = [
      { code: 'BINGO',  libelle: 'BINGO',          type: 'INTERIEUR', pays: 'Burkina Faso' },
      { code: 'PENI',   libelle: 'PENI',            type: 'INTERIEUR', pays: 'Burkina Faso' },
      { code: 'GHANA',  libelle: 'GHANA',           type: 'EXTERIEUR', pays: 'Ghana'         },
      { code: 'CI',     libelle: "COTE D'IVOIRE",   type: 'EXTERIEUR', pays: "Côte d'Ivoire" },
      { code: 'BENIN',  libelle: 'BENIN',           type: 'EXTERIEUR', pays: 'Bénin'         },
      { code: 'TOGO',   libelle: 'TOGO',            type: 'EXTERIEUR', pays: 'Togo'          },
    ];

    for (const d of depots) {
      const [row, created] = await Depot.findOrCreate({
        where: { code: d.code },
        defaults: { ...d, created_by: 1 },
      });
      console.log(`Dépôt ${d.code} : ${created ? 'créé' : 'existant'} (id=${row.id})`);
    }

    // ── Corridors
    const corridors = [
      { code: 'TEMA',     libelle: 'TEMA (Ghana)'        },
      { code: 'CI',       libelle: "COTE D'IVOIRE"       },
      { code: 'COTONOU',  libelle: 'COTONOU (Bénin)'     },
      { code: 'LOME',     libelle: 'LOME (Togo)'         },
    ];

    for (const c of corridors) {
      const [row, created] = await Corridor.findOrCreate({
        where: { code: c.code },
        defaults: { ...c, created_by: 1 },
      });
      console.log(`Corridor ${c.code} : ${created ? 'créé' : 'existant'} (id=${row.id})`);
    }

    // ── Paramètres alertes (seuil 15j par produit)
    const tousLesProduits = await Produit.findAll({ where: { del: 0 } });
    for (const p of tousLesProduits) {
      const [, created] = await ParametreAlerte.findOrCreate({
        where: { produit_id: p.id },
        defaults: { produit_id: p.id, seuil_jours: 15, actif: 1, created_by: 1 },
      });
      if (created) console.log(`Paramètre alerte créé pour produit ${p.code}`);
    }

    console.log('\n=== Données de référence chargées ===\n');
    process.exit(0);
  } catch (err) {
    console.error('Erreur seed :', err.message);
    process.exit(1);
  }
}

seedReferenceData();
