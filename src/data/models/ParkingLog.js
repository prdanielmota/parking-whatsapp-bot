/**
 * Modelo de registro de estacionamento para o MongoDB
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ParkingLogSchema = new Schema({
  vehicleId: {
    type: Schema.Types.ObjectId,
    ref: 'Vehicle',
    required: true
  },
  driverId: {
    type: Schema.Types.ObjectId,
    ref: 'Driver',
    required: true
  },
  entryTime: {
    type: Date,
    required: true
  },
  exitTime: {
    type: Date,
    default: null
  },
  registeredBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  exitRegisteredBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  notes: {
    type: String,
    trim: true
  }
});

module.exports = mongoose.model('ParkingLog', ParkingLogSchema);
