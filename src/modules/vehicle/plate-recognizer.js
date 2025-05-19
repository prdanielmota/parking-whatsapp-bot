/**
 * Módulo de reconhecimento de placas para o bot WhatsApp
 * Responsável por processar imagens e reconhecer placas de veículos
 */

const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
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
 * Reconhece a placa em uma imagem
 * @param {string} imagePath - Caminho da imagem
 * @returns {Promise<Object>} - Resultado do reconhecimento
 */
const recognizePlate = async (imagePath) => {
  try {
    const startTime = Date.now();
    
    // Verificar se o arquivo existe
    if (!fs.existsSync(imagePath)) {
      logger.error(`Arquivo de imagem não encontrado: ${imagePath}`);
      return {
        success: false,
        message: 'Arquivo de imagem não encontrado'
      };
    }
    
    // Caminho do script Python
    const scriptPath = path.resolve(__dirname, config.plateRecognition.scriptPath);
    
    // Verificar se o script existe
    if (!fs.existsSync(scriptPath)) {
      logger.error(`Script de reconhecimento não encontrado: ${scriptPath}`);
      return {
        success: false,
        message: 'Script de reconhecimento não encontrado'
      };
    }
    
    // Executar script Python
    const command = `${config.plateRecognition.pythonPath} ${scriptPath} "${imagePath}"`;
    
    return new Promise((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        if (error) {
          logger.error(`Erro ao executar script de reconhecimento: ${error.message}`);
          logger.error(`Stderr: ${stderr}`);
          
          resolve({
            success: false,
            message: 'Erro ao executar script de reconhecimento'
          });
          return;
        }
        
        try {
          // Processar saída do script
          const result = JSON.parse(stdout);
          
          // Verificar se a placa foi reconhecida
          if (!result.success) {
            logger.debug(`Placa não reconhecida: ${result.message}`);
            
            resolve({
              success: false,
              message: result.message
            });
            return;
          }
          
          // Verificar confiança mínima
          if (result.confidence < config.plateRecognition.minConfidence) {
            logger.debug(`Confiança abaixo do mínimo: ${result.confidence}%`);
            
            resolve({
              success: false,
              message: 'Confiança abaixo do mínimo'
            });
            return;
          }
          
          const endTime = Date.now();
          const processingTime = endTime - startTime;
          
          logger.debug(`Placa reconhecida: ${result.licensePlate} (confiança: ${result.confidence}%, tempo: ${processingTime}ms)`);
          
          resolve({
            success: true,
            licensePlate: result.licensePlate,
            confidence: result.confidence,
            processingTime
          });
        } catch (parseError) {
          logger.error(`Erro ao processar saída do script: ${parseError.message}`);
          logger.error(`Stdout: ${stdout}`);
          
          resolve({
            success: false,
            message: 'Erro ao processar saída do script'
          });
        }
      });
    });
  } catch (error) {
    logger.error(`Erro ao reconhecer placa: ${error.message}`);
    
    return {
      success: false,
      message: 'Erro ao reconhecer placa'
    };
  }
};

module.exports = {
  recognizePlate
};
