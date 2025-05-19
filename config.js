module.exports = {
  environment: 'production',
  database: {
    // Use the service name 'mongo' defined in docker-compose.yml
    uri: 'mongodb://mongo:27017/parking_bot',
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      // Remove deprecated options if using newer MongoDB driver versions
      // useCreateIndex: true, 
      // useFindAndModify: false
    }
  },
  whatsapp: {
    sessionName: 'comunidade-ser-parking',
    headless: true,
    devtools: false,
    useChrome: true, // Venom uses Puppeteer which bundles Chromium
    debug: false,
    logQR: true, // Important for the user to scan the QR code from logs
    browserArgs: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process', // Avoids issues in some environments
      '--disable-gpu'
    ],
    multidevice: true,
    disableWelcome: true,
    disableSpins: true
  },
  recognition: {
    minConfidence: 70,
    cacheTTL: 3600, // 1 hour
    maxCacheSize: 100,
    // Path inside the container
    mediaDir: '/opt/parking-bot/media'
  },
  auth: {
    sessionTTL: 86400 * 30, // 30 days
    codeTTL: 600, // 10 minutes
    maxCodeAttempts: 3
  },
  logging: {
    level: 'info',
    // Path inside the container
    file: '/opt/parking-bot/logs/bot.log',
    maxSize: '10m',
    maxFiles: '7d'
  },
  // API (optional, disabled by default)
  api: {
    enabled: false,
    port: 3000,
    secret: 'change-this-secret',
    allowedIPs: ['127.0.0.1']
  }
};

