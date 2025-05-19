/**
 * Módulo de autenticação para o bot WhatsApp
 * Responsável por autenticar usuários e gerenciar o menu principal
 */

const winston = require('winston');
const config = require('../../config/config');
const authService = require('../../src/services/auth-service');
const AuditLog = require('../../src/data/models/AuditLog');

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
 * Manipula o estado inicial
 * @param {Object} client - Cliente WhatsApp
 * @param {Object} message - Mensagem recebida
 * @param {Object} stateData - Dados do estado atual
 * @param {Object} stateManager - Gerenciador de estados
 * @returns {Promise<void>}
 */
const handleInitialState = async (client, message, stateData, stateManager) => {
  const from = message.from;
  const phoneNumber = from.replace(/@c\.us$/, '');
  
  // Verificar se é uma mensagem de texto
  if (message.type !== 'chat') {
    await client.sendText(from, 'Por favor, envie seu número de WhatsApp como texto.');
    return;
  }
  
  const text = message.body.trim();
  
  // Validar número de WhatsApp
  const phoneRegex = /^[0-9]{10,11}$/;
  if (!phoneRegex.test(text)) {
    await client.sendText(from, 
      '❌ Formato de número inválido.\n\n' +
      'Por favor, digite seu número de WhatsApp no formato correto:\n' +
      '92XXXXXXXX (apenas números)'
    );
    return;
  }
  
  try {
    // Iniciar autenticação
    const authResult = await authService.initiateAuth(text);
    
    if (!authResult.success) {
      if (authResult.isNewUser) {
        await client.sendText(from, 
          '❌ Número não cadastrado no sistema.\n\n' +
          'Por favor, entre em contato com o administrador para solicitar acesso.'
        );
      } else {
        await client.sendText(from, 
          '❌ Erro ao iniciar autenticação.\n\n' +
          'Por favor, tente novamente mais tarde ou entre em contato com o administrador.'
        );
      }
      return;
    }
    
    // Atualizar estado
    await stateManager.setState(phoneNumber, 'awaiting_code');
    await stateManager.updateContext(phoneNumber, { 
      authWhatsapp: text,
      authCode: authResult.code
    });
    
    // Enviar código de verificação
    await client.sendText(from, 
      '🔐 *VERIFICAÇÃO DE SEGURANÇA* 🔐\n\n' +
      `Um código de verificação foi enviado para o número ${text}.\n\n` +
      'Por favor, digite o código recebido para acessar o sistema.\n\n' +
      `Código: *${authResult.code}*`
    );
    
    logger.debug(`Código de verificação enviado para ${text}: ${authResult.code}`);
  } catch (error) {
    logger.error(`Erro ao processar autenticação para ${phoneNumber}: ${error.message}`);
    await client.sendText(from, '❌ Ocorreu um erro ao processar sua solicitação. Por favor, tente novamente.');
  }
};

/**
 * Manipula o estado de aguardando código
 * @param {Object} client - Cliente WhatsApp
 * @param {Object} message - Mensagem recebida
 * @param {Object} stateData - Dados do estado atual
 * @param {Object} stateManager - Gerenciador de estados
 * @returns {Promise<void>}
 */
const handleAwaitingCode = async (client, message, stateData, stateManager) => {
  const from = message.from;
  const phoneNumber = from.replace(/@c\.us$/, '');
  
  // Verificar se é uma mensagem de texto
  if (message.type !== 'chat') {
    await client.sendText(from, 'Por favor, envie o código de verificação como texto.');
    return;
  }
  
  const text = message.body.trim();
  
  try {
    // Verificar código
    const verifyResult = await authService.verifyCode(
      stateData.context.authWhatsapp,
      text,
      `WhatsApp ${phoneNumber}`
    );
    
    if (!verifyResult.success) {
      await client.sendText(from, 
        `❌ ${verifyResult.message}\n\n` +
        'Por favor, tente novamente ou digite *#cancelar* para reiniciar.'
      );
      return;
    }
    
    // Autenticação bem-sucedida
    const user = verifyResult.user;
    
    // Atualizar estado
    await stateManager.setState(phoneNumber, 'authenticated');
    await stateManager.updateContext(phoneNumber, { 
      userId: user.id,
      userName: user.fullName,
      userRole: user.role,
      sessionId: verifyResult.sessionId
    });
    
    // Registrar log de auditoria
    await AuditLog.logAction(
      user.id,
      phoneNumber,
      'auth_success',
      { deviceInfo: `WhatsApp ${phoneNumber}` }
    );
    
    // Enviar mensagem de boas-vindas
    await client.sendText(from, 
      `✅ *Autenticação bem-sucedida* ✅\n\n` +
      `Bem-vindo, ${user.fullName}!`
    );
    
    // Enviar menu principal
    await sendMainMenu(client, from, user.role);
    
    logger.debug(`Usuário ${user.id} autenticado com sucesso`);
  } catch (error) {
    logger.error(`Erro ao verificar código para ${phoneNumber}: ${error.message}`);
    await client.sendText(from, '❌ Ocorreu um erro ao processar sua solicitação. Por favor, tente novamente.');
  }
};

/**
 * Manipula o estado autenticado
 * @param {Object} client - Cliente WhatsApp
 * @param {Object} message - Mensagem recebida
 * @param {Object} stateData - Dados do estado atual
 * @param {Object} stateManager - Gerenciador de estados
 * @returns {Promise<void>}
 */
