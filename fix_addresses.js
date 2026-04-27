const mongoose = require('mongoose');
const Incident = require('./models/Incident');
const GeocodingService = require('./services/geocodingService');
require('dotenv').config();

const fixAddresses = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/incident_reporting');
    console.log('Connected to MongoDB');

    const incidents = await Incident.find({
      $or: [
        { 'location.address': { $regex: /^-?\d+(\.\d+)?,\s*-?\d+(\.\d+)?$/ } },
        { 'location.address': 'Address resolving...' },
        { 'location.address': 'Unknown Location' },
        { 'location.address': null }
      ]
    });

    console.log(`Found ${incidents.length} incidents to fix`);

    for (const incident of incidents) {
      if (incident.location && incident.location.coordinates && incident.location.coordinates.length === 2) {
        const [lng, lat] = incident.location.coordinates;
        console.log(`Fixing incident ${incident._id} at ${lat}, ${lng}`);
        const address = await GeocodingService.getAddressFromCoordinates(lat, lng);
        if (address && !address.includes(',')) {
            // If it's still coordinates or just one word, try again or use display_name
            console.log(`Address resolved to: ${address}`);
        }
        incident.location.address = address || incident.location.address;
        await incident.save();
        // Wait a bit to respect Nominatim rate limits (1 request per second)
        await new Promise(resolve => setTimeout(resolve, 1100));
      }
    }

    console.log('Finished fixing addresses');
    process.exit(0);
  } catch (error) {
    console.error('Error fixing addresses:', error);
    process.exit(1);
  }
};

fixAddresses();
