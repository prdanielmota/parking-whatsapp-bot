/**
 * Modelo de log de auditoria para o MongoDB
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const AuditLogSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  userWhatsapp: {
    type: String,
    required: true
  },
  action: {
    type: String,
    required: true
  },
  details: {
    type: Schema.Types.Mixed
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  ipAddress: {
    type: String
  }
});

/**
 * Registra uma ação de auditoria
 * @param {string} userId - ID do usuário
 * @param {string} userWhatsapp - WhatsApp do usuário
 * @param {string} action - Ação realizada
 * @param {Object} details - Detalhes da ação
 * @param {string} ipAddress - Endereço IP
 * @returns {Promise<Object>} - Log de auditoria criado
 */
AuditLogSchema.statics.logAction = async function(userId, userWhatsapp, action, details = {}, ipAddress = null) {
  return this.create({
    userId,
    userWhatsapp,
    action,
    details,
    ipAddress,
    timestamp: new Date()
  });
};

module.exports = mongoose.model('AuditLog', AuditLogSchema);
