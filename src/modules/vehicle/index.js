/**
 * Módulo de veículos para o bot WhatsApp
 * Responsável por gerenciar reconhecimento de placas e cadastro de veículos
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const winston = require('winston');
const config = require('../../config/config');
const Vehicle = require('../../data/models/Vehicle');
const Driver = require('../../data/models/Driver');
const ParkingLog = require('../../data/models/ParkingLog');
const RecognitionLog = require('../../data/models/RecognitionLog');
const plateRecognizer = require('./plate-recognizer');

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
 * Manipula o reconhecimento de placa
 * @param {Object} client - Cliente WhatsApp
 * @param {Object} message - Mensagem recebida
 * @param {Object} stateData - Dados do estado atual
 * @param {Object} stateManager - Gerenciador de estados
 * @returns {Promise<void>}
 */
const handlePlateRecognition = async (client, message, stateData, stateManager) => {
  const from = message.from;
  const phoneNumber = from.replace(/@c\.us$/, '');
  
  try {
    let licensePlate = '';
    let confidence = 0;
    let imageUrl = '';
    
    // Verificar se é uma mensagem de texto ou imagem
    if (message.type === 'chat') {
      // Reconhecimento manual
      licensePlate = message.body.trim().toUpperCase();
      confidence = 100;
      
      // Validar formato da placa
      if (!isValidLicensePlate(licensePlate)) {
        await client.sendText(from, 
          '❌ Formato de placa inválido.\n\n' +
          'Por favor, digite a placa no formato correto:\n' +
          '• Formato antigo: ABC1234\n' +
          '• Formato Mercosul: ABC1D23'
        );
        return;
      }
    } else if (message.type === 'image') {
      // Reconhecimento automático
      await client.sendText(from, '🔍 Processando imagem... Aguarde um momento.');
      
      // Baixar imagem
      const buffer = await client.decryptFile(message);
      
      // Criar diretório temporário se não existir
      const tempDir = path.resolve(__dirname, '../../..', config.plateRecognition.tempDir);
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      // Salvar imagem
      const imagePath = path.join(tempDir, `${Date.now()}.jpg`);
      fs.writeFileSync(imagePath, buffer);
      
      // Reconhecer placa
      const recognitionResult = await plateRecognizer.recognizePlate(imagePath);
      
      if (!recognitionResult.success) {
        await client.sendText(from, 
          '❌ Não foi possível reconhecer a placa na imagem.\n\n' +
          'Por favor, tente novamente com uma imagem mais clara ou digite a placa manualmente.'
        );
        return;
      }
      
      licensePlate = recognitionResult.licensePlate;
      confidence = recognitionResult.confidence;
      imageUrl = imagePath;
      
      logger.debug(`Placa reconhecida: ${licensePlate} (confiança: ${confidence}%)`);
    } else {
      await client.sendText(from, 
        '❌ Formato não suportado.\n\n' +
        'Por favor, envie uma foto da placa ou digite a placa manualmente.'
      );
      return;
    }
    
    // Buscar veículo pela placa
    const vehicle = await Vehicle.findOne({ licensePlate });
    
    // Registrar log de reconhecimento
    await RecognitionLog.create({
      userId: stateData.context.userId,
      recognizedPlate: licensePlate,
      confidence,
      vehicleId: vehicle ? vehicle._id : null,
      isRegistered: !!vehicle,
      imageUrl,
      processingTimeMs: 0
    });
    
    // Atualizar contexto
    await stateManager.setState(phoneNumber, 'plate_action');
    await stateManager.updateContext(phoneNumber, { 
      recognizedPlate: licensePlate,
      vehicleId: vehicle ? vehicle._id : null,
      isRegistered: !!vehicle
    });
    
    if (vehicle) {
      // Buscar motorista
      const driver = await Driver.findById(vehicle.driverId);
      
      // Verificar se o veículo está no estacionamento
      const activeParking = await ParkingLog.findOne({ 
        vehicleId: vehicle._id,
        exitTime: null
      });
      
      let message = `✅ *VEÍCULO REGISTRADO* ✅\n\n`;
      message += `📝 *Informações do veículo:*\n`;
      message += `• Placa: ${vehicle.licensePlate}\n`;
      message += `• Marca/Modelo: ${vehicle.make} ${vehicle.model}\n`;
      message += `• Cor: ${vehicle.color}\n\n`;
      
      message += `👤 *Informações do motorista:*\n`;
      message += `• Nome: ${driver.fullName}\n`;
      message += `• WhatsApp: ${driver.whatsapp}\n`;
      message += `• Status: ${driver.memberStatus === 'member' ? 'Membro' : 'Visitante'}\n\n`;
      
      message += `🅿️ *Status de estacionamento:*\n`;
      message += activeParking 
        ? `• Veículo PRESENTE no estacionamento desde ${formatDate(activeParking.entryTime)}\n\n`
        : `• Veículo NÃO PRESENTE no estacionamento\n\n`;
      
      message += `Selecione uma opção:\n\n`;
      message += activeParking
        ? `1️⃣ Registrar saída\n`
        : `1️⃣ Registrar entrada\n`;
      message += `2️⃣ Enviar notificação ao motorista\n`;
      message += `3️⃣ Voltar ao menu principal`;
      
      await client.sendText(from, message);
    } else {
      await client.sendText(from, 
        `❌ *VEÍCULO NÃO REGISTRADO* ❌\n\n` +
        `A placa ${licensePlate} não está registrada no sistema.\n\n` +
        `Selecione uma opção:\n\n` +
        `1️⃣ Cadastrar novo veículo com esta placa\n` +
        `2️⃣ Voltar ao menu principal`
      );
    }
  } catch (error) {
    logger.error(`Erro ao processar reconhecimento de placa: ${error.message}`);
    await client.sendText(from, '❌ Ocorreu um erro ao processar sua solicitação. Por favor, tente novamente.');
  }
};

