/**
 * Gerenciador de estados para o bot WhatsApp
 * Responsável por gerenciar os estados de conversação dos usuários
 */

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

// Armazenamento em memória para estados (em produção, usar Redis ou MongoDB)
const states = new Map();

/**
 * Obtém o estado atual de um usuário
 * @param {string} phoneNumber - Número de telefone do usuário
 * @returns {Promise<Object>} - Estado atual
 */
const getState = async (phoneNumber) => {
  try {
    return states.get(phoneNumber) || null;
  } catch (error) {
    logger.error(`Erro ao obter estado para ${phoneNumber}: ${error.message}`);
    return null;
  }
};

/**
 * Define o estado de um usuário
 * @param {string} phoneNumber - Número de telefone do usuário
 * @param {string} state - Novo estado
 * @returns {Promise<boolean>} - Resultado da operação
 */
const setState = async (phoneNumber, state) => {
  try {
    // Obter estado atual
    const currentState = states.get(phoneNumber) || { context: {} };
    
    // Atualizar estado
    states.set(phoneNumber, {
      state,
      context: currentState.context,
      updatedAt: new Date()
    });
    
    logger.debug(`Estado atualizado para ${phoneNumber}: ${state}`);
    
    return true;
  } catch (error) {
    logger.error(`Erro ao definir estado para ${phoneNumber}: ${error.message}`);
    return false;
  }
};

/**
 * Atualiza o contexto de um usuário
 * @param {string} phoneNumber - Número de telefone do usuário
 * @param {Object} contextData - Dados de contexto
 * @returns {Promise<boolean>} - Resultado da operação
 */
const updateContext = async (phoneNumber, contextData) => {
  try {
    // Obter estado atual
    const currentState = states.get(phoneNumber);
    
    if (!currentState) {
      logger.warn(`Tentativa de atualizar contexto para usuário sem estado: ${phoneNumber}`);
      return false;
    }
    
    // Atualizar contexto
    states.set(phoneNumber, {
      state: currentState.state,
      context: { ...currentState.context, ...contextData },
      updatedAt: new Date()
    });
    
    logger.debug(`Contexto atualizado para ${phoneNumber}`);
    
    return true;
  } catch (error) {
    logger.error(`Erro ao atualizar contexto para ${phoneNumber}: ${error.message}`);
    return false;
  }
};

/**
 * Limpa o estado de um usuário
 * @param {string} phoneNumber - Número de telefone do usuário
 * @returns {Promise<boolean>} - Resultado da operação
 */
const clearState = async (phoneNumber) => {
  try {
    states.delete(phoneNumber);
    
    logger.debug(`Estado limpo para ${phoneNumber}`);
    
    return true;
  } catch (error) {
    logger.error(`Erro ao limpar estado para ${phoneNumber}: ${error.message}`);
    return false;
  }
};

// Exportar funções
module.exports = {
  getState,
  setState,
  updateContext,
  clearState
};
