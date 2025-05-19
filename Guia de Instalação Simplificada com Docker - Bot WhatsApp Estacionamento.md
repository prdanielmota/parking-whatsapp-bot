# Guia de Instalação Simplificada com Docker - Bot WhatsApp Estacionamento

## Visão Geral

Este guia explica como instalar e executar o Bot WhatsApp de Gerenciamento de Estacionamento da Comunidade Ser usando Docker e Docker Compose. Esta abordagem simplifica muito a instalação, pois empacota a aplicação e todas as suas dependências (Node.js, MongoDB, Python, Chromium, etc.) em contêineres isolados.

**Importante:** Devido a limitações no ambiente de desenvolvimento atual, não foi possível testar completamente esta configuração Docker. A validação final deverá ser feita no seu servidor.

## Pré-requisitos

Você precisará de um servidor (recomendamos Ubuntu 20.04 LTS ou superior) com acesso à internet e privilégios de administrador (`sudo`).

### 1. Instalar Docker e Docker Compose

Conecte-se ao seu servidor via SSH e execute os seguintes comandos:

```bash
# Atualizar lista de pacotes
sudo apt-get update

# Instalar pacotes necessários para permitir que o apt use um repositório sobre HTTPS
sudo apt-get install -y apt-transport-https ca-certificates curl software-properties-common

# Adicionar a chave GPG oficial do Docker
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# Configurar o repositório estável do Docker
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Instalar Docker Engine
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io

# Verificar se o Docker está rodando
sudo systemctl status docker
# Se não estiver ativo, inicie: sudo systemctl start docker
# Habilite para iniciar com o sistema: sudo systemctl enable docker

# Instalar Docker Compose (Verifique a última versão em https://github.com/docker/compose/releases)
LATEST_COMPOSE=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep "tag_name" | cut -d\" -f4)
sudo curl -L "https://github.com/docker/compose/releases/download/${LATEST_COMPOSE}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verificar instalação do Docker Compose
docker-compose --version

# (Opcional) Adicionar seu usuário ao grupo docker para rodar comandos sem sudo
sudo usermod -aG docker $USER
# Você precisará sair e entrar novamente na sessão SSH para que isso tenha efeito.
```

## Obtendo os Arquivos

1.  **Crie um diretório** para o projeto no seu servidor:
    ```bash
    mkdir ~/parking-bot
    cd ~/parking-bot
    ```

2.  **Baixe os arquivos necessários**: Você precisará dos seguintes arquivos neste diretório (`~/parking-bot`):
    *   `Dockerfile` (Fornecido anteriormente)
    *   `docker-compose.yml` (Fornecido anteriormente)
    *   Todo o código-fonte do bot (incluindo `package.json`, `requirements.txt`, diretório `src`, etc.). A forma mais fácil é clonar o repositório Git, se disponível:
        ```bash
        # Exemplo: Substitua pela URL correta do repositório
        # git clone https://github.com/comunidade-ser/parking-whatsapp-bot.git .
        ```
        *Se o código não estiver em um repositório, você precisará copiá-lo para este diretório.*

## Configuração

1.  **Crie o arquivo de configuração**: Copie o arquivo `config/config.example.js` (se existir no código-fonte) ou crie o arquivo `config/config.js` manualmente dentro de um diretório `config`:
    ```bash
    mkdir config
    nano config/config.js
    ```
    Cole o conteúdo do `config.js` fornecido anteriormente neste arquivo. **Não altere** o `MONGO_URI` (ele aponta para o serviço `mongo` dentro do Docker).

2.  **Crie os diretórios locais** que serão mapeados para os volumes do Docker. No diretório `~/parking-bot`, execute:
    ```bash
    mkdir -p logs media tokens backups
    ```
    *O Docker criará os volumes se eles não existirem, mas criar os diretórios garante que as permissões estejam corretas inicialmente.*

## Executando o Bot

1.  **Navegue até o diretório** do projeto:
    ```bash
    cd ~/parking-bot
    ```

2.  **Inicie os contêineres** em segundo plano (`-d`). O comando `--build` garantirá que a imagem do bot seja construída na primeira vez ou se o `Dockerfile` mudar:
    ```bash
    # Se você adicionou seu usuário ao grupo docker, pode omitir o 'sudo'
    sudo docker-compose up --build -d
    ```
    *O processo de build pode demorar alguns minutos na primeira vez, pois baixará imagens e instalará todas as dependências dentro do contêiner `app`.*

## Primeira Execução: Escanear QR Code

1.  **Acesse os logs** do contêiner `app` para ver o QR code do WhatsApp:
    ```bash
    # Pressione Ctrl+C para sair dos logs quando terminar
    sudo docker-compose logs -f app
    ```

2.  **Procure por um QR code** nos logs. Ele será exibido como texto ou um link.

3.  **Escaneie o QR code** usando o aplicativo WhatsApp no celular que será usado para o bot (Menu > Aparelhos conectados > Conectar um aparelho).

4.  Após escanear, o bot deve indicar que está pronto nos logs.

5.  **Autentique o administrador**: Envie uma mensagem para o número do bot a partir do WhatsApp do administrador cadastrado. Siga as instruções para digitar seu número e o código OTP recebido.

## Gerenciamento Básico

Use estes comandos no diretório `~/parking-bot`:

*   **Ver logs**: `sudo docker-compose logs -f app` (ou `mongo`)
*   **Parar os contêineres**: `sudo docker-compose down`
*   **Iniciar contêineres parados**: `sudo docker-compose start`
*   **Parar contêineres**: `sudo docker-compose stop`
*   **Reiniciar contêineres**: `sudo docker-compose restart`
*   **Ver status dos contêineres**: `sudo docker-compose ps`

## Solução de Problemas Comuns

*   **Erro `Connection refused` ou `Cannot connect to the Docker daemon`**: Verifique se o serviço Docker está rodando (`sudo systemctl status docker`). Se não, inicie-o (`sudo systemctl start docker`). Verifique também se seu usuário tem permissão (grupo `docker` ou use `sudo`).
*   **Contêiner `app` não inicia ou reinicia**: Verifique os logs (`sudo docker-compose logs app`) para mensagens de erro específicas. Pode ser um problema no `config.js`, dependências faltando, ou erro no código.
*   **QR Code não aparece**: Verifique os logs (`sudo docker-compose logs -f app`). Certifique-se que `logQR: true` está no `config.js`. Verifique se o contêiner tem conexão com a internet.
*   **Problemas de permissão com volumes**: Se houver erros de permissão nos logs relacionados aos diretórios `logs`, `media`, `tokens`, tente ajustar as permissões no host: `sudo chown -R $USER:$USER logs media tokens backups` (ou use o ID do usuário `node` do contêiner se necessário).

## Próximos Passos

Após a instalação e a primeira autenticação, o bot estará pronto para uso. Siga as instruções do bot via WhatsApp para gerenciar usuários, reconhecer placas e controlar o estacionamento.

Lembre-se de configurar backups regulares do volume `mongo_data` e dos diretórios locais (`logs`, `media`, `tokens`, `backups`) conforme suas políticas de segurança.
