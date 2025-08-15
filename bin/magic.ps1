# Magic PowerShell启动脚本 - Windows版本

# 处理命令行参数
param(
    [Parameter(Position=0)]
    [string]$Command = "start"
)

# 检测系统默认语言
function Detect-Language {
    $DEFAULT_LANG = "en"
    
    # 获取系统语言设置
    $SYS_LANG = (Get-Culture).Name
    
    # 如果语言代码以zh开头，设置为中文，否则使用英文
    if ($SYS_LANG -match "^zh") {
        $DEFAULT_LANG = "zh"
    }
    
    return $DEFAULT_LANG
}

# 获取系统语言
$SYSTEM_LANG = Detect-Language

# 双语提示函数
# 用法: Bilingual "中文消息" "English message"
function Bilingual {
    param(
        [string]$Chinese,
        [string]$English
    )
    
    if ($script:USER_LANG -eq "zh") {
        return $Chinese
    } else {
        return $English
    }
}

# 检查Super Magic环境文件是否存在
function Check-SuperMagicEnv {
    if (-not (Test-Path "config\.env_super_magic")) {
        if (Test-Path "config\.env_super_magic.example") {
            Write-Host (Bilingual "错误：config\.env_super_magic 文件不存在！" "Error: config\.env_super_magic file does not exist!")
            Write-Host (Bilingual "请按照以下步骤进行操作：" "Please follow these steps:")
            Write-Host (Bilingual "1. 复制示例配置文件：Copy-Item config\.env_super_magic.example config\.env_super_magic" "1. Copy the example configuration file: Copy-Item config\.env_super_magic.example config\.env_super_magic")
            Write-Host (Bilingual "2. 编辑配置文件：notepad config\.env_super_magic（或使用您喜欢的编辑器）" "2. Edit the configuration file: notepad config\.env_super_magic (or use your preferred editor)")
            Write-Host (Bilingual "3. 配置所有必要的环境变量" "3. Configure all necessary environment variables")
            Write-Host (Bilingual "4. 再次运行此脚本" "4. Run this script again")
            return $false
        } else {
            Write-Host (Bilingual "错误：config\.env_super_magic 和 config\.env_super_magic.example 文件都不存在！" "Error: Both config\.env_super_magic and config\.env_super_magic.example files do not exist!")
            Write-Host (Bilingual "请联系系统管理员获取正确的配置文件。" "Please contact your system administrator for the correct configuration files.")
            return $false
        }
    }

    # 检查config/config.yaml文件是否存在
    if (-not (Test-Path "config\config.yaml")) {
        if (Test-Path "config\config.yaml.example") {
            Write-Host (Bilingual "注意：config\config.yaml 文件不存在，正在从示例文件复制..." "Note: config\config.yaml file does not exist, copying from example file...")
            Copy-Item "config\config.yaml.example" "config\config.yaml"
            Write-Host (Bilingual "已复制 config\config.yaml.example 到 config\config.yaml" "Copied config\config.yaml.example to config\config.yaml")
        } else {
            Write-Host (Bilingual "错误：config\config.yaml 和 config\config.yaml.example 文件都不存在！" "Error: Both config\config.yaml and config\config.yaml.example files do not exist!")
            Write-Host (Bilingual "请联系系统管理员获取正确的配置文件。" "Please contact your system administrator for the correct configuration files.")
            return $false
        }
    }

    return $true
}

# 检查锁文件是否存在 - 如果存在，设置默认值并跳过安装过程
if (Test-Path "bin\magic.lock") {
    # 尝试从锁文件中读取用户选择的语言
    if (Test-Path "bin\user_lang") {
        $script:USER_LANG = Get-Content "bin\user_lang" -Raw
        $script:USER_LANG = $script:USER_LANG.Trim()
    } else {
        $script:USER_LANG = $SYSTEM_LANG
    }
    $SKIP_LANGUAGE_SELECTION = $true
    $SKIP_INSTALLATION = $true

    # 检查是否存在super-magic配置文件，如果存在则自动设置MAGIC_USE_SUPER_MAGIC
    if (Test-Path "bin\use_super_magic") {
        $env:MAGIC_USE_SUPER_MAGIC = " --profile magic-gateway --profile sandbox-gateway"
        Write-Host (Bilingual "检测到Super Magic配置，将自动启动Super Magic相关服务" "Super Magic configuration detected, Super Magic related services will be started automatically")
    } else {
        $env:MAGIC_USE_SUPER_MAGIC = ""
    }
} else {
    $SKIP_LANGUAGE_SELECTION = $false
    $SKIP_INSTALLATION = $false
}