/**
 * Manipula ação sobre placa reconhecida
 * @param {Object} client - Cliente WhatsApp
 * @param {Object} message - Mensagem recebida
 * @param {Object} stateData - Dados do estado atual
 * @param {Object} stateManager - Gerenciador de estados
 * @returns {Promise<void>}
 */
const handlePlateAction = async (client, message, stateData, stateManager) => {
  const from = message.from;
  const phoneNumber = from.replace(/@c\.us$/, '');
  
  // Verificar se é uma mensagem de texto
  if (message.type !== 'chat') {
    await client.sendText(from, 'Por favor, envie sua opção como texto.');
    return;
  }
  
  const text = message.body.trim();
  const isRegistered = stateData.context.isRegistered;
  
  try {
    if (isRegistered) {
      // Veículo registrado
      const vehicleId = stateData.context.vehicleId;
      
      // Verificar se o veículo está no estacionamento
      const activeParking = await ParkingLog.findOne({ 
        vehicleId,
        exitTime: null
      });
      
      switch (text) {
        case '1':
          // Registrar entrada/saída
          if (activeParking) {
            // Registrar saída
            activeParking.exitTime = new Date();
            activeParking.exitRegisteredBy = stateData.context.userId;
            await activeParking.save();
            
            // Buscar veículo e motorista
            const vehicle = await Vehicle.findById(vehicleId);
            const driver = await Driver.findById(vehicle.driverId);
            
            // Enviar notificação ao motorista se configurado
            if (driver.notifyOnExit) {
              // Implementar envio de notificação
            }
            
            await client.sendText(from, 
              `✅ *SAÍDA REGISTRADA* ✅\n\n` +
              `Saída do veículo ${vehicle.licensePlate} registrada com sucesso.\n\n` +
              `• Entrada: ${formatDate(activeParking.entryTime)}\n` +
              `• Saída: ${formatDate(activeParking.exitTime)}\n` +
              `• Duração: ${calculateDuration(activeParking.entryTime, activeParking.exitTime)}\n\n` +
              `Digite *#cancelar* para voltar ao menu principal.`
            );
          } else {
            // Registrar entrada
            const newParking = await ParkingLog.create({
              vehicleId,
              driverId: (await Vehicle.findById(vehicleId)).driverId,
              entryTime: new Date(),
              registeredBy: stateData.context.userId
            });
            
            // Buscar veículo e motorista
            const vehicle = await Vehicle.findById(vehicleId);
            const driver = await Driver.findById(vehicle.driverId);
            
            // Enviar notificação ao motorista se configurado
            if (driver.notifyOnEntry) {
              // Implementar envio de notificação
            }
            
            await client.sendText(from, 
              `✅ *ENTRADA REGISTRADA* ✅\n\n` +
              `Entrada do veículo ${vehicle.licensePlate} registrada com sucesso.\n\n` +
              `• Data/Hora: ${formatDate(newParking.entryTime)}\n\n` +
              `Digite *#cancelar* para voltar ao menu principal.`
            );
          }
          break;
          
        case '2':
          // Enviar notificação ao motorista
          // Implementar envio de notificação
          await client.sendText(from, 
            `🔔 *NOTIFICAÇÃO* 🔔\n\n` +
            `Funcionalidade em desenvolvimento.\n\n` +
            `Digite *#cancelar* para voltar ao menu principal.`
          );
          break;
          
        case '3':
          // Voltar ao menu principal
          await stateManager.setState(phoneNumber, 'authenticated');
          
          // Enviar menu principal
          const authModule = require('../auth');
          await authModule.sendMainMenu(client, from, stateData.context.userRole);
          break;
          
        default:
          // Opção inválida
          await client.sendText(from, 
            '❌ Opção inválida.\n\n' +
            'Por favor, selecione uma opção válida.'
          );
          break;
      }
    } else {
      // Veículo não registrado
      switch (text) {
        case '1':
          // Cadastrar novo veículo
          await stateManager.setState(phoneNumber, 'registering_vehicle');
          await stateManager.updateContext(phoneNumber, { 
            vehicleRegistrationStep: 'make',
            vehiclePlate: stateData.context.recognizedPlate
          });
          
          await client.sendText(from, 
            `🚗 *CADASTRO DE VEÍCULO* 🚗\n\n` +
            `Iniciando cadastro para a placa ${stateData.context.recognizedPlate}.\n\n` +
            `Por favor, digite a marca do veículo:`
          );
          break;
          
        case '2':
          // Voltar ao menu principal
          await stateManager.setState(phoneNumber, 'authenticated');
          
          // Enviar menu principal
          const authModule = require('../auth');
          await authModule.sendMainMenu(client, from, stateData.context.userRole);
          break;
          
        default:
          // Opção inválida
          await client.sendText(from, 
            '❌ Opção inválida.\n\n' +
            'Por favor, selecione uma opção válida.'
          );
          break;
      }
    }
  } catch (error) {
    logger.error(`Erro ao processar ação sobre placa: ${error.message}`);
    await client.sendText(from, '❌ Ocorreu um erro ao processar sua solicitação. Por favor, tente novamente.');
  }
};

