/**
 * Manipulador de mensagens para o bot WhatsApp
 * Responsável por rotear mensagens para os módulos apropriados
 */

const winston = require('winston');
const config = require('../../config/config');
const stateManager = require('./state-manager');
const authModule = require('../modules/auth');
const vehicleModule = require('../modules/vehicle');
const driverModule = require('../modules/driver');
const notificationModule = require('../modules/notification');
const userModule = require('../modules/user');

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
 * Configura o manipulador de mensagens
 * @param {Object} client - Cliente WhatsApp
 */
const setupMessageHandler = (client) => {
  client.onMessage(async (message) => {
    try {
      // Ignorar mensagens de grupos
      if (message.isGroupMsg) {
        return;
      }
      
      // Obter número de telefone
      const from = message.from;
      const phoneNumber = from.replace(/@c\.us$/, '');
      
      logger.debug(`Mensagem recebida de ${phoneNumber}: ${message.body}`);
      
      // Verificar comandos globais
      if (message.body === '#cancelar' || message.body === '#cancel') {
        await handleCancelCommand(client, message);
        return;
      }
      
      // Obter estado atual
      const stateData = await stateManager.getState(phoneNumber);
      
      // Verificar se é um novo usuário
      if (!stateData || !stateData.state) {
        await handleNewUser(client, message);
        return;
      }
      
      // Rotear mensagem com base no estado
      await routeMessage(client, message, stateData);
      
    } catch (error) {
      logger.error(`Erro ao processar mensagem: ${error.message}`);
      
      // Enviar mensagem de erro genérica
      await client.sendText(message.from, 
        '❌ Ocorreu um erro ao processar sua solicitação. Por favor, tente novamente ou digite *#cancelar* para voltar ao menu principal.'
      );
    }
  });
};

/**
 * Manipula comando de cancelamento
 * @param {Object} client - Cliente WhatsApp
 * @param {Object} message - Mensagem recebida
 * @returns {Promise<void>}
 */
const handleCancelCommand = async (client, message) => {
  const from = message.from;
  const phoneNumber = from.replace(/@c\.us$/, '');
  
  // Obter estado atual
  const stateData = await stateManager.getState(phoneNumber);
  
  // Verificar se o usuário está autenticado
  if (stateData && stateData.state === 'authenticated') {
    // Enviar menu principal
    await authModule.sendMainMenu(client, from, stateData.context.userRole);
  } else {
    // Resetar estado
    await stateManager.setState(phoneNumber, 'initial');
    
    // Enviar mensagem de boas-vindas
    await client.sendText(from, 
      '👋 *Bem-vindo ao Sistema de Estacionamento da Comunidade Ser* 👋\n\n' +
      'Para acessar o sistema, por favor, envie seu número de WhatsApp (o mesmo que está cadastrado no sistema).'
    );
  }
};

/**
 * Manipula novo usuário
 * @param {Object} client - Cliente WhatsApp
 * @param {Object} message - Mensagem recebida
 * @returns {Promise<void>}
 */
const handleNewUser = async (client, message) => {
  const from = message.from;
  const phoneNumber = from.replace(/@c\.us$/, '');
  
  // Definir estado inicial
  await stateManager.setState(phoneNumber, 'initial');
  
  // Enviar mensagem de boas-vindas
  await client.sendText(from, 
    '👋 *Bem-vindo ao Sistema de Estacionamento da Comunidade Ser* 👋\n\n' +
    'Para acessar o sistema, por favor, envie seu número de WhatsApp (o mesmo que está cadastrado no sistema).'
  );
};

/**
 * Roteia mensagem com base no estado
 * @param {Object} client - Cliente WhatsApp
 * @param {Object} message - Mensagem recebida
 * @param {Object} stateData - Dados do estado atual
 * @returns {Promise<void>}
 */
const routeMessage = async (client, message, stateData) => {
  const state = stateData.state;
  
  switch (state) {
    case 'initial':
      // Iniciar autenticação
      await authModule.handleInitialState(client, message, stateData, stateManager);
      break;
      
    case 'awaiting_code':
      // Verificar código de autenticação
      await authModule.handleAwaitingCode(client, message, stateData, stateManager);
      break;
      
    case 'authenticated':
      // Processar comando no menu principal
      await authModule.handleAuthenticated(client, message, stateData, stateManager);
      break;
      
    case 'recognizing_plate':
      // Processar reconhecimento de placa
      await vehicleModule.handlePlateRecognition(client, message, stateData, stateManager);
      break;
      
    case 'plate_action':
      // Processar ação sobre placa reconhecida
      await vehicleModule.handlePlateAction(client, message, stateData, stateManager);
      break;
      
    case 'registering_vehicle':
      // Processar cadastro de veículo
      await vehicleModule.handleRegisteringVehicle(client, message, stateData, stateManager);
      break;
      
    case 'registering_driver':
      // Processar cadastro de motorista
      await driverModule.handleRegisteringDriver(client, message, stateData, stateManager);
      break;
      
    case 'sending_notification':
      // Processar envio de notificação
      await notificationModule.handleSendingNotification(client, message, stateData, stateManager);
      break;
      
    case 'managing_users':
      // Processar gerenciamento de usuários
      await userModule.handleManagingUsers(client, message, stateData, stateManager);
      break;
      
    default:
      // Estado desconhecido, voltar ao estado inicial
      logger.warn(`Estado desconhecido: ${state}`);
      await stateManager.setState(message.from.replace(/@c\.us$/, ''), 'initial');
      
      await client.sendText(message.from, 
        '❌ Ocorreu um erro ao processar sua solicitação. Por favor, tente novamente.'
      );
      break;
  }
};

module.exports = {
  setupMessageHandler
};
