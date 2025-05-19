/**
 * Modelo de registro de notificações para o MongoDB
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const NotificationLogSchema = new Schema({
  recipientWhatsapp: {
    type: String,
    required: true,
    trim: true
  },
  message: {
    type: String,
    required: true
  },
  notificationType: {
    type: String,
    enum: ['individual', 'all_members', 'all_visitors'],
    required: true
  },
  sentBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  sentAt: {
    type: Date,
    default: Date.now
  },
  success: {
    type: Boolean,
    default: true
  },
  errorMessage: {
    type: String
  }
});

module.exports = mongoose.model('NotificationLog', NotificationLogSchema);
