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
docker network create sandbox-network

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

- Note: The script will check if sandbox-network has been created locally. If not, it will automatically execute:
```bash
docker network create sandbox-network
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
   docker network rm sandbox-network
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
