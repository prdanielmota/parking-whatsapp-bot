# Use uma imagem base do Node.js com Debian Bullseye
FROM node:16-bullseye

# Defina variáveis de ambiente
ENV DEBIAN_FRONTEND=noninteractive
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# Defina o diretório de trabalho
WORKDIR /opt/parking-bot

# Instale dependências do sistema
# - python3, pip: Para o reconhecimento de placas
# - tesseract: OCR engine
# - chromium: Navegador headless para Venom Bot
# - opencv: Bibliotecas de processamento de imagem
# - Outras: Bibliotecas necessárias para opencv e tesseract
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    tesseract-ocr \
    libtesseract-dev \
    chromium \
    libgl1-mesa-glx \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgtk-3-dev \
    libavcodec-dev \
    libavformat-dev \
    libswscale-dev \
    libv4l-dev \
    libxvidcore-dev \
    libx264-dev \
    libjpeg-dev \
    libpng-dev \
    libtiff-dev \
    gfortran \
    openexr \
    libatlas-base-dev \
    libtbb2 \
    libtbb-dev \
    libdc1394-22-dev \
    # Limpeza
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Copie os arquivos de dependências do Node.js
COPY package*.json ./

# Instale as dependências do Node.js
RUN npm install --production

# Copie os arquivos de dependências do Python
COPY requirements.txt ./

# Instale as dependências do Python
RUN pip3 install --no-cache-dir -r requirements.txt

# Copie o restante do código da aplicação
COPY . .

# Crie diretórios necessários e ajuste permissões (assumindo que o Node user é 'node')
RUN mkdir -p logs media tokens backups \
    && chown -R node:node logs media tokens backups

# Mude para o usuário não-root 'node' (criado pela imagem base do Node.js)
USER node

# Comando para iniciar a aplicação
CMD [ "node", "src/index.js" ]
