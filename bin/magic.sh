#!/bin/bash

# Detect system default language
detect_language() {
  # Default to English
  DEFAULT_LANG="en"
  
  # Get system language settings
  if [[ "$(uname -s)" == "Darwin" ]]; then
    # macOS system
    SYS_LANG=$(defaults read -g AppleLocale 2>/dev/null || echo "en_US")
  else
    # Linux and other systems
    SYS_LANG=$(echo $LANG || echo $LC_ALL || echo $LC_MESSAGES || echo "en_US.UTF-8")
  fi
  
  # If language code starts with zh_, set to Chinese, otherwise use English
  if [[ $SYS_LANG == zh_* ]]; then
    DEFAULT_LANG="zh"
  fi
  
  echo $DEFAULT_LANG
}

# Get system language
SYSTEM_LANG=$(detect_language)

# Bilingual prompt function
# Usage: bilingual "Chinese message" "English message"
bilingual() {
  if [ "$USER_LANG" = "zh" ]; then
    echo "$1"
  else
    echo "$2"
  fi
}

# Check if Super Magic environment file exists
check_super_magic_env() {
    local missing_files=()
    local config_files=(
        "config/.env_super_magic"
        "config/config.yaml"
        "config/.env_magic_gateway"
        "config/.env_sandbox_gateway"
    )
    local example_files=(
        "config/.env_super_magic.example"
        "config/config.yaml.example"
    )
    
    # 检查必要的配置文件
    for file in "${config_files[@]}"; do
        if [ ! -f "$file" ]; then
            # 对于前两个文件，检查是否有示例文件可以复制
            if [[ "$file" == "config/.env_super_magic" || "$file" == "config/config.yaml" ]]; then
                example_file="${file}.example"
                if [ -f "$example_file" ]; then
                    if [[ "$file" == "config/config.yaml" ]]; then
                        bilingual "注意：$file 文件不存在，正在从示例文件复制..." "Note: $file file does not exist, copying from example file..."
                        cp "$example_file" "$file"
                        bilingual "已复制 $example_file 到 $file" "Copied $example_file to $file"
                    else
                        missing_files+=("$file")
                    fi
                else
                    missing_files+=("$file")
                fi
            else
                missing_files+=("$file")
            fi
        fi
    done
    
    # 如果有缺失文件，显示错误信息
    if [ ${#missing_files[@]} -gt 0 ]; then
        bilingual "错误：以下配置文件不存在：" "Error: The following configuration files do not exist:"
        for file in "${missing_files[@]}"; do
            echo "- $file"
        done
        
        bilingual "请按照以下步骤创建缺失的配置文件：" "Please follow these steps to create the missing configuration files:"
        
        # 给出针对性的指导
        if [[ " ${missing_files[*]} " =~ " config/.env_super_magic " ]]; then
            if [ -f "config/.env_super_magic.example" ]; then
                bilingual "- 对于Super Magic配置：" "-  For Super Magic configuration:"
                bilingual "   - 复制示例配置文件：cp config/.env_super_magic.example config/.env_super_magic" "   - Copy the example configuration file: cp config/.env_super_magic.example config/.env_super_magic"
                bilingual "   - 编辑配置文件：vim config/.env_super_magic（或使用您喜欢的编辑器）" "   - Edit the configuration file: vim config/.env_super_magic (or use your preferred editor)"
                bilingual "   - 设置必要的环境变量，如API密钥、服务地址等" "   - Set the necessary environment variables such as API keys, service addresses, etc."
            else
                bilingual "- 对于Super Magic配置：" "- For Super Magic configuration:"
                bilingual "   - config/.env_super_magic.example 示例文件也不存在" "   - The config/.env_super_magic.example example file is also missing"
            fi
        fi
        
        if [[ " ${missing_files[*]} " =~ " config/config.yaml " ]]; then
            if [ -f "config/config.yaml.example" ]; then
                bilingual "- 对于系统配置：" "- For system configuration:"
                bilingual "   - 复制示例配置文件：cp config/config.yaml.example config/config.yaml" "   - Copy the example configuration file: cp config/config.yaml.example config/config.yaml"
                bilingual "   - 编辑配置文件：vim config/config.yaml（或使用您喜欢的编辑器）" "   - Edit the configuration file: vim config/config.yaml (or use your preferred editor)"
                bilingual "   - 根据您的环境设置适当的参数" "   - Set appropriate parameters according to your environment"
            else
                bilingual "- 对于系统配置：" "- For system configuration:"
                bilingual "   - config/config.yaml.example 示例文件也不存在" "   - The config/config.yaml.example example file is also missing"
            fi
        fi
        
        if [[ " ${missing_files[*]} " =~ " config/.env_magic_gateway " ]]; then
            bilingual "- 对于Magic Gateway配置：" "- For Magic Gateway configuration:"
            bilingual "   - 创建配置文件：cp config/.env_magic_gateway.example config/.env_magic_gateway" "   - Create the configuration file: cp config/.env_magic_gateway.example config/.env_magic_gateway"
            bilingual "   - 编辑配置文件：vim config/.env_magic_gateway（或使用您喜欢的编辑器）" "   - Edit the configuration file: vim config/.env_magic_gateway (or use your preferred editor)"
            bilingual "   - 添加必要的网关配置参数，如端口、路由规则等" "   - Add necessary gateway configuration parameters such as ports, routing rules, etc."
        fi
        
        if [[ " ${missing_files[*]} " =~ " config/.env_sandbox_gateway " ]]; then
            bilingual "- 对于Sandbox Gateway配置：" "- For Sandbox Gateway configuration:"
            bilingual "   - 创建配置文件：cp config/.env_sandbox_gateway.example config/.env_sandbox_gateway" "   - Create the configuration file: cp config/.env_sandbox_gateway.example config/.env_sandbox_gateway"
            bilingual "   - 编辑配置文件：vim config/.env_sandbox_gateway（或使用您喜欢的编辑器）" "   - Edit the configuration file: vim config/.env_sandbox_gateway (or use your preferred editor)"
            bilingual "   - 添加必要的沙盒网关配置参数，如端口、安全设置等" "   - Add necessary sandbox gateway configuration parameters such as ports, security settings, etc."
        fi
        
        bilingual "完成上述步骤后，再次运行此脚本。" "After completing the above steps, run this script again."
        return 1
    fi
    
    return 0
}

# Check if lock file exists - if it does, set default values and skip installation process
if [ -f "bin/magic.lock" ]; then
    # 尝试从lock文件中读取用户选择的语言
    if [ -f "bin/user_lang" ]; then
        USER_LANG=$(cat bin/user_lang)
    else
        USER_LANG=$SYSTEM_LANG
    fi
    SKIP_LANGUAGE_SELECTION=true
    SKIP_INSTALLATION=true
    
    # 检查是否存在super-magic配置文件，如果存在则自动设置MAGIC_USE_SUPER_MAGIC
    if [ -f "bin/use_super_magic" ]; then
        # 直接使用固定的配置参数，而不是从文件读取内容
        export MAGIC_USE_SUPER_MAGIC=" --profile magic-gateway --profile sandbox-gateway"
        bilingual "检测到Super Magic配置，将自动启动Super Magic相关服务" "Super Magic configuration detected, Super Magic related services will be started automatically"
    else
        export MAGIC_USE_SUPER_MAGIC=""
    fi
else
    SKIP_LANGUAGE_SELECTION=false
    SKIP_INSTALLATION=false
fi

# Let the user choose the language only if not skipped
if [ "$SKIP_LANGUAGE_SELECTION" = "false" ]; then
  choose_language() {
    echo "Please select your preferred language / 请选择您偏好的语言:"
    echo "1. English"
    echo "2. 中文"
    read -p "Enter your choice / 输入您的选择 [1/2] (default: $SYSTEM_LANG): " LANG_CHOICE
    
    if [ -z "$LANG_CHOICE" ]; then
      USER_LANG=$SYSTEM_LANG
    elif [ "$LANG_CHOICE" = "1" ]; then
      USER_LANG="en"
    elif [ "$LANG_CHOICE" = "2" ]; then
      USER_LANG="zh"
    else
      echo "Invalid choice, using system detected language: $SYSTEM_LANG"
      echo "无效的选择，使用系统检测到的语言：$SYSTEM_LANG"
      USER_LANG=$SYSTEM_LANG
    fi
    
    echo "Selected language / 已选择语言: $([ "$USER_LANG" = "en" ] && echo "English" || echo "中文")"
    echo ""
    
    # 保存用户选择的语言到文件
    echo "$USER_LANG" > bin/user_lang
  }

  # Run language selection
  choose_language
else
  bilingual "使用之前选择的语言: $([ "$USER_LANG" = "en" ] && echo "English" || echo "中文")" "Using previously selected language: $([ "$USER_LANG" = "en" ] && echo "English" || echo "中文")"
fi

# Check if lock file exists - if it does, set default values and skip installation process
if [ "$SKIP_INSTALLATION" = "true" ]; then
    bilingual "检测到 magic.lock 文件，跳过安装配置流程..." "Detected magic.lock file, skipping installation configuration..."
    
    # Set default values for required variables
    if [ -f ".env_super_magic" ]; then
        export MAGIC_USE_SUPER_MAGIC=""
    else
        export MAGIC_USE_SUPER_MAGIC=""
    fi
fi

# Only run installation steps if not skipped
if [ "$SKIP_INSTALLATION" = "false" ]; then
    # Check if Docker is installed
    if ! command -v docker &> /dev/null; then
        bilingual "错误: Docker 未安装。" "Error: Docker is not installed."
        bilingual "请先安装 Docker:" "Please install Docker first:"
        if [ "$(uname -s)" == "Darwin" ]; then
            bilingual "1. 访问 https://docs.docker.com/desktop/install/mac-install/" "1. Visit https://docs.docker.com/desktop/install/mac-install/"
            bilingual "2. 下载并安装 Docker Desktop for Mac" "2. Download and install Docker Desktop for Mac"
        elif [ "$(uname -s)" == "Linux" ]; then
            bilingual "1. 访问 https://docs.docker.com/engine/install/" "1. Visit https://docs.docker.com/engine/install/"
            bilingual "2. 按照您的 Linux 发行版安装说明进行操作" "2. Follow the installation instructions for your Linux distribution"
        else
            bilingual "请访问 https://docs.docker.com/get-docker/ 获取安装指南" "Please visit https://docs.docker.com/get-docker/ for installation instructions"
        fi
        exit 1
    fi

    # Check if Docker is running
    if ! docker info &> /dev/null; then
        bilingual "错误: Docker 未运行。" "Error: Docker is not running."
        bilingual "请启动 Docker 并重试。" "Please start Docker and try again."
        if [ "$(uname -s)" == "Darwin" ]; then
            bilingual "1. 打开 Docker Desktop" "1. Open Docker Desktop"
            bilingual "2. 等待 Docker 启动" "2. Wait for Docker to start"
        elif [ "$(uname -s)" == "Linux" ]; then
            bilingual "1. 启动 Docker 服务: sudo systemctl start docker" "1. Start Docker service: sudo systemctl start docker"
        fi
        exit 1
    fi

    # Check if docker-compose is installed
    if ! command -v docker-compose &> /dev/null; then
        bilingual "错误: docker-compose 未安装。" "Error: docker-compose is not installed."
        bilingual "请先安装 docker-compose:" "Please install docker-compose first:"
        if [ "$(uname -s)" == "Darwin" ]; then
            bilingual "1. Docker Desktop for Mac 默认包含 docker-compose" "1. Docker Desktop for Mac includes docker-compose by default"
            bilingual "2. 如果您使用的是旧版本，请访问 https://docs.docker.com/compose/install/" "2. If you're using an older version, visit https://docs.docker.com/compose/install/"
        elif [ "$(uname -s)" == "Linux" ]; then
            bilingual "1. 访问 https://docs.docker.com/compose/install/" "1. Visit https://docs.docker.com/compose/install/"
            bilingual "2. 按照您的 Linux 发行版安装说明进行操作" "2. Follow the installation instructions for your Linux distribution"
            bilingual "   例如，在 Ubuntu/Debian 上:" "   For example, on Ubuntu/Debian:"
            echo "   sudo apt-get update"
            echo "   sudo apt-get install docker-compose-plugin"
        else
            bilingual "请访问 https://docs.docker.com/compose/install/ 获取安装指南" "Please visit https://docs.docker.com/compose/install/ for installation instructions"
        fi
        exit 1
    fi

    # Detect system architecture
    ARCH=$(uname -m)
    case $ARCH in
        x86_64)
            export PLATFORM=linux/amd64
            ;;
        aarch64|arm64|armv7l)
            export PLATFORM=linux/arm64
            ;;
        *)
            bilingual "不支持的架构: $ARCH" "Unsupported architecture: $ARCH"
            exit 1
            ;;
    esac

    # Do not set PLATFORM if using macOS arm64
    if [ "$(uname -s)" == "Darwin" ] && [ "$(uname -m)" == "arm64" ]; then
        export PLATFORM=""
    fi

    bilingual "检测到架构: $ARCH，使用平台: $PLATFORM" "Detected architecture: $ARCH, using platform: $PLATFORM"

    # Check if .env exists, if not copy .env.example to .env
    if [ ! -f .env ]; then
        cp .env.example .env
    fi

    # Modify PLATFORM variable in .env
    if [ -n "$PLATFORM" ]; then
        if [ "$(uname -s)" == "Darwin" ]; then
            # macOS version
            sed -i '' "s/^PLATFORM=.*/PLATFORM=$PLATFORM/" .env
        else
            # Linux version
            sed -i "s/^PLATFORM=.*/PLATFORM=$PLATFORM/" .env
        fi
    else
        # If PLATFORM is empty, set it to an empty string
        if [ "$(uname -s)" == "Darwin" ]; then
            sed -i '' "s/^PLATFORM=.*/PLATFORM=/" .env
        else
            sed -i "s/^PLATFORM=.*/PLATFORM=/" .env
        fi
    fi

    # Ask if Super Magic service should be installed
    ask_super_magic() {
        bilingual "是否安装Super Magic服务?" "Do you want to install Super Magic service?"
        bilingual "1. 是，安装Super Magic服务" "1. Yes, install Super Magic service"
        bilingual "2. 否，不安装Super Magic服务" "2. No, don't install Super Magic service"
        read -p "$(bilingual "请输入选项编号 [1/2]: " "Please enter option number [1/2]: ")" SUPER_MAGIC_OPTION
        
        if [ "$SUPER_MAGIC_OPTION" = "1" ]; then
            bilingual "您选择了安装Super Magic服务。" "You have chosen to install Super Magic service."
            
            # Check if all required config files exist
            if ! check_super_magic_env; then
                exit 1
            fi
            
            # Add profiles for super-magic, magic-gateway and sandbox-gateway
            export MAGIC_USE_SUPER_MAGIC=" --profile magic-gateway --profile sandbox-gateway"
            # 记录super-magic配置，在下次启动时自动加载
            echo "$MAGIC_USE_SUPER_MAGIC" > bin/use_super_magic
            bilingual "Super Magic、Magic Gateway 和 Sandbox Gateway 服务将被启动。" "Super Magic, Magic Gateway and Sandbox Gateway services will be started."
            bilingual "已记录您的选择，下次启动将自动加载Super Magic相关服务。" "Your choice has been recorded, Super Magic related services will be loaded automatically next time."
        else
            bilingual "您选择了不安装Super Magic服务。" "You have chosen not to install Super Magic service."
            export MAGIC_USE_SUPER_MAGIC=""
            # 如果存在之前的super-magic配置文件，则删除
            if [ -f "bin/use_super_magic" ]; then
                rm bin/use_super_magic
            fi
        fi
    }

    # Detect public IP and update environment variables
    detect_public_ip() {
        # Ask user about deployment method
        bilingual "请选择您的部署方式:" "Please select your deployment method:"
        bilingual "1. 本地电脑部署" "1. Local deployment"
        bilingual "2. 远程服务器部署" "2. Remote server deployment"
        read -p "$(bilingual "请输入选项编号 [1/2]: " "Please enter option number [1/2]: ")" DEPLOYMENT_TYPE
        
        # If user chooses local deployment, do not update IP
        if [ "$DEPLOYMENT_TYPE" = "1" ]; then
            bilingual "已选择本地部署，保持默认设置。" "Local deployment selected, keeping default settings."
            return 0
        elif [ "$DEPLOYMENT_TYPE" != "2" ]; then
            bilingual "无效的选项，默认使用本地部署。" "Invalid option, using local deployment by default."
            return 0
        fi
        
        bilingual "正在检测公网IP..." "Detecting public IP..."
        
        # Try multiple methods to get public IP
        PUBLIC_IP=""
        
        # Method 1: Using ipinfo.io
        if [ -z "$PUBLIC_IP" ]; then
            PUBLIC_IP=$(curl -s https://ipinfo.io/ip 2>/dev/null)
            if [ -z "$PUBLIC_IP" ] || [[ $PUBLIC_IP == *"html"* ]]; then
                PUBLIC_IP=""
            fi
        fi
        
        # Method 2: Using ip.sb
        if [ -z "$PUBLIC_IP" ]; then
            PUBLIC_IP=$(curl -s https://api.ip.sb/ip 2>/dev/null)
            if [ -z "$PUBLIC_IP" ] || [[ $PUBLIC_IP == *"html"* ]]; then
                PUBLIC_IP=""
            fi
        fi
        
        # Method 3: Using ipify
        if [ -z "$PUBLIC_IP" ]; then
            PUBLIC_IP=$(curl -s https://api.ipify.org 2>/dev/null)
            if [ -z "$PUBLIC_IP" ] || [[ $PUBLIC_IP == *"html"* ]]; then
                PUBLIC_IP=""
            fi
        fi
        
        # If successfully obtained public IP, ask user whether to use this IP
        if [ -n "$PUBLIC_IP" ]; then
            bilingual "检测到公网IP: $PUBLIC_IP" "Detected public IP: $PUBLIC_IP"
            bilingual "是否使用此IP更新配置?" "Do you want to use this IP for configuration?"
            read -p "$(bilingual "请输入 [y/n]: " "Please enter [y/n]: ")" USE_DETECTED_IP
            
            if [[ "$USE_DETECTED_IP" =~ ^[Yy]$ ]]; then
                bilingual "正在更新环境变量..." "Updating environment variables..."
                
                # Update MAGIC_SOCKET_BASE_URL and MAGIC_SERVICE_BASE_URL
                if [ "$(uname -s)" == "Darwin" ]; then
                    # macOS version
                    sed -i '' "s|^MAGIC_SOCKET_BASE_URL=ws://localhost:9502|MAGIC_SOCKET_BASE_URL=ws://$PUBLIC_IP:9502|" .env
                    sed -i '' "s|^MAGIC_SERVICE_BASE_URL=http://localhost:9501|MAGIC_SERVICE_BASE_URL=http://$PUBLIC_IP:9501|" .env
                else
                    # Linux version
                    sed -i "s|^MAGIC_SOCKET_BASE_URL=ws://localhost:9502|MAGIC_SOCKET_BASE_URL=ws://$PUBLIC_IP:9502|" .env
                    sed -i "s|^MAGIC_SERVICE_BASE_URL=http://localhost:9501|MAGIC_SERVICE_BASE_URL=http://$PUBLIC_IP:9501|" .env
                fi
                
                bilingual "环境变量已更新:" "Environment variables updated:"
                echo "MAGIC_SOCKET_BASE_URL=ws://$PUBLIC_IP:9502"
                echo "MAGIC_SERVICE_BASE_URL=http://$PUBLIC_IP:9501"
            else
                bilingual "保持默认设置。" "Keeping default settings."
            fi
        else
            bilingual "未能检测到公网IP。" "Failed to detect public IP."
            bilingual "是否手动输入IP地址?" "Do you want to manually enter an IP address?"
            read -p "$(bilingual "请输入 [y/n]: " "Please enter [y/n]: ")" MANUAL_IP
            
            if [[ "$MANUAL_IP" =~ ^[Yy]$ ]]; then
                read -p "$(bilingual "请输入IP地址: " "Please enter IP address: ")" MANUAL_IP_ADDRESS
                
                if [ -n "$MANUAL_IP_ADDRESS" ]; then
                    bilingual "正在使用IP: $MANUAL_IP_ADDRESS 更新环境变量..." "Updating environment variables with IP: $MANUAL_IP_ADDRESS..."
                    
                    # Update MAGIC_SOCKET_BASE_URL and MAGIC_SERVICE_BASE_URL
                    if [ "$(uname -s)" == "Darwin" ]; then
                        # macOS version
                        sed -i '' "s|^MAGIC_SOCKET_BASE_URL=ws://localhost:9502|MAGIC_SOCKET_BASE_URL=ws://$MANUAL_IP_ADDRESS:9502|" .env
                        sed -i '' "s|^MAGIC_SERVICE_BASE_URL=http://localhost:9501|MAGIC_SERVICE_BASE_URL=http://$MANUAL_IP_ADDRESS:9501|" .env
                    else
                        # Linux version
                        sed -i "s|^MAGIC_SOCKET_BASE_URL=ws://localhost:9502|MAGIC_SOCKET_BASE_URL=ws://$MANUAL_IP_ADDRESS:9502|" .env
                        sed -i "s|^MAGIC_SERVICE_BASE_URL=http://localhost:9501|MAGIC_SERVICE_BASE_URL=http://$MANUAL_IP_ADDRESS:9501|" .env
                    fi
                    
                    bilingual "环境变量已更新:" "Environment variables updated:"
                    echo "MAGIC_SOCKET_BASE_URL=ws://$MANUAL_IP_ADDRESS:9502"
                    echo "MAGIC_SERVICE_BASE_URL=http://$MANUAL_IP_ADDRESS:9501"
                else
                    bilingual "IP地址为空，保持默认设置。" "IP address is empty, keeping default settings."
                fi
            else
                bilingual "保持默认设置。" "Keeping default settings."
            fi
        fi
    }
    
    detect_public_ip
    
    # Ask if Super Magic service should be installed
    ask_super_magic
    
    # Create lock file to skip installation next time
    touch bin/magic.lock
    bilingual "已创建 magic.lock 文件，下次启动将跳过安装配置流程。" "Created magic.lock file, next startup will skip installation configuration."
fi

# Show help information
show_help() {
    bilingual "用法: $0 [命令]" "Usage: $0 [command]"
    echo ""
    bilingual "命令:" "Commands:"
    bilingual "  start             启动服务(前台)" "  start             Start services in foreground"
    bilingual "  stop              停止所有服务" "  stop              Stop all services"
    bilingual "  daemon            后台启动服务" "  daemon            Start services in background"
    bilingual "  restart           重启所有服务" "  restart           Restart all services"
    bilingual "  status            显示服务状态" "  status            Show services status"
    bilingual "  logs              显示服务日志" "  logs              Show services logs"
    bilingual "  super-magic       仅启动Super Magic服务(前台)" "  super-magic       Start only Super Magic service (foreground)"
    bilingual "  super-magic-daemon 仅启动Super Magic服务(后台)" "  super-magic-daemon Start only Super Magic service (background)"
    echo ""
    bilingual "如果未提供命令，默认使用 'start'" "If no command is provided, 'start' will be used by default."
}

# Start services
start_services() {
    bilingual "正在前台启动服务..." "Starting services in foreground..."
    if [ -f "bin/use_super_magic" ]; then
        # 直接使用profile参数启动
        docker-compose  --profile super-magic --profile  magic-gateway --profile sandbox-gateway up
    else
        docker-compose up
    fi
}

# Stop services
stop_services() {
    bilingual "正在停止服务..." "Stopping services..."
    if [ -f "bin/use_super_magic" ]; then
        docker-compose --profile super-magic --profile  magic-gateway --profile sandbox-gateway down
    else
        docker-compose down
    fi
}

# Start services in background
start_daemon() {
    bilingual "正在后台启动服务..." "Starting services in background..."
    if [ -f "bin/use_super_magic" ]; then
        docker-compose --profile super-magic --profile  magic-gateway --profile sandbox-gateway up -d
    else
        docker-compose up -d
    fi
}

# Restart services
restart_services() {
    bilingual "正在重启服务..." "Restarting services..."
    if [ -f "bin/use_super_magic" ]; then
        docker-compose --profile super-magic --profile  magic-gateway --profile sandbox-gateway restart
    else
        docker-compose restart
    fi
}

# Show services status
show_status() {
    bilingual "服务状态:" "Services status:"
    docker-compose $MAGIC_USE_SUPER_MAGIC ps
}

# Show services logs
show_logs() {
    bilingual "显示服务日志:" "Showing services logs:"
    docker-compose $MAGIC_USE_SUPER_MAGIC logs -f
}

# Start only Super Magic service
start_super_magic() {
    # Check if all required config files exist
    if ! check_super_magic_env; then
        exit 1
    fi

    bilingual "正在前台启动Super Magic服务和Gateway服务..." "Starting Super Magic service and Gateway services in foreground..."
    docker-compose  --profile magic-gateway --profile sandbox-gateway up
}

# Start only Super Magic service in background
start_super_magic_daemon() {
    # Check if all required config files exist
    if ! check_super_magic_env; then
        exit 1
    fi

    bilingual "正在后台启动Super Magic服务和Gateway服务..." "Starting Super Magic service and Gateway services in background..."
    docker-compose  --profile magic-gateway --profile sandbox-gateway up -d
}

# Handle command line arguments
case "$1" in
    start)
        start_services
        ;;
    stop)
        stop_services
        ;;
    daemon)
        start_daemon
        ;;
    restart)
        restart_services
        ;;
    status)
        show_status
        ;;
    logs)
        show_logs
        ;;
    super-magic)
        start_super_magic
        ;;
    super-magic-daemon)
        start_super_magic_daemon
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        if [ -z "$1" ]; then
            start_services
        else
            bilingual "未知命令: $1" "Unknown command: $1"
            show_help
            exit 1
        fi
        ;;
esac 