# 检查并更新SANDBOX_NETWORK参数
function Check-SandboxNetwork {
    if (Test-Path "config\.env_sandbox_gateway") {
        $content = Get-Content "config\.env_sandbox_gateway"
        $networkLine = $content | Where-Object { $_ -match "^SANDBOX_NETWORK=" }
        if ($networkLine) {
            $currentNetwork = ($networkLine -split "=")[1]
            if ($currentNetwork -ne "magic-sandbox-network") {
                Write-Host (Bilingual "检测到SANDBOX_NETWORK参数值不是magic-sandbox-network，正在更新..." "Detected SANDBOX_NETWORK value is not magic-sandbox-network, updating...")
                $content = $content -replace "^SANDBOX_NETWORK=.*", "SANDBOX_NETWORK=magic-sandbox-network"
                $content | Set-Content "config\.env_sandbox_gateway"
                Write-Host (Bilingual "已更新SANDBOX_NETWORK参数值为magic-sandbox-network" "Updated SANDBOX_NETWORK value to magic-sandbox-network")
            }
        }
    }
}

# 让用户选择语言（如果未跳过）
if (-not $SKIP_LANGUAGE_SELECTION) {
    function Choose-Language {
        Write-Host "Please select your preferred language / 请选择您偏好的语言:"
        Write-Host "1. English"
        Write-Host "2. 中文"
        $LANG_CHOICE = Read-Host "Enter your choice / 输入您的选择 [1/2] (default: $SYSTEM_LANG)"

        if ([string]::IsNullOrEmpty($LANG_CHOICE)) {
            $script:USER_LANG = $SYSTEM_LANG
        } elseif ($LANG_CHOICE -eq "1") {
            $script:USER_LANG = "en"
        } elseif ($LANG_CHOICE -eq "2") {
            $script:USER_LANG = "zh"
        } else {
            Write-Host "Invalid choice, using system detected language: $SYSTEM_LANG"
            Write-Host "无效的选择，使用系统检测到的语言：$SYSTEM_LANG"
            $script:USER_LANG = $SYSTEM_LANG
        }

        $langDisplay = if ($script:USER_LANG -eq "en") { "English" } else { "中文" }
        Write-Host "Selected language / 已选择语言: $langDisplay"
        Write-Host ""

        # 保存用户选择的语言到文件
        $script:USER_LANG | Set-Content "bin\user_lang"
    }

    # 运行语言选择
    Choose-Language
} else {
    $langDisplay = if ($script:USER_LANG -eq "en") { "English" } else { "中文" }
    Write-Host (Bilingual "使用之前选择的语言: $langDisplay" "Using previously selected language: $langDisplay")
}

# 检查锁文件是否存在 - 如果存在，设置默认值并跳过安装过程
if ($SKIP_INSTALLATION) {
    Write-Host (Bilingual "检测到 magic.lock 文件，跳过安装配置流程..." "Detected magic.lock file, skipping installation configuration...")

    # 为必需的变量设置默认值
    if (Test-Path ".env_super_magic") {
        $env:MAGIC_USE_SUPER_MAGIC = ""
    } else {
        $env:MAGIC_USE_SUPER_MAGIC = ""
    }
}

