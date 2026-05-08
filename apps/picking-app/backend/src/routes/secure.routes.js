const express = require('express');
const { getSecurePing } = require('../controllers/health.controller');
const { getDatabasesStatus } = require('../controllers/database.controller');

const router = express.Router();

router.get('/ping', getSecurePing);
router.get('/databases/status', getDatabasesStatus);

module.exports = router;
