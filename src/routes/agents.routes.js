const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/agents.controller');
const { authorize } = require('../middleware/auth');
const v = require('../middleware/validate');

// Structures : lecture et écriture réservées au module administration
router.use((req, res, next) =>
  authorize('administration', ['GET', 'HEAD'].includes(req.method) ? 'READ' : 'WRITE')(req, res, next));

router.get('/', ctrl.getAll);
router.get('/:id', v.idParam, ctrl.getById);
router.post('/', v.agent(false), ctrl.create);
router.put('/:id', v.agent(true), ctrl.update);
router.delete('/:id', v.idParam, ctrl.remove);

module.exports = router;
