/**
 * Módulo de reconhecimento de placas
 * Responsável por processar imagens e extrair placas de veículos
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const winston = require('winston');
const config = require('../../../config/config');
const Vehicle = require('../../data/models/Vehicle');
const Driver = require('../../data/models/Driver');

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

// Cache para resultados de reconhecimento
const recognitionCache = new Map();

/**
 * Reconhece a placa em uma imagem
 * @param {string} imagePath - Caminho da imagem
 * @returns {Promise<Object>} - Resultado do reconhecimento
 */
const recognizePlate = async (imagePath) => {
  try {
    // Verificar se a imagem existe
    if (!fs.existsSync(imagePath)) {
      logger.error(`Imagem não encontrada: ${imagePath}`);
      return { success: false, message: 'Imagem não encontrada' };
    }
    
    // Verificar cache
    const cacheKey = imagePath;
    if (recognitionCache.has(cacheKey)) {
      const cachedResult = recognitionCache.get(cacheKey);
      const cacheAge = Date.now() - cachedResult.timestamp;
      
      // Usar cache se não estiver expirado
      if (cacheAge < (config.recognition.cacheTTL || 3600) * 1000) {
        logger.debug(`Usando resultado em cache para ${imagePath}`);
        return cachedResult.result;
      }
    }
    
    // Executar script Python para reconhecimento de placa
    const result = await runPythonRecognition(imagePath);
    
    if (result.success) {
      // Verificar se o veículo está registrado
      const vehicle = await Vehicle.findOne({ licensePlate: result.plate });
      
      if (vehicle) {
        // Veículo encontrado
        const driver = await Driver.findById(vehicle.driverId);
        
        result.vehicleFound = true;
        result.vehicleId = vehicle._id;
        result.driverId = driver._id;
      } else {
        // Veículo não encontrado
        result.vehicleFound = false;
      }
      
      // Armazenar resultado em cache
      recognitionCache.set(cacheKey, {
        result,
        timestamp: Date.now()
      });
      
      // Limpar cache se exceder tamanho máximo
      if (recognitionCache.size > (config.recognition.maxCacheSize || 100)) {
        const oldestKey = [...recognitionCache.keys()][0];
        recognitionCache.delete(oldestKey);
      }
    }
    
    return result;
  } catch (error) {
    logger.error(`Erro ao reconhecer placa: ${error.message}`);
    return { success: false, message: error.message };
  }
};

/**
 * Executa o script Python para reconhecimento de placa
 * @param {string} imagePath - Caminho da imagem
 * @returns {Promise<Object>} - Resultado do reconhecimento
 */
const runPythonRecognition = async (imagePath) => {
  return new Promise((resolve, reject) => {
    // Caminho para o script Python
    const scriptPath = path.join(__dirname, 'plate_recognition.py');
    
    // Executar script Python como processo filho
    const pythonProcess = spawn('python3', [scriptPath, imagePath]);
    
    let outputData = '';
    let errorData = '';
    
    // Capturar saída padrão
    pythonProcess.stdout.on('data', (data) => {
      outputData += data.toString();
    });
    
    // Capturar saída de erro
    pythonProcess.stderr.on('data', (data) => {
      errorData += data.toString();
    });
    
    // Processar quando o script terminar
    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        logger.error(`Erro no script Python: ${errorData}`);
        reject(new Error(`Processo Python encerrou com código ${code}: ${errorData}`));
        return;
      }
      
      try {
        // Analisar saída JSON do script Python
        const result = JSON.parse(outputData);
        resolve(result);
      } catch (error) {
        logger.error(`Erro ao analisar saída do script Python: ${error.message}`);
        reject(error);
      }
    });
  });
};

/**
 * Valida uma placa de veículo
 * @param {string} plate - Placa a ser validada
 * @returns {boolean} - true se a placa é válida
 */
const validatePlate = (plate) => {
  // Formatos válidos: ABC1234 (antigo) ou ABC1D23 (Mercosul)
  const plateRegex = /^[A-Z]{3}[0-9]{4}$|^[A-Z]{3}[0-9][A-Z][0-9]{2}$/;
  return plateRegex.test(plate);
};

// Exportar funções
module.exports = {
  recognizePlate,
  validatePlate
};