/**
 * Manipula cadastro de veículo
 * @param {Object} client - Cliente WhatsApp
 * @param {Object} message - Mensagem recebida
 * @param {Object} stateData - Dados do estado atual
 * @param {Object} stateManager - Gerenciador de estados
 * @returns {Promise<void>}
 */
const handleRegisteringVehicle = async (client, message, stateData, stateManager) => {
  const from = message.from;
  const phoneNumber = from.replace(/@c\.us$/, '');
  
  // Verificar se é uma mensagem de texto
  if (message.type !== 'chat') {
    await client.sendText(from, 'Por favor, envie sua resposta como texto.');
    return;
  }
  
  const text = message.body.trim();
  const step = stateData.context.vehicleRegistrationStep;
  
  try {
    switch (step) {
      case 'plate':
        // Validar placa
        const licensePlate = text.toUpperCase();
        
        if (!isValidLicensePlate(licensePlate)) {
          await client.sendText(from, 
            '❌ Formato de placa inválido.\n\n' +
            'Por favor, digite a placa no formato correto:\n' +
            '• Formato antigo: ABC1234\n' +
            '• Formato Mercosul: ABC1D23'
          );
          return;
        }
        
        // Verificar se a placa já está registrada
        const existingVehicle = await Vehicle.findOne({ licensePlate });
        
        if (existingVehicle) {
          await client.sendText(from, 
            '❌ Esta placa já está registrada no sistema.\n\n' +
            'Por favor, digite *#cancelar* para voltar ao menu principal.'
          );
          return;
        }
        
        // Atualizar contexto
        await stateManager.updateContext(phoneNumber, { 
          vehicleRegistrationStep: 'make',
          vehiclePlate: licensePlate
        });
        
        await client.sendText(from, 
          `🚗 *CADASTRO DE VEÍCULO* 🚗\n\n` +
          `Por favor, digite a marca do veículo:`
        );
        break;
        
      case 'make':
        // Validar marca
        if (text.length < 2) {
          await client.sendText(from, 'Por favor, digite uma marca válida.');
          return;
        }
        
        // Atualizar contexto
        await stateManager.updateContext(phoneNumber, { 
          vehicleRegistrationStep: 'model',
          vehicleMake: text
        });
        
        await client.sendText(from, 
          `🚗 *CADASTRO DE VEÍCULO* 🚗\n\n` +
          `Por favor, digite o modelo do veículo:`
        );
        break;
        
      case 'model':
        // Validar modelo
        if (text.length < 2) {
          await client.sendText(from, 'Por favor, digite um modelo válido.');
          return;
        }
        
        // Atualizar contexto
        await stateManager.updateContext(phoneNumber, { 
          vehicleRegistrationStep: 'color',
          vehicleModel: text
        });
        
        await client.sendText(from, 
          `🚗 *CADASTRO DE VEÍCULO* 🚗\n\n` +
          `Por favor, digite a cor do veículo:`
        );
        break;
        
      case 'color':
        // Validar cor
        if (text.length < 2) {
          await client.sendText(from, 'Por favor, digite uma cor válida.');
          return;
        }
        
        // Atualizar contexto
        await stateManager.updateContext(phoneNumber, { 
          vehicleRegistrationStep: 'driver',
          vehicleColor: text
        });
        
        await client.sendText(from, 
          `🚗 *CADASTRO DE VEÍCULO* 🚗\n\n` +
          `Por favor, digite o número de WhatsApp do motorista:`
        );
        break;
        
      case 'driver':
        // Validar número de WhatsApp
        const whatsapp = text.replace(/\D/g, '');
        
        if (whatsapp.length < 10 || whatsapp.length > 11) {
          await client.sendText(from, 
            '❌ Formato de número inválido.\n\n' +
            'Por favor, digite o número de WhatsApp no formato correto:\n' +
            '92XXXXXXXX (apenas números)'
          );
          return;
        }
        
        // Buscar motorista pelo WhatsApp
        let driver = await Driver.findOne({ whatsapp });
        
        if (!driver) {
          // Motorista não encontrado, perguntar se deseja cadastrar
          await stateManager.updateContext(phoneNumber, { 
            vehicleRegistrationStep: 'new_driver',
            vehicleDriverWhatsapp: whatsapp
          });
          
          await client.sendText(from, 
            `❌ Motorista não encontrado.\n\n` +
            `Deseja cadastrar um novo motorista com o número ${whatsapp}?\n\n` +
            `1️⃣ Sim\n` +
            `2️⃣ Não, usar outro número`
          );
        } else {
          // Motorista encontrado, confirmar cadastro
          await stateManager.updateContext(phoneNumber, { 
            vehicleRegistrationStep: 'confirm',
            vehicleDriverId: driver._id
          });
          
          await client.sendText(from, 
            `✅ Motorista encontrado: ${driver.fullName}\n\n` +
            `Confirma o cadastro do veículo?\n\n` +
            `• Placa: ${stateData.context.vehiclePlate}\n` +
            `• Marca: ${stateData.context.vehicleMake}\n` +
            `• Modelo: ${stateData.context.vehicleModel}\n` +
            `• Cor: ${stateData.context.vehicleColor}\n` +
            `• Motorista: ${driver.fullName}\n\n` +
            `1️⃣ Confirmar\n` +
            `2️⃣ Cancelar`
          );
        }
        break;
        
      case 'new_driver':
        if (text === '1') {
          // Cadastrar novo motorista
          await stateManager.setState(phoneNumber, 'registering_driver');
          await stateManager.updateContext(phoneNumber, { 
            driverRegistrationStep: 'name',
            driverWhatsapp: stateData.context.vehicleDriverWhatsapp,
            returnToVehicleRegistration: true,
            vehiclePlate: stateData.context.vehiclePlate,
            vehicleMake: stateData.context.vehicleMake,
            vehicleModel: stateData.context.vehicleModel,
            vehicleColor: stateData.context.vehicleColor
          });
          
          await client.sendText(from, 
            `👤 *CADASTRO DE MOTORISTA* 👤\n\n` +
            `Por favor, digite o nome completo do motorista:`
          );
        } else if (text === '2') {
          // Usar outro número
          await stateManager.updateContext(phoneNumber, { 
            vehicleRegistrationStep: 'driver'
          });
          
          await client.sendText(from, 
            `🚗 *CADASTRO DE VEÍCULO* 🚗\n\n` +
            `Por favor, digite o número de WhatsApp do motorista:`
          );
        } else {
          // Opção inválida
          await client.sendText(from, 
            '❌ Opção inválida.\n\n' +
            'Por favor, selecione 1 para cadastrar um novo motorista ou 2 para usar outro número.'
          );
        }
        break;
        
      case 'confirm':
        if (text === '1') {
          // Confirmar cadastro
          const vehicle = await Vehicle.create({
            licensePlate: stateData.context.vehiclePlate,
            make: stateData.context.vehicleMake,
            model: stateData.context.vehicleModel,
            color: stateData.context.vehicleColor,
            driverId: stateData.context.vehicleDriverId,
            registeredBy: stateData.context.userId,
            registrationDate: new Date()
          });
          
          // Buscar motorista
          const driver = await Driver.findById(stateData.context.vehicleDriverId);
          
          // Voltar ao menu principal
          await stateManager.setState(phoneNumber, 'authenticated');
          
          await client.sendText(from, 
            `✅ *VEÍCULO CADASTRADO COM SUCESSO* ✅\n\n` +
            `• Placa: ${vehicle.licensePlate}\n` +
            `• Marca: ${vehicle.make}\n` +
            `• Modelo: ${vehicle.model}\n` +
            `• Cor: ${vehicle.color}\n` +
            `• Motorista: ${driver.fullName}\n\n` +
            `Veículo cadastrado com sucesso!`
          );
          
          // Enviar menu principal
          const authModule = require('../auth');
          await authModule.sendMainMenu(client, from, stateData.context.userRole);
        } else if (text === '2') {
          // Cancelar cadastro
          await stateManager.setState(phoneNumber, 'authenticated');
          
          await client.sendText(from, 'Cadastro de veículo cancelado.');
          
          // Enviar menu principal
          const authModule = require('../auth');
          await authModule.sendMainMenu(client, from, stateData.context.userRole);
        } else {
          // Opção inválida
          await client.sendText(from, 
            '❌ Opção inválida.\n\n' +
            'Por favor, selecione 1 para confirmar ou 2 para cancelar.'
          );
        }
        break;
        
      default:
        // Estado desconhecido
        logger.warn(`Estado de cadastro de veículo desconhecido: ${step}`);
        await stateManager.setState(phoneNumber, 'authenticated');
        
        await client.sendText(from, 
          '❌ Ocorreu um erro ao processar sua solicitação.\n\n' +
          'Por favor, tente novamente.'
        );
        
        // Enviar menu principal
        const authModule = require('../auth');
        await authModule.sendMainMenu(client, from, stateData.context.userRole);
        break;
    }
  } catch (error) {
    logger.error(`Erro ao processar cadastro de veículo: ${error.message}`);
    await client.sendText(from, '❌ Ocorreu um erro ao processar sua solicitação. Por favor, tente novamente.');
  }
};

