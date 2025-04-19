const { Location } = require('../models/Users'); // Import your Location model

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
