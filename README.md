# Guia de Instalação e Uso do Bot WhatsApp para Estacionamento

Este guia fornece instruções detalhadas para instalar e executar o Bot WhatsApp para Gerenciamento de Estacionamento da Comunidade Ser.

## Requisitos

- Docker e Docker Compose instalados
- Acesso à internet para baixar as dependências
- Um smartphone com WhatsApp instalado para escanear o QR code

## Estrutura do Projeto

```
parking-whatsapp-bot/
├── src/                    # Código-fonte do bot
│   ├── core/               # Núcleo do sistema
│   ├── modules/            # Módulos funcionais
│   ├── data/               # Acesso a dados e modelos
│   ├── services/           # Serviços compartilhados
│   └── config/             # Configurações
├── Dockerfile              # Configuração do Docker
├── docker-compose.yml      # Configuração do Docker Compose
├── package.json            # Dependências Node.js
└── requirements.txt        # Dependências Python
```

## Instalação

1. Extraia o arquivo ZIP em um diretório de sua escolha.

2. Abra um terminal e navegue até o diretório extraído:
   ```
   cd caminho/para/parking-whatsapp-bot
   ```

3. Execute o seguinte comando para iniciar o bot:
   ```
   docker-compose up --build -d
   ```

4. Para verificar os logs e o QR code para autenticação:
   ```
   docker-compose logs -f app
   ```

5. Escaneie o QR code com seu WhatsApp para autenticar o bot.

## Solução de Problemas

### Erro "Cannot find module '/opt/parking-bot/src/index.js'"

Se você encontrar este erro, verifique se:

1. A estrutura de diretórios está correta
2. O arquivo index.js existe em src/
3. Reconstrua a imagem Docker com:
   ```
   docker-compose down
   docker-compose build --no-cache
   docker-compose up -d
   ```

### Erro de conexão com MongoDB

Se o bot não conseguir se conectar ao MongoDB:

1. Verifique se o serviço MongoDB está em execução:
   ```
   docker-compose ps
   ```

2. Reinicie os serviços:
   ```
   docker-compose restart
   ```

## Uso

Após a autenticação, você pode interagir com o bot enviando mensagens pelo WhatsApp:

1. O primeiro acesso requer autenticação com um código de verificação
2. Use o menu principal para navegar entre as funcionalidades
3. Para reconhecer placas, envie uma foto ou digite a placa manualmente
4. Para cadastrar veículos e motoristas, siga as instruções do bot

## Comandos Úteis

- Reiniciar o bot: `docker-compose restart app`
- Parar todos os serviços: `docker-compose down`
- Ver logs: `docker-compose logs -f app`
- Backup do banco de dados: `docker-compose exec mongodb mongodump --out /data/backup`

## Suporte

Para suporte adicional, entre em contato com o desenvolvedor.