/**
 * Verifica se uma placa é válida
 * @param {string} plate - Placa a ser verificada
 * @returns {boolean} - Resultado da validação
 */
const isValidLicensePlate = (plate) => {
  // Formato antigo: ABC1234
  const oldFormat = /^[A-Z]{3}[0-9]{4}$/;
  
  // Formato Mercosul: ABC1D23
  const mercosulFormat = /^[A-Z]{3}[0-9][A-Z][0-9]{2}$/;
  
  return oldFormat.test(plate) || mercosulFormat.test(plate);
};

/**
 * Formata uma data
 * @param {Date} date - Data a ser formatada
 * @returns {string} - Data formatada
 */
const formatDate = (date) => {
  if (!date) return 'N/A';
  
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

/**
 * Calcula a duração entre duas datas
 * @param {Date} start - Data de início
 * @param {Date} end - Data de fim
 * @returns {string} - Duração formatada
 */
const calculateDuration = (start, end) => {
  if (!start || !end) return 'N/A';
  
  const durationMs = end.getTime() - start.getTime();
  const durationMinutes = Math.floor(durationMs / (1000 * 60));
  
  const hours = Math.floor(durationMinutes / 60);
  const minutes = durationMinutes % 60;
  
  return `${hours}h ${minutes}min`;
};

module.exports = {
  handlePlateRecognition,
  handlePlateAction,
  handleRegisteringVehicle
};