# 仅在未跳过时运行安装步骤
if (-not $SKIP_INSTALLATION) {
    # 检查Docker是否已安装
    try {
        $dockerVersion = docker --version 2>$null
        if (-not $dockerVersion) {
            throw "Docker not found"
        }
    } catch {
        Write-Host (Bilingual "错误: Docker 未安装。" "Error: Docker is not installed.")
        Write-Host (Bilingual "请先安装 Docker:" "Please install Docker first:")
        Write-Host (Bilingual "1. 访问 https://docs.docker.com/desktop/install/windows-install/" "1. Visit https://docs.docker.com/desktop/install/windows-install/")
        Write-Host (Bilingual "2. 下载并安装 Docker Desktop for Windows" "2. Download and install Docker Desktop for Windows")
        exit 1
    }

    # 检查Docker是否正在运行
    try {
        docker info 2>$null | Out-Null
        if ($LASTEXITCODE -ne 0) {
            throw "Docker not running"
        }
    } catch {
        Write-Host (Bilingual "错误: Docker 未运行。" "Error: Docker is not running.")
        Write-Host (Bilingual "请启动 Docker 并重试。" "Please start Docker and try again.")
        Write-Host (Bilingual "1. 打开 Docker Desktop" "1. Open Docker Desktop")
        Write-Host (Bilingual "2. 等待 Docker 启动" "2. Wait for Docker to start")
        exit 1
    }

    # 检查magic-sandbox-network网络是否存在，如果不存在则创建
    try {
        docker network inspect magic-sandbox-network 2>$null | Out-Null
        if ($LASTEXITCODE -ne 0) {
            Write-Host (Bilingual "网络 magic-sandbox-network 不存在，正在创建..." "Network magic-sandbox-network does not exist, creating...")
            docker network create magic-sandbox-network
            Write-Host (Bilingual "网络 magic-sandbox-network 已创建。" "Network magic-sandbox-network has been created.")
        } else {
            Write-Host (Bilingual "网络 magic-sandbox-network 已存在，跳过创建。" "Network magic-sandbox-network already exists, skipping creation.")
        }
    } catch {
        # 网络不存在，创建它
        Write-Host (Bilingual "网络 magic-sandbox-network 不存在，正在创建..." "Network magic-sandbox-network does not exist, creating...")
        docker network create magic-sandbox-network
        Write-Host (Bilingual "网络 magic-sandbox-network 已创建。" "Network magic-sandbox-network has been created.")
    }

    # 检查docker compose是否已安装
    try {
        docker compose version 2>$null | Out-Null
        if ($LASTEXITCODE -ne 0) {
            throw "Docker Compose not found"
        }
    } catch {
        Write-Host (Bilingual "错误: docker compose 未安装。" "Error: docker compose is not installed.")
        Write-Host (Bilingual "请先安装 docker compose:" "Please install docker compose first:")
        Write-Host (Bilingual "1. Docker Desktop for Windows 默认包含 docker compose" "1. Docker Desktop for Windows includes docker compose by default")
        Write-Host (Bilingual "2. 如果您使用的是旧版本，请访问 https://docs.docker.com/compose/install/" "2. If you're using an older version, visit https://docs.docker.com/compose/install/")
        exit 1
    }

    # 检测系统架构
    $ARCH = $env:PROCESSOR_ARCHITECTURE
    switch ($ARCH) {
        "AMD64" {
            $env:PLATFORM = "linux/amd64"
        }
        "ARM64" {
            $env:PLATFORM = "linux/arm64"
        }
        default {
            Write-Host (Bilingual "不支持的架构: $ARCH" "Unsupported architecture: $ARCH")
            exit 1
        }
    }

    Write-Host (Bilingual "检测到架构: $ARCH，使用平台: $($env:PLATFORM)" "Detected architecture: $ARCH, using platform: $($env:PLATFORM)")

    # 检查.env是否存在，如果不存在则从.env.example复制
    if (-not (Test-Path ".env")) {
        Copy-Item ".env.example" ".env"
    }

    # 修改.env中的PLATFORM变量
    if ($env:PLATFORM) {
        $content = Get-Content ".env"
        $content = $content -replace "^PLATFORM=.*", "PLATFORM=$($env:PLATFORM)"
        $content | Set-Content ".env"
    }

    # 询问是否安装Super Magic服务
    function Ask-SuperMagic {
        Write-Host (Bilingual "是否安装Super Magic服务?" "Do you want to install Super Magic service?")
        Write-Host (Bilingual "1. 是，安装Super Magic服务" "1. Yes, install Super Magic service")
        Write-Host (Bilingual "2. 否，不安装Super Magic服务" "2. No, don't install Super Magic service")
        $SUPER_MAGIC_OPTION = Read-Host (Bilingual "请输入选项编号 [1/2]" "Please enter option number [1/2]")

        if ($SUPER_MAGIC_OPTION -eq "1") {
            Write-Host (Bilingual "您选择了安装Super Magic服务。" "You have chosen to install Super Magic service.")

            # 检查.env_super_magic是否存在
            if (-not (Check-SuperMagicEnv)) {
                exit 1
            }

            # 检查其他网关配置文件是否存在
            if (-not (Test-Path "config\.env_magic_gateway")) {
                Write-Host (Bilingual "错误：config\.env_magic_gateway 文件不存在！" "Error: config\.env_magic_gateway file does not exist!")
                Write-Host (Bilingual "请确保 Magic Gateway 配置文件存在。" "Please ensure the Magic Gateway configuration file exists.")
                exit 1
            }

            if (-not (Test-Path "config\.env_sandbox_gateway")) {
                Write-Host (Bilingual "错误：config\.env_sandbox_gateway 文件不存在！" "Error: config\.env_sandbox_gateway file does not exist!")
                Write-Host (Bilingual "请确保 Sandbox Gateway 配置文件存在。" "Please ensure the Sandbox Gateway configuration file exists.")
                exit 1
            }

            # 为super-magic、magic-gateway和sandbox-gateway添加profiles
            $env:MAGIC_USE_SUPER_MAGIC = " --profile magic-gateway --profile sandbox-gateway"
            # 记录super-magic配置，在下次启动时自动加载
            $env:MAGIC_USE_SUPER_MAGIC | Set-Content "bin\use_super_magic"
            Write-Host (Bilingual "Super Magic、Magic Gateway 和 Sandbox Gateway 服务将被启动。" "Super Magic, Magic Gateway and Sandbox Gateway services will be started.")
            Write-Host (Bilingual "已记录您的选择，下次启动将自动加载Super Magic相关服务。" "Your choice has been recorded, Super Magic related services will be loaded automatically next time.")
        } else {
            Write-Host (Bilingual "您选择了不安装Super Magic服务。" "You have chosen not to install Super Magic service.")
            $env:MAGIC_USE_SUPER_MAGIC = ""
            # 如果存在之前的super-magic配置文件，则删除
            if (Test-Path "bin\use_super_magic") {
                Remove-Item "bin\use_super_magic" -Force
            }
        }
    }

    # 检测公网IP并更新环境变量
    function Detect-PublicIP {
        # 询问用户部署方式
        Write-Host (Bilingual "请选择您的部署方式:" "Please select your deployment method:")
        Write-Host (Bilingual "1. 本地电脑部署" "1. Local deployment")
        Write-Host (Bilingual "2. 远程服务器部署" "2. Remote server deployment")
        $DEPLOYMENT_TYPE = Read-Host (Bilingual "请输入选项编号 [1/2]" "Please enter option number [1/2]")

        # 如果用户选择本地部署，不更新IP
        if ($DEPLOYMENT_TYPE -eq "1") {
            Write-Host (Bilingual "已选择本地部署，保持默认设置。" "Local deployment selected, keeping default settings.")
            return
        } elseif ($DEPLOYMENT_TYPE -ne "2") {
            Write-Host (Bilingual "无效的选项，默认使用本地部署。" "Invalid option, using local deployment by default.")
            return
        }

        # 询问是否需要域名
        $USE_DOMAIN = Read-Host (Bilingual "是否需要使用域名访问? [y/n]" "Do you need to use a domain name for access? [y/n]")

        if ($USE_DOMAIN -match "^[Yy]$") {
            $DOMAIN_ADDRESS = Read-Host (Bilingual "请输入域名地址(不含http/https前缀)" "Please enter domain address (without http/https prefix)")

            if (-not [string]::IsNullOrEmpty($DOMAIN_ADDRESS)) {
                Write-Host (Bilingual "正在使用域名: $DOMAIN_ADDRESS 更新环境变量..." "Updating environment variables with domain: $DOMAIN_ADDRESS...")

                # 更新MAGIC_SOCKET_BASE_URL和MAGIC_SERVICE_BASE_URL
                $content = Get-Content ".env"
                $content = $content -replace "^MAGIC_SOCKET_BASE_URL=ws://localhost:9502", "MAGIC_SOCKET_BASE_URL=ws://$DOMAIN_ADDRESS`:9502"
                $content = $content -replace "^MAGIC_SERVICE_BASE_URL=http://localhost:9501", "MAGIC_SERVICE_BASE_URL=http://$DOMAIN_ADDRESS`:9501"
                # 更新FILE_LOCAL_READ_HOST和FILE_LOCAL_WRITE_HOST
                $content = $content -replace "^FILE_LOCAL_READ_HOST=http://127.0.0.1/files", "FILE_LOCAL_READ_HOST=http://$DOMAIN_ADDRESS/files"
                $content = $content -replace "^FILE_LOCAL_WRITE_HOST=http://127.0.0.1", "FILE_LOCAL_WRITE_HOST=http://$DOMAIN_ADDRESS"
                $content | Set-Content ".env"

                Write-Host (Bilingual "环境变量已更新:" "Environment variables updated:")
                Write-Host "MAGIC_SOCKET_BASE_URL=ws://$DOMAIN_ADDRESS`:9502"
                Write-Host "MAGIC_SERVICE_BASE_URL=http://$DOMAIN_ADDRESS`:9501"
                Write-Host "FILE_LOCAL_READ_HOST=http://$DOMAIN_ADDRESS/files"
                Write-Host "FILE_LOCAL_WRITE_HOST=http://$DOMAIN_ADDRESS"

                # 更新Caddyfile中的域名
                Write-Host (Bilingual "更新Caddyfile配置..." "Updating Caddyfile configuration...")

                # 检查Caddyfile是否存在
                if (Test-Path "bin\caddy\Caddyfile") {
                    $caddyContent = Get-Content "bin\caddy\Caddyfile"
                    $caddyContent = $caddyContent -replace "^# 文件服务`n:80 {", "# 文件服务`n$DOMAIN_ADDRESS`:80 {"
                    $caddyContent | Set-Content "bin\caddy\Caddyfile"
                    Write-Host (Bilingual "已更新Caddyfile配置，使用域名: $DOMAIN_ADDRESS" "Updated Caddyfile configuration with domain: $DOMAIN_ADDRESS")
                } else {
                    Write-Host (Bilingual "未找到Caddyfile，跳过更新" "Caddyfile not found, skipping update")
                }

                return
            } else {
                Write-Host (Bilingual "域名为空，继续使用公网IP配置。" "Domain is empty, continuing with public IP configuration.")
            }
        } else {
            Write-Host (Bilingual "不使用域名，继续使用公网IP配置。" "Not using domain, continuing with public IP configuration.")
        }

        Write-Host (Bilingual "正在检测公网IP..." "Detecting public IP...")

        # 尝试多种方法获取公网IP
        $PUBLIC_IP = ""

        # 方法1: 使用ipinfo.io
        try {
            $PUBLIC_IP = (Invoke-WebRequest -Uri "https://ipinfo.io/ip" -UseBasicParsing -TimeoutSec 10).Content.Trim()
            if ($PUBLIC_IP -match "html" -or [string]::IsNullOrEmpty($PUBLIC_IP)) {
                $PUBLIC_IP = ""
            }
        } catch {
            $PUBLIC_IP = ""
        }

        # 方法2: 使用ip.sb
        if ([string]::IsNullOrEmpty($PUBLIC_IP)) {
            try {
                $PUBLIC_IP = (Invoke-WebRequest -Uri "https://api.ip.sb/ip" -UseBasicParsing -TimeoutSec 10).Content.Trim()
                if ($PUBLIC_IP -match "html" -or [string]::IsNullOrEmpty($PUBLIC_IP)) {
                    $PUBLIC_IP = ""
                }
            } catch {
                $PUBLIC_IP = ""
            }
        }

        # 方法3: 使用ipify
        if ([string]::IsNullOrEmpty($PUBLIC_IP)) {
            try {
                $PUBLIC_IP = (Invoke-WebRequest -Uri "https://api.ipify.org" -UseBasicParsing -TimeoutSec 10).Content.Trim()
                if ($PUBLIC_IP -match "html" -or [string]::IsNullOrEmpty($PUBLIC_IP)) {
                    $PUBLIC_IP = ""
                }
            } catch {
                $PUBLIC_IP = ""
            }
        }

        # 方法4: 使用checkip.amazonaws.com
        if ([string]::IsNullOrEmpty($PUBLIC_IP)) {
            try {
                $PUBLIC_IP = (Invoke-WebRequest -Uri "https://checkip.amazonaws.com" -UseBasicParsing -TimeoutSec 10).Content.Trim()
                if ($PUBLIC_IP -match "html" -or [string]::IsNullOrEmpty($PUBLIC_IP)) {
                    $PUBLIC_IP = ""
                }
            } catch {
                $PUBLIC_IP = ""
            }
        }

        # 如果成功获取到公网IP，询问用户是否使用此IP
        if (-not [string]::IsNullOrEmpty($PUBLIC_IP)) {
            Write-Host (Bilingual "检测到公网IP: $PUBLIC_IP" "Detected public IP: $PUBLIC_IP")
            $USE_DETECTED_IP = Read-Host (Bilingual "是否使用此IP更新配置? [y/n]" "Do you want to use this IP for configuration? [y/n]")

            if ($USE_DETECTED_IP -match "^[Yy]$") {
                Write-Host (Bilingual "正在更新环境变量..." "Updating environment variables...")

                # 更新MAGIC_SOCKET_BASE_URL和MAGIC_SERVICE_BASE_URL
                $content = Get-Content ".env"
                $content = $content -replace "^MAGIC_SOCKET_BASE_URL=ws://localhost:9502", "MAGIC_SOCKET_BASE_URL=ws://$PUBLIC_IP`:9502"
                $content = $content -replace "^MAGIC_SERVICE_BASE_URL=http://localhost:9501", "MAGIC_SERVICE_BASE_URL=http://$PUBLIC_IP`:9501"
                # 更新FILE_LOCAL_READ_HOST和FILE_LOCAL_WRITE_HOST
                $content = $content -replace "^FILE_LOCAL_READ_HOST=http://127.0.0.1/files", "FILE_LOCAL_READ_HOST=http://$PUBLIC_IP/files"
                $content = $content -replace "^FILE_LOCAL_WRITE_HOST=http://127.0.0.1", "FILE_LOCAL_WRITE_HOST=http://$PUBLIC_IP"
                $content | Set-Content ".env"

                Write-Host (Bilingual "环境变量已更新:" "Environment variables updated:")
                Write-Host "MAGIC_SOCKET_BASE_URL=ws://$PUBLIC_IP`:9502"
                Write-Host "MAGIC_SERVICE_BASE_URL=http://$PUBLIC_IP`:9501"
                Write-Host "FILE_LOCAL_READ_HOST=http://$PUBLIC_IP/files"
                Write-Host "FILE_LOCAL_WRITE_HOST=http://$PUBLIC_IP"

                # 更新Caddyfile中的IP
                Write-Host (Bilingual "更新Caddyfile配置..." "Updating Caddyfile configuration...")

                # 检查Caddyfile是否存在
                if (Test-Path "bin\caddy\Caddyfile") {
                    $caddyContent = Get-Content "bin\caddy\Caddyfile"
                    $caddyContent = $caddyContent -replace "^# 文件服务`n:80 {", "# 文件服务`n$PUBLIC_IP`:80 {"
                    $caddyContent | Set-Content "bin\caddy\Caddyfile"
                    Write-Host (Bilingual "已更新Caddyfile配置，使用公网IP: $PUBLIC_IP" "Updated Caddyfile configuration with public IP: $PUBLIC_IP")
                } else {
                    Write-Host (Bilingual "未找到Caddyfile，跳过更新" "Caddyfile not found, skipping update")
                }
            } else {
                Write-Host (Bilingual "保持默认设置。" "Keeping default settings.")
            }
        } else {
            Write-Host (Bilingual "未能检测到公网IP。" "Failed to detect public IP.")
            $MANUAL_IP = Read-Host (Bilingual "是否手动输入IP地址? [y/n]" "Do you want to manually enter an IP address? [y/n]")

            if ($MANUAL_IP -match "^[Yy]$") {
                $MANUAL_IP_ADDRESS = Read-Host (Bilingual "请输入IP地址" "Please enter IP address")

                if (-not [string]::IsNullOrEmpty($MANUAL_IP_ADDRESS)) {
                    Write-Host (Bilingual "正在使用IP: $MANUAL_IP_ADDRESS 更新环境变量..." "Updating environment variables with IP: $MANUAL_IP_ADDRESS...")

                    # 更新MAGIC_SOCKET_BASE_URL和MAGIC_SERVICE_BASE_URL
                    $content = Get-Content ".env"
                    $content = $content -replace "^MAGIC_SOCKET_BASE_URL=ws://localhost:9502", "MAGIC_SOCKET_BASE_URL=ws://$MANUAL_IP_ADDRESS`:9502"
                    $content = $content -replace "^MAGIC_SERVICE_BASE_URL=http://localhost:9501", "MAGIC_SERVICE_BASE_URL=http://$MANUAL_IP_ADDRESS`:9501"
                    # 更新FILE_LOCAL_READ_HOST和FILE_LOCAL_WRITE_HOST
                    $content = $content -replace "^FILE_LOCAL_READ_HOST=http://127.0.0.1/files", "FILE_LOCAL_READ_HOST=http://$MANUAL_IP_ADDRESS/files"
                    $content = $content -replace "^FILE_LOCAL_WRITE_HOST=http://127.0.0.1", "FILE_LOCAL_WRITE_HOST=http://$MANUAL_IP_ADDRESS"
                    $content | Set-Content ".env"

                    Write-Host (Bilingual "环境变量已更新:" "Environment variables updated:")
                    Write-Host "MAGIC_SOCKET_BASE_URL=ws://$MANUAL_IP_ADDRESS`:9502"
                    Write-Host "MAGIC_SERVICE_BASE_URL=http://$MANUAL_IP_ADDRESS`:9501"
                    Write-Host "FILE_LOCAL_READ_HOST=http://$MANUAL_IP_ADDRESS/files"
                    Write-Host "FILE_LOCAL_WRITE_HOST=http://$MANUAL_IP_ADDRESS"

                    # 更新Caddyfile中的手动输入IP
                    Write-Host (Bilingual "更新Caddyfile配置..." "Updating Caddyfile configuration...")

                    # 检查Caddyfile是否存在
                    if (Test-Path "bin\caddy\Caddyfile") {
                        $caddyContent = Get-Content "bin\caddy\Caddyfile"
                        $caddyContent = $caddyContent -replace "^# 文件服务`n:80 {", "# 文件服务`n$MANUAL_IP_ADDRESS`:80 {"
                        $caddyContent | Set-Content "bin\caddy\Caddyfile"
                        Write-Host (Bilingual "已更新Caddyfile配置，使用手动输入IP: $MANUAL_IP_ADDRESS" "Updated Caddyfile configuration with manually entered IP: $MANUAL_IP_ADDRESS")
                    } else {
                        Write-Host (Bilingual "未找到Caddyfile，跳过更新" "Caddyfile not found, skipping update")
                    }
                } else {
                    Write-Host (Bilingual "IP地址为空，保持默认设置。" "IP address is empty, keeping default settings.")
                }
            } else {
                Write-Host (Bilingual "保持默认设置。" "Keeping default settings.")
            }
        }
    }

    Detect-PublicIP

    # 询问是否安装Super Magic服务
    Ask-SuperMagic

    # 创建锁文件以跳过下次安装
    New-Item -Path "bin\magic.lock" -ItemType File -Force | Out-Null
    Write-Host (Bilingual "已创建 magic.lock 文件，下次启动将跳过安装配置流程。" "Created magic.lock file, next startup will skip installation configuration.")
}

