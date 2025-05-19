/**
 * Roteador de estados para o bot WhatsApp
 * Responsável por rotear mensagens com base no estado atual do usuário
 */

const winston = require('winston');
const config = require('../../config/config');
const stateManager = require('./state-manager');

// Importar módulos de funcionalidades
const authModule = require('../modules/auth');
const recognitionModule = require('../modules/recognition');
const vehicleModule = require('../modules/vehicle');
const driverModule = require('../modules/driver');
const userModule = require('../modules/user');
const notificationModule = require('../modules/notification');

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
 * Processa comandos globais disponíveis em qualquer estado
 * @param {Object} client - Cliente WhatsApp
 * @param {Object} message - Mensagem recebida
 * @param {Object} stateData - Dados do estado atual
 * @returns {Promise<boolean>} - true se um comando global foi processado
 */
const processGlobalCommands = async (client, message, stateData) => {
  // Verificar se é uma mensagem de texto
  if (message.type !== 'chat') return false;
  
  const text = message.body.trim().toLowerCase();
  const from = message.from;
  const phoneNumber = from.replace(/@c\.us$/, '');
  
  // Comando #cancelar - volta ao menu anterior ou estado inicial
  if (text === '#cancelar') {
    // Se estiver autenticado, voltar ao menu principal
    if (stateData.context.authenticated) {
      await stateManager.setState(phoneNumber, 'authenticated');
      await authModule.sendMainMenu(client, from, stateData.context.userRole);
    } else {
      // Caso contrário, voltar ao estado inicial
      await stateManager.setState(phoneNumber, 'initial');
      await client.sendText(from, 'Operação cancelada. Digite *Olá* para começar.');
    }
    return true;
  }
  
  // Comando #ajuda - exibe ajuda contextual
  if (text === '#ajuda') {
    let helpMessage = '🔍 *AJUDA* 🔍\n\n';
    
    // Ajuda contextual baseada no estado atual
    switch (stateData.state) {
      case 'initial':
        helpMessage += 'Digite *Olá* para iniciar.\n';
        break;
      case 'authenticating':
        helpMessage += 'Digite seu número de WhatsApp no formato 92XXXXXXXX (apenas números).\n';
        break;
      case 'verifying_code':
        helpMessage += 'Digite o código de 6 dígitos enviado para você.\n';
        helpMessage += 'Use *#reenviar* para solicitar um novo código.\n';
        break;
      case 'authenticated':
        helpMessage += 'Você está no menu principal. Selecione uma opção digitando o número correspondente.\n';
        break;
      case 'recognizing_plate':
        helpMessage += 'Envie uma foto do veículo ou digite a placa manualmente.\n';
        break;
      default:
        helpMessage += 'Digite *#cancelar* para voltar ao menu anterior.\n';
        helpMessage += 'Digite *#menu* para voltar ao menu principal.\n';
        helpMessage += 'Digite *#sair* para fazer logout.\n';
    }
    
    // Comandos globais disponíveis em qualquer estado
    helpMessage += '\n*Comandos globais:*\n';
    helpMessage += '• *#cancelar* - Cancela a operação atual\n';
    helpMessage += '• *#ajuda* - Exibe esta mensagem de ajuda\n';
    helpMessage += '• *#menu* - Volta ao menu principal (se autenticado)\n';
    helpMessage += '• *#sair* - Faz logout do sistema\n';
    
    await client.sendText(from, helpMessage);
    return true;
  }
  
  // Comando #menu - volta ao menu principal (se autenticado)
  if (text === '#menu') {
    if (stateData.context.authenticated) {
      await stateManager.setState(phoneNumber, 'authenticated');
      await authModule.sendMainMenu(client, from, stateData.context.userRole);
      return true;
    } else {
      await client.sendText(from, 'Você precisa estar autenticado para acessar o menu principal.');
      return true;
    }
  }
  
  // Comando #sair - faz logout
  if (text === '#sair') {
    if (stateData.context.authenticated) {
      // Limpar estado e contexto
      await stateManager.clearState(phoneNumber);
      await client.sendText(from, '✅ Logout realizado com sucesso. Até logo!');
    } else {
      await client.sendText(from, 'Você não está autenticado no sistema.');
    }
    return true;
  }
  
  // Nenhum comando global foi processado
  return false;
};

/**
 * Roteia uma mensagem com base no estado atual do usuário
 * @param {Object} client - Cliente WhatsApp
 * @param {Object} message - Mensagem recebida
 * @param {Object} stateData - Dados do estado atual
 * @returns {Promise<void>}
 */
const routeMessage = async (client, message, stateData) => {
  try {
    const from = message.from;
    const phoneNumber = from.replace(/@c\.us$/, '');
    
    // Processar comandos globais primeiro
    const globalCommandProcessed = await processGlobalCommands(client, message, stateData);
    if (globalCommandProcessed) return;
    
    // Rotear com base no estado atual
    switch (stateData.state) {
      case 'initial':
        // Estado inicial - boas-vindas e início de autenticação
        await authModule.handleInitial(client, message, stateData, stateManager);
        break;
        
      case 'authenticating':
        // Autenticação - solicitação de número de telefone
        await authModule.handleAuthenticating(client, message, stateData, stateManager);
        break;
        
      case 'verifying_code':
        // Verificação de código OTP
        await authModule.handleVerifyingCode(client, message, stateData, stateManager);
        break;
        
      case 'authenticated':
        // Menu principal - seleção de funcionalidade
        await authModule.handleAuthenticated(client, message, stateData, stateManager);
        break;
        
      case 'recognizing_plate':
        // Reconhecimento de placa - envio de foto ou digitação manual
        await recognitionModule.handleRecognizingPlate(client, message, stateData, stateManager);
        break;
        
      case 'plate_recognized':
        // Placa reconhecida - exibição de informações e opções
        await recognitionModule.handlePlateRecognized(client, message, stateData, stateManager);
        break;
        
      case 'plate_action':
        // Ação sobre placa reconhecida - entrada, saída, etc.
        await vehicleModule.handlePlateAction(client, message, stateData, stateManager);
        break;
        
      case 'registering_driver':
        // Cadastro de motorista
        await driverModule.handleRegisteringDriver(client, message, stateData, stateManager);
        break;
        
      case 'registering_vehicle':
        // Cadastro de veículo
        await vehicleModule.handleRegisteringVehicle(client, message, stateData, stateManager);
        break;
        
      case 'managing_users':
        // Gerenciamento de usuários
        await userModule.handleManagingUsers(client, message, stateData, stateManager);
        break;
        
      case 'sending_notification':
        // Envio de notificação
        await notificationModule.handleSendingNotification(client, message, stateData, stateManager);
        break;
        
      default:
        // Estado desconhecido - voltar ao estado inicial
        logger.warn(`Estado desconhecido para ${phoneNumber}: ${stateData.state}`);
        await stateManager.setState(phoneNumber, 'initial');
        await client.sendText(from, 'Desculpe, ocorreu um erro. Por favor, tente novamente.');
        break;
    }
  } catch (error) {
    logger.error(`Erro ao rotear mensagem: ${error.message}`);
    logger.error(error.stack);
    
    // Tentar enviar mensagem de erro para o usuário
    try {
      await client.sendText(message.from, 'Desculpe, ocorreu um erro ao processar sua mensagem. Por favor, tente novamente.');
    } catch (sendError) {
      logger.error(`Erro ao enviar mensagem de erro: ${sendError.message}`);
    }
  }
};

// Exportar funções
module.exports = {
  routeMessage
};
