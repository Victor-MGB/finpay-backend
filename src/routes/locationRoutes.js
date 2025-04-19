const express = require('express');
const router = express.Router();
const { getLocations, createLocation } = require('../controllers/locationController');
const {authMiddleware} = require("../middlewares/authMiddleware")

// Define the GET /locations route
router.get('/locations', getLocations);

router.post("/admin/locations", authMiddleware, createLocation)

module.exports = router;