# 显示帮助信息
function Show-Help {
    Write-Host (Bilingual "用法: .\magic.ps1 [命令]" "Usage: .\magic.ps1 [command]")
    Write-Host ""
    Write-Host (Bilingual "命令:" "Commands:")
    Write-Host (Bilingual "  start             启动服务(前台)" "  start             Start services in foreground")
    Write-Host (Bilingual "  stop              停止所有服务" "  stop              Stop all services")
    Write-Host (Bilingual "  daemon            后台启动服务" "  daemon            Start services in background")
    Write-Host (Bilingual "  restart           重启所有服务" "  restart           Restart all services")
    Write-Host (Bilingual "  status            显示服务状态" "  status            Show services status")
    Write-Host (Bilingual "  logs              显示服务日志" "  logs              Show services logs")
    Write-Host (Bilingual "  super-magic       仅启动Super Magic服务(前台)" "  super-magic       Start only Super Magic service (foreground)")
    Write-Host (Bilingual "  super-magic-daemon 仅启动Super Magic服务(后台)" "  super-magic-daemon Start only Super Magic service (background)")
    Write-Host ""
    Write-Host (Bilingual "如果未提供命令，默认使用 'start'" "If no command is provided, 'start' will be used by default.")
}

# 启动服务
function Start-Services {
    # 检查并更新SANDBOX_NETWORK参数
    Check-SandboxNetwork

    Write-Host (Bilingual "正在前台启动服务..." "Starting services in foreground...")
    if (Test-Path "bin\use_super_magic") {
        # 直接使用profile参数启动
        docker compose --profile super-magic --profile magic-gateway --profile sandbox-gateway up
    } else {
        docker compose up
    }
}

