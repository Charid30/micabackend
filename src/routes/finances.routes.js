const express = require('express');
const router = express.Router();

// TODO: implémenter les routes pour finances
router.get('/', (req, res) => res.json({ message: 'Route finances OK', data: [] }));

module.exports = router;
