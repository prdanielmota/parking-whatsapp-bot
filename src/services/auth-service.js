/**
 * Serviço de autenticação para o bot WhatsApp
 * Responsável por gerenciar autenticação, códigos e sessões
 */

const crypto = require('crypto');
const User = require('../data/models/User');
const AuthCode = require('../data/models/AuthCode');
const Session = require('../data/models/Session');
const winston = require('winston');
const config = require('../config/config');

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
 * Inicia o processo de autenticação
 * @param {string} whatsapp - Número de WhatsApp
 * @returns {Promise<Object>} - Resultado da autenticação
 */
const initiateAuth = async (whatsapp) => {
  try {
    // Buscar usuário pelo WhatsApp
    const user = await User.findOne({ whatsapp, active: true });
    
    if (!user) {
      logger.debug(`Usuário não encontrado ou inativo: ${whatsapp}`);
      return {
        success: false,
        isNewUser: true,
        message: 'Usuário não encontrado ou inativo'
      };
    }
    
    // Gerar código de verificação
    const code = generateVerificationCode();
    
    // Calcular data de expiração
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + config.auth.codeTTL);
    
    // Salvar código no banco de dados
    await AuthCode.findOneAndUpdate(
      { userId: user._id },
      {
        code,
        expiresAt,
        attempts: 0
      },
      { upsert: true, new: true }
    );
    
    logger.debug(`Código de verificação gerado para ${whatsapp}: ${code}`);
    
    return {
      success: true,
      code,
      userId: user._id
    };
  } catch (error) {
    logger.error(`Erro ao iniciar autenticação para ${whatsapp}: ${error.message}`);
    return {
      success: false,
      message: 'Erro ao iniciar autenticação'
    };
  }
};

/**
 * Verifica o código de autenticação
 * @param {string} whatsapp - Número de WhatsApp
 * @param {string} code - Código de verificação
 * @param {string} deviceInfo - Informações do dispositivo
 * @returns {Promise<Object>} - Resultado da verificação
 */
const verifyCode = async (whatsapp, code, deviceInfo) => {
  try {
    // Buscar usuário pelo WhatsApp
    const user = await User.findOne({ whatsapp, active: true });
    
    if (!user) {
      logger.debug(`Usuário não encontrado ou inativo: ${whatsapp}`);
      return {
        success: false,
        message: 'Usuário não encontrado ou inativo'
      };
    }
    
    // Buscar código de autenticação
    const authCode = await AuthCode.findOne({ userId: user._id });
    
    if (!authCode) {
      logger.debug(`Código de autenticação não encontrado para ${whatsapp}`);
      return {
        success: false,
        message: 'Código de autenticação não encontrado'
      };
    }
    
    // Verificar se o código expirou
    if (authCode.expiresAt < new Date()) {
      logger.debug(`Código de autenticação expirado para ${whatsapp}`);
      return {
        success: false,
        message: 'Código de autenticação expirado'
      };
    }
    
    // Verificar número de tentativas
    if (authCode.attempts >= config.auth.maxCodeAttempts) {
      logger.debug(`Número máximo de tentativas excedido para ${whatsapp}`);
      return {
        success: false,
        message: 'Número máximo de tentativas excedido'
      };
    }
    
    // Incrementar tentativas
    authCode.attempts += 1;
    await authCode.save();
    
    // Verificar código
    if (authCode.code !== code) {
      logger.debug(`Código de autenticação inválido para ${whatsapp}`);
      return {
        success: false,
        message: 'Código de autenticação inválido'
      };
    }
    
    // Gerar ID de sessão
    const sessionId = generateSessionId();
    
    // Calcular data de expiração da sessão
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + config.auth.sessionTTL);
    
    // Criar sessão
    await Session.create({
      userId: user._id,
      sessionId,
      deviceInfo,
      expiresAt
    });
    
    // Atualizar último login do usuário
    user.lastLogin = new Date();
    await user.save();
    
    // Remover código de autenticação
    await AuthCode.deleteOne({ _id: authCode._id });
    
    logger.debug(`Autenticação bem-sucedida para ${whatsapp}`);
    
    return {
      success: true,
      user: {
        id: user._id,
        fullName: user.fullName,
        whatsapp: user.whatsapp,
        role: user.role
      },
      sessionId
    };
  } catch (error) {
    logger.error(`Erro ao verificar código para ${whatsapp}: ${error.message}`);
    return {
      success: false,
      message: 'Erro ao verificar código'
    };
  }
};

/**
 * Encerra uma sessão
 * @param {string} sessionId - ID da sessão
 * @returns {Promise<boolean>} - Resultado da operação
 */
const endSession = async (sessionId) => {
  try {
    await Session.deleteOne({ sessionId });
    logger.debug(`Sessão encerrada: ${sessionId}`);
    return true;
  } catch (error) {
    logger.error(`Erro ao encerrar sessão ${sessionId}: ${error.message}`);
    return false;
  }
};

/**
 * Gera um código de verificação inicial para um usuário
 * @param {string} userId - ID do usuário
 * @returns {Promise<string>} - Código de verificação
 */
const generateInitialAuthCode = async (userId) => {
  try {
    // Gerar código de verificação
    const code = generateVerificationCode();
    
    // Calcular data de expiração
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + config.auth.codeTTL);
    
    // Salvar código no banco de dados
    await AuthCode.findOneAndUpdate(
      { userId },
      {
        code,
        expiresAt,
        attempts: 0
      },
      { upsert: true, new: true }
    );
    
    logger.debug(`Código de verificação inicial gerado para ${userId}: ${code}`);
    
    return code;
  } catch (error) {
    logger.error(`Erro ao gerar código inicial para ${userId}: ${error.message}`);
    throw error;
  }
};

/**
 * Gera um código de verificação aleatório
 * @returns {string} - Código de verificação
 */
const generateVerificationCode = () => {
  // Gerar código de 6 dígitos
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Gera um ID de sessão aleatório
 * @returns {string} - ID de sessão
 */
const generateSessionId = () => {
  return crypto.randomBytes(32).toString('hex');
};

module.exports = {
  initiateAuth,
  verifyCode,
  endSession,
  generateInitialAuthCode
};