# 停止服务
function Stop-Services {
    Write-Host (Bilingual "正在停止服务..." "Stopping services...")
    if (Test-Path "bin\use_super_magic") {
        docker compose --profile super-magic --profile magic-gateway --profile sandbox-gateway down
    } else {
        docker compose down
    }
}

# 后台启动服务
function Start-Daemon {
    # 检查并更新SANDBOX_NETWORK参数
    Check-SandboxNetwork

    Write-Host (Bilingual "正在后台启动服务..." "Starting services in background...")
    if (Test-Path "bin\use_super_magic") {
        docker compose --profile super-magic --profile magic-gateway --profile sandbox-gateway up -d
    } else {
        docker compose up -d
    }
}

# 重启服务
function Restart-Services {
    # 检查并更新SANDBOX_NETWORK参数
    Check-SandboxNetwork

    Write-Host (Bilingual "正在重启服务..." "Restarting services...")
    if (Test-Path "bin\use_super_magic") {
        docker compose --profile super-magic --profile magic-gateway --profile sandbox-gateway restart
    } else {
        docker compose restart
    }
}

# 显示服务状态
function Show-Status {
    Write-Host (Bilingual "服务状态:" "Services status:")
    if ($env:MAGIC_USE_SUPER_MAGIC) {
        docker compose --profile super-magic --profile magic-gateway --profile sandbox-gateway ps
    } else {
        docker compose ps
    }
}