const handleAuthenticated = async (client, message, stateData, stateManager) => {
  const from = message.from;
  const phoneNumber = from.replace(/@c\.us$/, '');
  
  // Verificar se é uma mensagem de texto
  if (message.type !== 'chat') {
    await client.sendText(from, 'Por favor, envie sua opção como texto.');
    return;
  }
  
  const text = message.body.trim();
  const userRole = stateData.context.userRole;
  
  try {
    switch (text) {
      case '1':
        // Reconhecer placa
        await stateManager.setState(phoneNumber, 'recognizing_plate');
        
        await client.sendText(from, 
          '📸 *RECONHECIMENTO DE PLACA* 📸\n\n' +
          'Por favor, envie uma foto da placa do veículo ou digite a placa manualmente.\n\n' +
          'Formatos aceitos:\n' +
          '• Formato antigo: ABC1234\n' +
          '• Formato Mercosul: ABC1D23'
        );
        break;
        
      case '2':
        // Cadastrar veículo
        await stateManager.setState(phoneNumber, 'registering_vehicle');
        await stateManager.updateContext(phoneNumber, { vehicleRegistrationStep: 'plate' });
        
        await client.sendText(from, 
          '🚗 *CADASTRO DE VEÍCULO* 🚗\n\n' +
          'Por favor, digite a placa do veículo:\n\n' +
          'Formatos aceitos:\n' +
          '• Formato antigo: ABC1234\n' +
          '• Formato Mercosul: ABC1D23'
        );
        break;
        
      case '3':
        // Cadastrar motorista
        await stateManager.setState(phoneNumber, 'registering_driver');
        await stateManager.updateContext(phoneNumber, { driverRegistrationStep: 'name' });
        
        await client.sendText(from, 
          '👤 *CADASTRO DE MOTORISTA* 👤\n\n' +
          'Por favor, digite o nome completo do motorista:'
        );
        break;
        
      case '4':
        // Enviar notificação
        await stateManager.setState(phoneNumber, 'sending_notification');
        await stateManager.updateContext(phoneNumber, { notificationStep: 'type' });
        
        await client.sendText(from, 
          '📢 *ENVIAR NOTIFICAÇÃO* 📢\n\n' +
          'Selecione o tipo de notificação:\n\n' +
          '1️⃣ Notificação individual\n' +
          '2️⃣ Notificação para todos os membros\n' +
          '3️⃣ Notificação para todos os visitantes'
        );
        break;
        
      case '5':
        // Gerenciar usuários (apenas para administradores)
        if (userRole !== 'admin') {
          await client.sendText(from, '❌ Você não tem permissão para acessar esta funcionalidade.');
          return;
        }
        
        await stateManager.setState(phoneNumber, 'managing_users');
        await stateManager.updateContext(phoneNumber, { userManagementAction: 'menu' });
        
        await client.sendText(from, 
          '👥 *GERENCIAMENTO DE USUÁRIOS* 👥\n\n' +
          'Selecione uma opção:\n\n' +
          '1️⃣ Listar usuários\n' +
          '2️⃣ Cadastrar novo usuário\n' +
          '3️⃣ Editar usuário existente\n' +
          '4️⃣ Desativar usuário\n\n' +
          'Digite *#cancelar* para voltar ao menu principal.'
        );
        break;
        
      case '6':
        // Sair
        await authService.endSession(stateData.context.sessionId);
        
        // Registrar log de auditoria
        await AuditLog.logAction(
          stateData.context.userId,
          phoneNumber,
          'auth_logout',
          { deviceInfo: `WhatsApp ${phoneNumber}` }
        );
        
        // Limpar estado
        await stateManager.clearState(phoneNumber);
        
        await client.sendText(from, 
          '👋 *Sessão encerrada* 👋\n\n' +
          'Obrigado por utilizar o Sistema de Estacionamento da Comunidade Ser.\n\n' +
          'Para acessar novamente, envie qualquer mensagem.'
        );
        break;
        
      default:
        // Opção inválida
        await client.sendText(from, 
          '❌ Opção inválida.\n\n' +
          'Por favor, selecione uma opção válida do menu principal.'
        );
        
        // Reenviar menu principal
        await sendMainMenu(client, from, userRole);
        break;
    }
  } catch (error) {
    logger.error(`Erro ao processar opção para ${phoneNumber}: ${error.message}`);
    await client.sendText(from, '❌ Ocorreu um erro ao processar sua solicitação. Por favor, tente novamente.');
  }
};

/**
 * Envia o menu principal
 * @param {Object} client - Cliente WhatsApp
 * @param {string} to - Número de destino
 * @param {string} role - Papel do usuário
 * @returns {Promise<void>}
 */
const sendMainMenu = async (client, to, role) => {
  let menu = '📋 *MENU PRINCIPAL* 📋\n\n';
  menu += 'Selecione uma opção:\n\n';
  menu += '1️⃣ Reconhecer placa\n';
  menu += '2️⃣ Cadastrar veículo\n';
  menu += '3️⃣ Cadastrar motorista\n';
  menu += '4️⃣ Enviar notificação\n';
  
  // Opções de administrador
  if (role === 'admin') {
    menu += '5️⃣ Gerenciar usuários\n';
  }
  
  menu += '6️⃣ Sair';
  
  await client.sendText(to, menu);
};

// Exportar funções
module.exports = {
  handleInitialState,
  handleAwaitingCode,
  handleAuthenticated,
  sendMainMenu
};
