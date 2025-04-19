const { Location, AuditLog } = require('../models/Users'); // Import your Location model

// Controller for fetching locations (ATMs or branches)
exports.getLocations = async (req, res) => {
  try {
    const { type, latitude, longitude, radius } = req.query;

    if (!type || !latitude || !longitude || !radius) {
      return res.status(400).json({ message: 'Missing required query parameters: type, latitude, longitude, radius' });
    }

    if (!["atm", "branch"].includes(type)) {
      return res.status(400).json({ message: 'Invalid location type. Use "atm" or "branch".' });
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    const rad = parseFloat(radius);

    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({ message: 'Invalid latitude or longitude.' });
    }

    if (isNaN(rad) || rad <= 0) {
      return res.status(400).json({ message: 'Invalid radius.' });
    }

    const radiusInMeters = rad * 1000;

    const locations = await Location.aggregate([
      {
        $geoNear: {
          near: { type: "Point", coordinates: [lng, lat] }, // Note: [longitude, latitude]
          distanceField: "distance",
          maxDistance: radiusInMeters,
          query: { type },
          spherical: true,
        }
      },
      {
        $project: {
          _id: 1,
          type: 1,
          address: 1,
          latitude: 1,
          longitude: 1,
          services: 1,
          withdrawalLimit: 1
        }
      }
    ]);

    if (locations.length === 0) {
      return res.status(404).json({ message: 'No locations found within the specified range.' });
    }

    return res.status(200).json({ locations });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error.' });
  }
};


exports.createLocation = async (req, res) => {
  try {
    // Check if user is superadmin
    if (!req.user || req.user.role !== 'superadmin') {
      return res.status(403).json({ message: 'Forbidden. Only superadmins can add locations.' });
    }

    const { type, latitude, longitude, address, services, withdrawalLimit } = req.body;

    // Basic validations
    if (!type || !latitude || !longitude || !address) {
      return res.status(400).json({ message: 'Missing required fields: type, latitude, longitude, address.' });
    }

    if (!["atm", "branch"].includes(type)) {
      return res.status(400).json({ message: 'Invalid location type. Use "atm" or "branch".' });
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({ message: 'Invalid latitude or longitude.' });
    }

    const newLocation = new Location({
      type,
      latitude: lat,
      longitude: lng,
      coordinates: [lng, lat], // Geospatial coordinates [longitude, latitude]
      address,
      services: Array.isArray(services) ? services : [],
      withdrawalLimit: type === "atm" ? withdrawalLimit : undefined,
    });

    await newLocation.save();

    // Create Audit Log
    await AuditLog.create({
      performed_by: req.user._id,
      action: `Created a new ${type.toUpperCase()} location.`,
      entity_type: "Location",
      entity_id: newLocation._id,
      details: `Address: ${address}`,
    });

    return res.status(201).json({ locationId: newLocation._id });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error.' });
  }
};