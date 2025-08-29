# 🎩 Magic - Next Generation Enterprise AI Application Innovation Engine

<div align="center">

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
<!-- [![Docker Pulls](https://img.shields.io/docker/pulls/dtyq/magic.svg)](https://hub.docker.com/r/dtyq/magic)
[![GitHub stars](https://img.shields.io/github/stars/dtyq/magic.svg?style=social&label=Star)](https://github.com/dtyq/magic) -->

</div>

Magic è un potente motore di innovazione per applicazioni AI di livello enterprise, progettato per aiutare gli sviluppatori a costruire e distribuire rapidamente applicazioni AI. Fornisce un framework di sviluppo completo, una ricca toolchain e best practices, rendendo lo sviluppo di applicazioni AI semplice ed efficiente.

![flow](https://cdn.letsmagic.cn/static/img/showmagic.jpg)

## ✨ Caratteristiche

- 🚀 **Architettura ad Alte Prestazioni**: Sviluppato con PHP+Swow+hyperf, offre eccellenti prestazioni e scalabilità
- 🧩 **Design Modulare**: Sistema di plugin flessibile, supporta estensioni e personalizzazioni rapide
- 🔌 **Supporto Multi-Modello**: Integrazione seamless con modelli AI mainstream, inclusi GPT, Claude, Gemini, ecc.
- 🛠️ **Toolchain di Sviluppo**: Toolchain completa per sviluppo, test e distribuzione
- 🔒 **Sicurezza di Livello Enterprise**: Meccanismi di sicurezza completi, supporta struttura organizzativa e gestione permessi

## 🚀 Avvio Rapido

### I. Requisiti di Sistema

- Sistemi Operativi Supportati: macOS, Linux o Windows
- Docker e Docker Compose installati (fare riferimento alla sezione 3.3 per l'installazione di Docker)
- Connessione di rete (per scaricare immagini e rilevare IP pubblico)
- Git installato (per clonare il codice di Magic)

### II. Passi di Installazione

#### 2.1 Clona il Progetto

```bash
git clone git@github.com:dtyq/magic.git
cd magic
```

![git clone magic](https://public-cdn.letsmagic.cn/static/img/git_clone_magic.png)

#### 2.2. File di Configurazione

##### File di Configurazione Principali
- .env: File di configurazione principale delle variabili d'ambiente
- config/.env_super_magic: File di configurazione del servizio Super Magic (se scegli di installarlo)
- config/.env_magic_gateway: File di configurazione di Magic Gateway (se scegli di installare Super Magic)
- config/.env_sandbox_gateway: File di configurazione di Sandbox Gateway (se scegli di installare Super Magic)
- Per macOS/Linux, i file mancanti verranno copiati automaticamente durante l'installazione; gli utenti Windows devono copiarli e modificarli manualmente

##### Configura Manualmente i File e Modifica i Valori Richiesti
```bash
### Per usare Magic, copia .env.example in .env
sudo cp .env.example .env
```

##### Riferimento Configurazione Variabili Ambiente Magic:
https://docs.letsmagic.cn/en/development/deploy/environment.html

```bash
### Per usare i servizi Super Magic, copia i seguenti file:
sudo cp config/.env_super_magic.example config/.env_super_magic
sudo cp config/.env_magic_gateway.example config/.env_magic_gateway
sudo cp config/.env_sandbox_gateway.example config/.env_sandbox_gateway
```

##### Riferimento Configurazione Variabili Ambiente Super Magic:
https://docs.letsmagic.cn/en/development/deploy/super-magic.html

##### Configura IP (Opzionale)
Per il deployment su server remoto, modifica il file .env e sostituisci localhost con il tuo IP server nelle seguenti voci:
```
MAGIC_SOCKET_BASE_URL=ws://<server_IP>:9502
MAGIC_SERVICE_BASE_URL=http://<server_IP>:9501
```

Se scegli di installare il servizio Super Magic, assicurati che esistano i seguenti file di configurazione:
- config/.env_super_magic
- config/.env_magic_gateway
- config/.env_sandbox_gateway

Se config/.env_super_magic non esiste ma config/.env_super_magic.example sì, segui i prompt per copiare e modificare il file.

#### 2.3. Avvio Servizi su macOS/Linux

##### macOS/Linux
Esegui lo script di installazione:

```bash
sudo ./bin/magic.sh start
```

##### Windows
Gli utenti Windows possono saltare lo script magic.sh e usare direttamente i comandi docker compose:
In alternativa, puoi scaricare il tool Git [GUI](https://git-scm.com/downloads/win) per un'esperienza di installazione simile a Mac/Linux.

```bash
# Crea la rete necessaria
docker network create magic-sandbox-network

# Avvia servizi di base
docker compose up
```

Per avviare servizi correlati a Super Magic:

```bash
docker compose --profile magic-gateway --profile sandbox-gateway up
```

#### 2.4. Guida al Processo di Installazione

##### macOS/Linux
Lo script ti guiderà attraverso i seguenti passi:

###### Selezione Lingua
- Scegli 1 per Inglese
- Scegli 2 per Cinese
![Selezione Lingua](https://public-cdn.letsmagic.cn/static/img/chose_langugae.png)

###### Selezione Metodo di Deployment
- Scegli 1 per deployment su computer locale (usando configurazione localhost predefinita)
- Scegli 2 per deployment su server remoto (rileva IP pubblico e chiede se vuoi usarlo)
![Selezione Metodo di Deployment](https://public-cdn.letsmagic.cn/static/img/chose_development_method.png)

- Nota: Lo script controllerà se magic-sandbox-network è stato creato localmente. Se no, eseguirà automaticamente:
```bash
docker network create magic-sandbox-network
```

###### Installazione Servizio Super Magic
- Scegli 1 per installare il servizio Super Magic (richiede pre-configurazione dei file nella directory config/)
- Scegli 2 per non installare il servizio Super Magic
![Installazione Servizio Super Magic](https://public-cdn.letsmagic.cn/static/img/super_magic_service_install.png)

#### 2.5 Primo Avvio
Dopo il primo avvio, il sistema creerà un file bin/magic.lock (macOS/Linux), e gli avvii successivi salteranno il processo di configurazione di installazione.

### III. Utilizzo

#### 3.1 Comandi Comuni

##### macOS/Linux
```bash
sudo ./bin/magic.sh [command]
```

Comandi disponibili:
- start: Avvia servizi in primo piano
- daemon: Avvia servizi in background
- stop: Ferma tutti i servizi
- restart: Riavvia tutti i servizi
- status: Mostra stato servizi
- logs: Mostra log servizi
- super-magic: Avvia solo servizio Super Magic (primo piano)
- super-magic-daemon: Avvia solo servizio Super Magic (background)
- help: Mostra informazioni aiuto

##### Windows
Gli utenti Windows usano direttamente i comandi docker compose:

```bash
# Avvia servizi in primo piano
docker compose up

# Avvia servizi in background
docker compose up -d

# Ferma servizi
docker compose down

# Riavvia servizi
docker compose restart

# Controlla stato servizi
docker compose ps

# Visualizza log
docker compose logs -f

# Usa servizio Super Magic (primo piano)
docker compose --profile magic-gateway --profile sandbox-gateway up

# Usa servizio Super Magic (background)
docker compose --profile magic-gateway --profile sandbox-gateway up -d
```

#### 3.2 Esempi

##### Avvia Servizi
macOS/Linux:
```bash
./bin/magic.sh start
```

Windows:
```bash
docker compose up
```

##### Avvia Servizi in Background
macOS/Linux:
```bash
./bin/magic.sh daemon
```

Windows:
```bash
docker compose up -d
```

##### Controlla Stato Servizi
macOS/Linux:
```bash
./bin/magic.sh status
```

Windows:
```bash
docker compose ps
```

##### Visualizza Log
macOS/Linux:
```bash
./bin/magic.sh logs
```

Windows:
```bash
docker compose logs -f
```

#### 3.3 Installazione Docker

##### macOS
1. Visita https://docs.docker.com/desktop/install/mac-install/
2. Scarica e installa Docker Desktop per Mac
![Scarica e installa Docker Desktop per Mac](https://public-cdn.letsmagic.cn/static/img/install_docker_desktop_for_mac.png)

3. Avvia l'applicazione Docker Desktop
![Avvia l'applicazione Docker Desktop](https://public-cdn.letsmagic.cn/static/img/start_docker_desktop_application.png)

##### Linux
1. Visita https://docs.docker.com/engine/install/
2. Segui le istruzioni di installazione per la tua distribuzione Linux. Ecco un esempio per Ubuntu:
```bash
sudo apt update
# Aggiungi la chiave GPG ufficiale di Docker:
sudo apt-get update
sudo apt-get install ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

# Aggiungi il repository alle fonti Apt:
echo \
   "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
   $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}") stable" | \
   sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
```
    ![](https://public-cdn.letsmagic.cn/static/img/ubuntu_system_apt_get_update.png)
```bash
sudo apt-get install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```
    ![](https://public-cdn.letsmagic.cn/static/img/ubuntu_system_apt_get_install_docker.png)

3. Avvia il servizio Docker dopo l'installazione:
```bash
sudo systemctl start docker
```

##### Windows
1. Visita https://docs.docker.com/desktop/install/windows-install/
2. Scarica e installa Docker Desktop per Windows
![Scarica e installa Docker Desktop per Windows](https://public-cdn.letsmagic.cn/static/img/download_docker_desktop_for_windows.png)

3. Avvia l'applicazione Docker Desktop
4. Assicurati che il backend WSL 2 sia abilitato nelle impostazioni

### IV. Risoluzione Problemi

#### Problemi Comuni

1. **Docker Non in Esecuzione**
    - Assicurati che il servizio Docker sia avviato
    - macOS: Apri l'applicazione Docker Desktop
    - Linux: Esegui `sudo systemctl start docker`
    - Windows: Apri l'applicazione Docker Desktop, controlla l'icona nella barra delle applicazioni

2. **Conflitti di Porta**
    - Controlla se altri servizi usano le porte configurate
    - Modifica le configurazioni di porta nel file .env

3. **File di Configurazione Mancanti**
    - Segui i prompt per copiare i file di configurazione di esempio e apportare le modifiche necessarie

4. **Problemi di Rete**
    - Assicurati l'accesso a Docker Hub per scaricare le immagini
    - Controlla se le impostazioni del firewall bloccano l'accesso alla rete Docker

5. **Problemi Specifici Windows**
    - Assicurati che il supporto WSL 2 sia abilitato
    - Se si verificano problemi di permessi, prova a eseguire il prompt dei comandi come amministratore
    - Controlla se Windows Firewall blocca il traffico di rete Docker

6. **Visualizzazione Log**
    - Per problemi super-magic, controlla i log dei container che iniziano con sandbox-agent
    - Per problemi API, controlla i log del container magic-service
    - Per problemi UI frontend, controlla i log del container magic-web
    - Per problemi di cross-origin e altri problemi di rete, controlla i log del container magic-caddy

### V. Disinstallazione

Per disinstallare il sistema Magic:

1. Ferma e rimuovi tutti i container

    macOS/Linux:
    ```bash
    ./bin/magic.sh stop
    ```

    Windows:
    ```bash
    docker compose down
    ```

2. Rimuovi la rete Docker (se necessario)
    ```bash
    docker network rm magic-sandbox-network
    ```

3. Elimina la directory dei file persistenti ./volumes

## 📚 Documentazione

Per documentazione dettagliata, visita il [Centro Documentazione Magic](http://docs.letsmagic.cn/).

## 🤝 Contributi

Accogliamo contributi in varie forme, inclusi ma non limitati a:

- Invio di issue e suggerimenti
- Miglioramento della documentazione
- Invio di correzioni codice
- Contributo di nuove funzionalità

## 📞 Contattaci

- Email: bd@dtyq.com
- Sito Web: https://www.letsmagic.cn

## 🙏 Ringraziamenti

Grazie a tutti gli sviluppatori che hanno contribuito a Magic!

<div align="center">

[![Grafico Cronologia Stelle](https://api.star-history.com/svg?repos=dtyq/magic&type=Date)](https://star-history.com/#dtyq/magic&Date)

</div>

---

## Testo Originale in Inglese

# 🎩 Magic - Next Generation Enterprise AI Application Innovation Engine

<div align="center">

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
<!-- [![Docker Pulls](https://img.shields.io/docker/pulls/dtyq/magic.svg)](https://hub.docker.com/r/dtyq/magic)
[![GitHub stars](https://img.shields.io/github/stars/dtyq/magic.svg?style=social&label=Star)](https://github.com/dtyq/magic) -->

</div>

Magic is a powerful enterprise-grade AI application innovation engine designed to help developers quickly build and deploy AI applications. It provides a complete development framework, rich toolchain, and best practices, making AI application development simple and efficient.

![flow](https://cdn.letsmagic.cn/static/img/showmagic.jpg)

## ✨ Features

- 🚀 **High-Performance Architecture**: Developed with PHP+Swow+hyperf, providing excellent performance and scalability
- 🧩 **Modular Design**: Flexible plugin system, supporting rapid extension and customization
- 🔌 **Multi-Model Support**: Seamless integration with mainstream AI models, including GPT, Claude, Gemini, etc.
- 🛠️ **Development Toolchain**: Complete development, testing, and deployment toolchain
- 🔒 **Enterprise-Grade Security**: Comprehensive security mechanisms, supporting organizational structure and permission management

## 🚀 Quick Start

### I. System Requirements

- Supported Operating Systems: macOS, Linux, or Windows
- Docker and Docker Compose installed (refer to section 3.3 for Docker installation)
- Network connection (for pulling images and detecting public IP)
- Git installed (for cloning Magic code)

### II. Installation Steps

#### 2.1 Clone the Project

```bash
git clone git@github.com:dtyq/magic.git
cd magic
```

![git clone magic](https://public-cdn.letsmagic.cn/static/img/git_clone_magic.png)

#### 2.2. Configuration Files

##### Main Configuration Files
- .env: Main environment variables configuration file
- config/.env_super_magic: Super Magic service configuration file (if you choose to install)
- config/.env_magic_gateway: Magic Gateway configuration file (if you choose to install Super Magic)
- config/.env_sandbox_gateway: Sandbox Gateway configuration file (if you choose to install Super Magic)
- For macOS/Linux, missing files will be automatically copied during installation; Windows users need to manually copy and modify them

##### Manually Configure Files and Modify Required Values
```bash
### To use Magic, copy .env.example to .env
sudo cp .env.example .env
```

##### Magic Environment Variables Configuration Reference:
https://docs.letsmagic.cn/en/development/deploy/environment.html

```bash
### To use Super Magic services, copy the following files:
sudo cp config/.env_super_magic.example config/.env_super_magic
sudo cp config/.env_magic_gateway.example config/.env_magic_gateway
sudo cp config/.env_sandbox_gateway.example config/.env_sandbox_gateway
```

##### Super Magic Environment Variables Configuration Reference:
https://docs.letsmagic.cn/en/development/deploy/super-magic.html

##### Configure IP (Optional)
For remote server deployment, edit the .env file and replace localhost with your server IP in the following entries:
```
MAGIC_SOCKET_BASE_URL=ws://<server_IP>:9502
MAGIC_SERVICE_BASE_URL=http://<server_IP>:9501
```

If you choose to install Super Magic service, ensure the following configuration files exist:
- config/.env_super_magic
- config/.env_magic_gateway
- config/.env_sandbox_gateway

If config/.env_super_magic doesn't exist but config/.env_super_magic.example does, follow the prompts to copy and edit the file.

#### 2.3. Starting Services on macOS/Linux

##### macOS/Linux
Run the installation script:

```bash
sudo ./bin/magic.sh start
```

##### Windows
Windows users can skip the magic.sh script and use docker compose commands directly:
Alternatively, you can download the Git [GUI tool](https://git-scm.com/downloads/win) for an installation experience similar to Mac/Linux.

```bash
# Create necessary network
docker network create magic-sandbox-network

# Start basic services
docker compose up
```

To start Super Magic related services:

```bash
docker compose --profile magic-gateway --profile sandbox-gateway up
```

#### 2.4. Installation Process Guide

##### macOS/Linux
The script will guide you through the following steps:

###### Language Selection
- Choose 1 for English
- Choose 2 for Chinese
![Language Selection](https://public-cdn.letsmagic.cn/static/img/chose_langugae.png)

###### Deployment Method Selection
- Choose 1 for local computer deployment (using default localhost configuration)
- Choose 2 for remote server deployment (will detect public IP and ask if you want to use it)
![Deployment Method Selection](https://public-cdn.letsmagic.cn/static/img/chose_development_method.png)

- Note: The script will check if magic-sandbox-network has been created locally. If not, it will automatically execute:
```bash
docker network create magic-sandbox-network
```

###### Super Magic Service Installation
- Choose 1 to install Super Magic service (requires pre-configuration of files in the config/ directory)
- Choose 2 to not install Super Magic service
![Super Magic Service Installation](https://public-cdn.letsmagic.cn/static/img/super_magic_service_install.png)

#### 2.5 First Run
After the first run, the system will create a bin/magic.lock file (macOS/Linux), and subsequent startups will skip the installation configuration process.

### III. Usage

#### 3.1 Common Commands

##### macOS/Linux
```bash
sudo ./bin/magic.sh [command]
```

Available commands:
- start: Start services in foreground
- daemon: Start services in background
- stop: Stop all services
- restart: Restart all services
- status: Display service status
- logs: Display service logs
- super-magic: Start only Super Magic service (foreground)
- super-magic-daemon: Start only Super Magic service (background)
- help: Display help information

##### Windows
Windows users use docker compose commands directly:

```bash
# Start services in foreground
docker compose up

# Start services in background
docker compose up -d

# Stop services
docker compose down

# Restart services
docker compose restart

# Check service status
docker compose ps

# View logs
docker compose logs -f

# Use Super Magic service (foreground)
docker compose --profile magic-gateway --profile sandbox-gateway up

# Use Super Magic service (background)
docker compose --profile magic-gateway --profile sandbox-gateway up -d
```

#### 3.2 Examples

##### Start Services
macOS/Linux:
```bash
./bin/magic.sh start
```

Windows:
```bash
docker compose up
```

##### Start Services in Background
macOS/Linux:
```bash
./bin/magic.sh daemon
```

Windows:
```bash
docker compose up -d
```

##### Check Service Status
macOS/Linux:
```bash
./bin/magic.sh status
```

Windows:
```bash
docker compose ps
```

##### View Logs
macOS/Linux:
```bash
./bin/magic.sh logs
```

Windows:
```bash
docker compose logs -f
```

#### 3.3 Installing Docker

##### macOS
1. Visit https://docs.docker.com/desktop/install/mac-install/
2. Download and install Docker Desktop for Mac
![Download and install Docker Desktop for Mac](https://public-cdn.letsmagic.cn/static/img/install_docker_desktop_for_mac.png)

3. Launch the Docker Desktop application
![Launch the Docker Desktop application](https://public-cdn.letsmagic.cn/static/img/start_docker_desktop_application.png)

##### Linux
1. Visit https://docs.docker.com/engine/install/
2. Follow the installation instructions for your Linux distribution. Here's an example for Ubuntu:
```bash
sudo apt update
# Add Docker's official GPG key:
sudo apt-get update
sudo apt-get install ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

# Add the repository to Apt sources:
echo \
   "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
   $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}") stable" | \
   sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
```
    ![](https://public-cdn.letsmagic.cn/static/img/ubuntu_system_apt_get_update.png)
```bash
sudo apt-get install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```
    ![](https://public-cdn.letsmagic.cn/static/img/ubuntu_system_apt_get_install_docker.png)

3. Start Docker service after installation:
```bash
sudo systemctl start docker
```

##### Windows
1. Visit https://docs.docker.com/desktop/install/windows-install/
2. Download and install Docker Desktop for Windows
![Download and install Docker Desktop for Windows](https://public-cdn.letsmagic.cn/static/img/download_docker_desktop_for_windows.png)

3. Launch the Docker Desktop application
4. Make sure WSL 2 backend is enabled in settings

### IV. Troubleshooting

#### Common Issues

1. **Docker Not Running**
    - Ensure Docker service is started
    - macOS: Open Docker Desktop application
    - Linux: Run `sudo systemctl start docker`
    - Windows: Open Docker Desktop application, check system tray icon

2. **Port Conflicts**
    - Check if other services are using the ports configured
    - Modify port configurations in the .env file

3. **Missing Configuration Files**
    - Follow the prompts to copy example configuration files and make necessary edits

4. **Network Issues**
    - Ensure access to Docker Hub to pull images
    - Check if firewall settings are blocking Docker network access

5. **Windows-Specific Issues**
    - Ensure WSL 2 support is enabled
    - If permission issues occur, try running the command prompt as administrator
    - Check if Windows Firewall is blocking Docker network traffic

6. **Log Viewing**
    - For super-magic issues, check container logs starting with sandbox-agent
    - For API issues, check magic-service container logs
    - For frontend UI issues, check magic-web container logs
    - For cross-origin and other network issues, check magic-caddy container logs

### V. Uninstallation

To uninstall Magic system:

1. Stop and remove all containers

    macOS/Linux:
    ```bash
    ./bin/magic.sh stop
    ```

    Windows:
    ```bash
    docker compose down
    ```

2. Remove Docker network (if needed)
    ```bash
    docker network rm magic-sandbox-network
    ```

3. Delete persistent file directory ./volumes

## 📚 Documentation

For detailed documentation, please visit [Magic Documentation Center](http://docs.letsmagic.cn/).

## 🤝 Contribution

We welcome contributions in various forms, including but not limited to:

- Submitting issues and suggestions
- Improving documentation
- Submitting code fixes
- Contributing new features

## 📞 Contact Us

- Email: bd@dtyq.com
- Website: https://www.letsmagic.cn

## 🙏 Acknowledgements

Thanks to all developers who have contributed to Magic!

<div align="center">

[![Star History Chart](https://api.star-history.com/svg?repos=dtyq/magic&type=Date)](https://star-history.com/#dtyq/magic&Date)

</div>
