/**
 * Configuração de modelos de dados para o MongoDB
 * Responsável por configurar índices e validações
 */

const mongoose = require('mongoose');
const User = require('./models/User');
const Driver = require('./models/Driver');
const Vehicle = require('./models/Vehicle');
const ParkingLog = require('./models/ParkingLog');
const RecognitionLog = require('./models/RecognitionLog');
const NotificationLog = require('./models/NotificationLog');
const AuditLog = require('./models/AuditLog');
const AuthCode = require('./models/AuthCode');
const Session = require('./models/Session');

const winston = require('winston');
const config = require('../../config/config');

// Configuração de logs
const logger = winston.createLogger({
  level: config.logging.level || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ level, message, timestamp }) => {
      return `${timestamp} ${level.toUpperCase()}: ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ 
      filename: config.logging.file || 'logs/bot.log'
    })
  ]
});

/**
 * Configura o banco de dados
 * @returns {Promise<void>}
 */
const setupDatabase = async () => {
  try {
    logger.info('Configurando banco de dados...');
    
    // Configurar índices para User
    await User.collection.createIndex({ whatsapp: 1 }, { unique: true });
    await User.collection.createIndex({ fullName: 1 });
    await User.collection.createIndex({ role: 1 });
    await User.collection.createIndex({ active: 1 });
    
    // Configurar índices para Driver
    await Driver.collection.createIndex({ whatsapp: 1 }, { unique: true });
    await Driver.collection.createIndex({ fullName: 1 });
    await Driver.collection.createIndex({ memberStatus: 1 });
    
    // Configurar índices para Vehicle
    await Vehicle.collection.createIndex({ licensePlate: 1 }, { unique: true });
    await Vehicle.collection.createIndex({ driverId: 1 });
    
    // Configurar índices para ParkingLog
    await ParkingLog.collection.createIndex({ vehicleId: 1 });
    await ParkingLog.collection.createIndex({ driverId: 1 });
    await ParkingLog.collection.createIndex({ entryTime: 1 });
    await ParkingLog.collection.createIndex({ exitTime: 1 });
    await ParkingLog.collection.createIndex({ 
      vehicleId: 1, 
      exitTime: 1 
    }, { 
      partialFilterExpression: { exitTime: null } 
    });
    
    // Configurar índices para RecognitionLog
    await RecognitionLog.collection.createIndex({ recognizedPlate: 1 });
    await RecognitionLog.collection.createIndex({ userId: 1 });
    await RecognitionLog.collection.createIndex({ timestamp: 1 });
    
    // Configurar índices para NotificationLog
    await NotificationLog.collection.createIndex({ recipientWhatsapp: 1 });
    await NotificationLog.collection.createIndex({ sentBy: 1 });
    await NotificationLog.collection.createIndex({ sentAt: 1 });
    
    // Configurar índices para AuditLog
    await AuditLog.collection.createIndex({ userId: 1 });
    await AuditLog.collection.createIndex({ action: 1 });
    await AuditLog.collection.createIndex({ timestamp: 1 });
    
    // Configurar índices para AuthCode
    await AuthCode.collection.createIndex({ userId: 1 });
    await AuthCode.collection.createIndex({ code: 1 });
    await AuthCode.collection.createIndex({ expiresAt: 1 });
    
    // Configurar índices para Session
    await Session.collection.createIndex({ userId: 1 });
    await Session.collection.createIndex({ sessionId: 1 }, { unique: true });
    await Session.collection.createIndex({ expiresAt: 1 });
    
    // Verificar se existe um usuário administrador
    const adminCount = await User.countDocuments({ role: 'admin' });
    
    if (adminCount === 0) {
      logger.info('Nenhum administrador encontrado. Criando usuário administrador padrão...');
      
      // Criar usuário administrador padrão
      const admin = await User.create({
        fullName: 'Administrador',
        whatsapp: '92999999999', // Número fictício, deve ser alterado
        role: 'admin',
        active: true,
        createdAt: new Date()
      });
      
      // Gerar código de acesso inicial
      const authService = require('../services/auth-service');
      const authCode = await authService.generateInitialAuthCode(admin._id);
      
      logger.info(`Usuário administrador criado com sucesso. Código de acesso inicial: ${authCode}`);
    }
    
    logger.info('Configuração do banco de dados concluída com sucesso');
  } catch (error) {
    logger.error(`Erro ao configurar banco de dados: ${error.message}`);
    throw error;
  }
};

module.exports = {
  setupDatabase
};
