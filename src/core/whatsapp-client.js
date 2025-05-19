/**
 * Cliente WhatsApp para o bot
 * Responsável por gerenciar a conexão com o WhatsApp
 */

const venom = require('venom-bot');
const fs = require('fs');
const path = require('path');
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

// Cliente WhatsApp (singleton)
let client = null;

/**
 * Obtém o cliente WhatsApp
 * @returns {Promise<Object>} - Cliente WhatsApp
 */
const getClient = async () => {
  if (client) {
    return client;
  }
  
  try {
    // Diretório para armazenar tokens de sessão
    const tokensDir = path.resolve(__dirname, '../../tokens');
    
    // Criar diretório se não existir
    if (!fs.existsSync(tokensDir)) {
      fs.mkdirSync(tokensDir, { recursive: true });
    }
    
    // Inicializar cliente
    client = await venom.create(
      'parking-bot',
      (base64Qrimg, asciiQR, attempts, urlCode) => {
        logger.info('QR Code gerado. Escaneie para autenticar.');
        logger.info(asciiQR);
        
        // Salvar QR Code como imagem
        const qrCodePath = path.resolve(__dirname, '../../media/qrcode.png');
        const matches = base64Qrimg.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        
        if (matches && matches.length === 3) {
          const imageData = Buffer.from(matches[2], 'base64');
          fs.writeFileSync(qrCodePath, imageData);
          logger.info(`QR Code salvo em: ${qrCodePath}`);
        }
      },
      (statusSession, session) => {
        logger.info(`Status da sessão: ${statusSession}`);
      },
      {
        folderNameToken: tokensDir,
        headless: true,
        useChrome: true,
        debug: false,
        logQR: false,
        browserArgs: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-gpu'
        ],
        disableWelcome: true,
        updatesLog: false,
        autoClose: 60000,
        createPathFileToken: true
      }
    );
    
    // Configurar manipuladores de eventos
    client.onStateChange((state) => {
      logger.info(`Estado do cliente alterado: ${state}`);
      
      // Reconectar se desconectado
      if (state === 'CONFLICT' || state === 'UNLAUNCHED') {
        client.useHere();
      }
    });
    
    client.onMessage((message) => {
      // Manipulador de mensagens configurado em message-handler.js
    });
    
    logger.info('Cliente WhatsApp inicializado com sucesso');
    
    return client;
  } catch (error) {
    logger.error(`Erro ao inicializar cliente WhatsApp: ${error.message}`);
    throw error;
  }
};

module.exports = {
  getClient
};
