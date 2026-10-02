const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/directions.controller');

router.get('/', ctrl.getAll);
router.get('/entreprise/:entrepriseId', ctrl.getByEntreprise);
router.post('/', ctrl.create);
router.put('/:id', ctrl.update);
router.delete('/:id', ctrl.remove);

module.exports = router;
