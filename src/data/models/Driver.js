/**
 * Modelo de motorista para o MongoDB
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const DriverSchema = new Schema({
  fullName: {
    type: String,
    required: true,
    trim: true
  },
  whatsapp: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  memberStatus: {
    type: String,
    enum: ['member', 'visitor'],
    default: 'visitor'
  },
  notifyOnEntry: {
    type: Boolean,
    default: false
  },
  notifyOnExit: {
    type: Boolean,
    default: false
  },
  registeredBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  registrationDate: {
    type: Date,
    default: Date.now
  },
  notes: {
    type: String,
    trim: true
  }
});

module.exports = mongoose.model('Driver', DriverSchema);