# 显示服务日志
function Show-Logs {
    Write-Host (Bilingual "显示服务日志:" "Showing services logs:")
    if ($env:MAGIC_USE_SUPER_MAGIC) {
        docker compose --profile super-magic --profile magic-gateway --profile sandbox-gateway logs -f
    } else {
        docker compose logs -f
    }
}

# 仅启动Super Magic服务
function Start-SuperMagic {
    # 检查并更新SANDBOX_NETWORK参数
    Check-SandboxNetwork

    # 检查.env_super_magic是否存在
    if (-not (Check-SuperMagicEnv)) {
        exit 1
    }

    # 检查其他网关配置文件是否存在
    if (-not (Test-Path "config\.env_magic_gateway")) {
        Write-Host (Bilingual "错误：config\.env_magic_gateway 文件不存在！" "Error: config\.env_magic_gateway file does not exist!")
        Write-Host (Bilingual "请确保 Magic Gateway 配置文件存在。" "Please ensure the Magic Gateway configuration file exists.")
        exit 1
    }

    if (-not (Test-Path "config\.env_sandbox_gateway")) {
        Write-Host (Bilingual "错误：config\.env_sandbox_gateway 文件不存在！" "Error: config\.env_sandbox_gateway file does not exist!")
        Write-Host (Bilingual "请确保 Sandbox Gateway 配置文件存在。" "Please ensure the Sandbox Gateway configuration file exists.")
        exit 1
    }

    Write-Host (Bilingual "正在前台启动Super Magic服务和Gateway服务..." "Starting Super Magic service and Gateway services in foreground...")
    docker compose --profile magic-gateway --profile sandbox-gateway up
}

