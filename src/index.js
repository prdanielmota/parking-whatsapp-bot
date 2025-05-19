/**
 * Bot WhatsApp para Gerenciamento de Estacionamento da Comunidade Ser
 * Arquivo principal de inicialização
 */

// Importações de módulos
const mongoose = require('mongoose');
const winston = require('winston');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Carregar variáveis de ambiente
dotenv.config();

// Configuração de logs
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ level, message, timestamp }) => {
      return `${timestamp} ${level.toUpperCase()}: ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ 
      filename: process.env.LOG_FILE || 'logs/bot.log'
    })
  ]
});

// Configuração do MongoDB
const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/parking-bot';
    
    logger.info(`Conectando ao MongoDB: ${mongoURI}`);
    
    await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    logger.info('Conexão com MongoDB estabelecida com sucesso');
    
    // Configurar banco de dados
    const { setupDatabase } = require('./data/setup');
    await setupDatabase();
    
    return true;
  } catch (error) {
    logger.error(`Erro ao conectar ao MongoDB: ${error.message}`);
    return false;
  }
};

// Inicialização do cliente WhatsApp
const initWhatsAppClient = async () => {
  try {
    logger.info('Inicializando cliente WhatsApp...');
    
    const { getClient } = require('./core/whatsapp-client');
    const client = await getClient();
    
    logger.info('Cliente WhatsApp inicializado com sucesso');
    
    return client;
  } catch (error) {
    logger.error(`Erro ao inicializar cliente WhatsApp: ${error.message}`);
    return null;
  }
};

// Configuração de manipuladores de mensagens
const setupMessageHandlers = (client) => {
  try {
    logger.info('Configurando manipuladores de mensagens...');
    
    const { setupMessageHandler } = require('./core/message-handler');
    setupMessageHandler(client);
    
    logger.info('Manipuladores de mensagens configurados com sucesso');
    
    return true;
  } catch (error) {
    logger.error(`Erro ao configurar manipuladores de mensagens: ${error.message}`);
    return false;
  }
};

// Função principal
const main = async () => {
  logger.info('Iniciando Bot WhatsApp para Gerenciamento de Estacionamento da Comunidade Ser');
  
  // Criar diretórios necessários
  const dirs = ['logs', 'media', 'tokens'];
  dirs.forEach(dir => {
    const dirPath = path.join(__dirname, '..', dir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      logger.info(`Diretório criado: ${dirPath}`);
    }
  });
  
  // Conectar ao MongoDB
  const dbConnected = await connectDB();
  
  if (!dbConnected) {
    logger.error('Falha ao conectar ao MongoDB. Encerrando aplicação.');
    process.exit(1);
  }
  
  // Inicializar cliente WhatsApp
  const client = await initWhatsAppClient();
  
  if (!client) {
    logger.error('Falha ao inicializar cliente WhatsApp. Encerrando aplicação.');
    process.exit(1);
  }
  
  // Configurar manipuladores de mensagens
  const handlersConfigured = setupMessageHandlers(client);
  
  if (!handlersConfigured) {
    logger.error('Falha ao configurar manipuladores de mensagens. Encerrando aplicação.');
    process.exit(1);
  }
  
  logger.info('Bot WhatsApp para Gerenciamento de Estacionamento da Comunidade Ser iniciado com sucesso');
};

// Tratamento de erros não capturados
process.on('uncaughtException', (error) => {
  logger.error(`Erro não capturado: ${error.message}`);
  logger.error(error.stack);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error(`Promessa rejeitada não tratada: ${reason}`);
});

// Iniciar aplicação
main().catch(error => {
  logger.error(`Erro ao iniciar aplicação: ${error.message}`);
  logger.error(error.stack);
  process.exit(1);
});
