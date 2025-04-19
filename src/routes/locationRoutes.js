const express = require('express');
const router = express.Router();
const { getLocations } = require('../controllers/locationController');

// Define the GET /locations route
router.get('/locations', getLocations);

module.exports = router;