# 后台启动仅Super Magic服务
function Start-SuperMagicDaemon {
    # 检查并更新SANDBOX_NETWORK参数
    Check-SandboxNetwork

    # 检查.env_super_magic是否存在
    if (-not (Check-SuperMagicEnv)) {
        exit 1
    }

    # 检查其他网关配置文件是否存在
    if (-not (Test-Path "config\.env_magic_gateway")) {
        Write-Host (Bilingual "错误：config\.env_magic_gateway 文件不存在！" "Error: config\.env_magic_gateway file does not exist!")
        Write-Host (Bilingual "请确保 Magic Gateway 配置文件存在。" "Please ensure the Magic Gateway configuration file exists.")
        exit 1
    }

    if (-not (Test-Path "config\.env_sandbox_gateway")) {
        Write-Host (Bilingual "错误：config\.env_sandbox_gateway 文件不存在！" "Error: config\.env_sandbox_gateway file does not exist!")
        Write-Host (Bilingual "请确保 Sandbox Gateway 配置文件存在。" "Please ensure the Sandbox Gateway configuration file exists.")
        exit 1
    }

    Write-Host (Bilingual "正在后台启动Super Magic服务和Gateway服务..." "Starting Super Magic service and Gateway services in background...")
    docker compose --profile magic-gateway --profile sandbox-gateway up -d
}

switch ($Command.ToLower()) {
    "start" {
        Start-Services
    }
    "stop" {
        Stop-Services
    }
    "daemon" {
        Start-Daemon
    }
    "restart" {
        Restart-Services
    }
    "status" {
        Show-Status
    }
    "logs" {
        Show-Logs
    }
    "super-magic" {
        Start-SuperMagic
    }
    "super-magic-daemon" {
        Start-SuperMagicDaemon
    }
    "help" {
        Show-Help
    }
    "--help" {
        Show-Help
    }
    "-h" {
        Show-Help
    }
    default {
        if ([string]::IsNullOrEmpty($Command)) {
            Start-Services
        } else {
            Write-Host (Bilingual "未知命令: $Command" "Unknown command: $Command")
            Show-Help
            exit 1
        }
    }
} 