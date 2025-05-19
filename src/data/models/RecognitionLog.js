/**
 * Modelo de registro de reconhecimento de placas para o MongoDB
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const RecognitionLogSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  recognizedPlate: {
    type: String,
    required: true,
    trim: true,
    uppercase: true
  },
  confidence: {
    type: Number,
    default: 0
  },
  vehicleId: {
    type: Schema.Types.ObjectId,
    ref: 'Vehicle'
  },
  isRegistered: {
    type: Boolean,
    default: false
  },
  imageUrl: {
    type: String,
    trim: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  processingTimeMs: {
    type: Number
  }
});

module.exports = mongoose.model('RecognitionLog', RecognitionLogSchema);
