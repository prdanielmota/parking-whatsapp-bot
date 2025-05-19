/**
 * Arquivo de configuração para o bot WhatsApp
 */

module.exports = {
  // Ambiente
  environment: process.env.NODE_ENV || 'development',
  
  // Configurações do servidor
  server: {
    port: process.env.PORT || 3000,
    host: process.env.HOST || '0.0.0.0'
  },
  
  // Configurações do MongoDB
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://mongodb:27017/parking-bot',
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true
    }
  },
  
  // Configurações de autenticação
  auth: {
    codeTTL: 600, // Tempo de vida do código de verificação em segundos (10 minutos)
    sessionTTL: 2592000, // Tempo de vida da sessão em segundos (30 dias)
    maxCodeAttempts: 3 // Número máximo de tentativas de código
  },
  
  // Configurações de logs
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || 'logs/bot.log'
  },
  
  // Configurações de reconhecimento de placas
  plateRecognition: {
    pythonPath: process.env.PYTHON_PATH || 'python3',
    scriptPath: process.env.SCRIPT_PATH || 'src/modules/recognition/plate_recognition.py',
    tempDir: process.env.TEMP_DIR || 'media/temp',
    minConfidence: 70 // Confiança mínima para reconhecimento de placas (%)
  },
  
  // Configurações de notificações
  notifications: {
    defaultPrefix: '📢 *Comunidade Ser* 📢\n\n'
  }
};
