# Use uma imagem base do Node.js
FROM node:16-bullseye

# Instalar dependências para o Tesseract OCR e outras ferramentas
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-opencv \
    tesseract-ocr \
    tesseract-ocr-por \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgl1-mesa-glx \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Definir diretório de trabalho
WORKDIR /opt/parking-bot

# Copiar arquivos de dependências
COPY package*.json ./
COPY requirements.txt ./

# Instalar dependências do Node.js
RUN npm install

# Instalar dependências do Python
RUN pip3 install --no-cache-dir -r requirements.txt

# Copiar o código-fonte
COPY . .

# Criar diretórios necessários
RUN mkdir -p logs media tokens

# Expor porta (se necessário para API web)
EXPOSE 3000

# Comando para iniciar o bot
CMD ["node", "src/index.js"]
