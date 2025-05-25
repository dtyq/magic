# Magic 入门教程

## 一、系统要求

- 支持操作系统：macOS、Linux 或 Windows
- 已安装 Docker 和 Docker Compose（安装 Docker 参考 3.3）
- 网络连接（用于拉取镜像和检测公网 IP）
- 已安装 Git (用于拉取 Magic 代码)

## 二、安装步骤

### 2.1 克隆项目

```bash
git clone git@github.com:dtyq/magic.git
cd magic
```

![git clone magic](https://public-cdn.letsmagic.cn/static/img/git_clone_magic.png)


## 2.2. 配置文件

#### 主要配置文件
- .env：主要环境变量配置文件
- config/.env_super_magic：Super Magic 服务配置文件（如果选择安装）
- config/.env_magic_gateway：Magic Gateway 配置文件（如果选择安装 Super Magic）
- config/.env_sandbox_gateway：Sandbox Gateway 配置文件（如果选择安装 Super Magic）
- macOS/Linux 安装过程中，如果不存在文件不存在，会自动复制，Windows 需要手动复制修改

##### 手动配置文件，并修改所需要的值
```bash
# 如需要使用 Magic，复制 .env.example 到 .env
sudo cp .env.example .env

```
##### Magic 环境变量配置参考：
https://docs.letsmagic.cn/zh/development/deploy/environment.html

```bash
# 如需使用 Super Magic 服务，复制以下文件：
sudo cp config/.env_super_magic.example  config/.env_super_magic
sudo cp config/.env_magic_gateway.example  config/.env_magic_gateway
sudo cp config/.env_sandbox_gateway.example  config/.env_sandbox_gateway
```
##### Super Magic 环境变量配置参考：
https://docs.letsmagic.cn/zh/development/deploy/super-magic.html

##### 配置IP（可选）
如果是远程服务器部署，编辑 .env 文件，将以下内容中的 localhost 替换为服务器 IP：
```
MAGIC_SOCKET_BASE_URL=ws://<服务器IP>:9502
MAGIC_SERVICE_BASE_URL=http://<服务器IP>:9501
```

如果您选择安装 Super Magic 服务，请确保以下配置文件存在：
- config/.env_super_magic
- config/.env_magic_gateway
- config/.env_sandbox_gateway

如果 config/.env_super_magic 不存在但有 config/.env_super_magic.example，请按照提示复制并编辑该文件。


### 2.3. macOS/Linux 启动服务

#### macOS/Linux
运行安装脚本：

```bash
sudo ./bin/magic.sh start
```

#### Windows
Windows 系统可以不使用 magic.sh 脚本，直接使用 docker compose 命令：
也可以通过下载 Git [GUI工具](https://git-scm.com/downloads/win) 获得跟 macOS/Linux 一样的安装体验

```bash
# 创建必要的网络
docker network create magic-sandbox-network

# 启动基本服务
docker compose up
```

如需启动 Super Magic 相关服务：

```bash
docker compose --profile magic-gateway --profile sandbox-gateway up
```

### 2.4. 安装流程引导

#### macOS/Linux
脚本将引导您完成以下步骤：

##### 语言选择
- 选择 1 for English
- 选择 2 for 中文
![语言选择](https://public-cdn.letsmagic.cn/static/img/chose_langugae.png)


##### 部署方式选择
- 选择 1 表示本地电脑部署（使用默认 localhost 配置）
- 选择 2 表示远程服务器部署（会检测公网 IP 并询问是否使用）
![部署方式选择](https://public-cdn.letsmagic.cn/static/img/chose_development_method.png)

- 提示：脚本会判断本地是否已经创建了 magic-sandbox-network，如果没有会自动执行一次：
```bash
docker network create magic-sandbox-network
```

##### Super Magic 服务安装
- 选择 1 表示安装 Super Magic 服务(需要提前配置 config/ 目录下的配置文件)
- 选择 2 表示不安装 Super Magic 服务
  ![Super Magic 服务安装](https://public-cdn.letsmagic.cn/static/img/super_magic_service_install.png)


### 2.5 首次运行
首次运行后，系统会创建 bin/magic.lock 文件（macOS/Linux），下次启动将跳过安装配置流程。

## 三、使用方法

### 3.1 常用命令

#### macOS/Linux
```bash
sudo ./bin/magic.sh [命令]
```

可用命令：
- start：在前台启动服务
- daemon：在后台启动服务
- stop：停止所有服务
- restart：重启所有服务
- status：显示服务状态
- logs：显示服务日志
- super-magic：仅启动 Super Magic 服务（前台）
- super-magic-daemon：仅启动 Super Magic 服务（后台）
- help：显示帮助信息

#### Windows

Windows 用户直接使用 docker compose 命令：

```bash
# 前台启动服务
docker compose up

# 后台启动服务
docker compose up -d

# 停止服务
docker compose down

# 重启服务
docker compose restart

# 查看服务状态
docker compose ps

# 查看日志
docker compose logs -f

# 使用 Super Magic 服务（前台）
docker compose --profile magic-gateway --profile sandbox-gateway up

# 使用 Super Magic 服务（后台）
docker compose --profile magic-gateway --profile sandbox-gateway up -d
```

### 3.2 示例

#### 启动服务
macOS/Linux:
```bash
./bin/magic.sh start
```

Windows:
```bash
docker compose up
```

#### 后台启动服务
macOS/Linux:
```bash
./bin/magic.sh daemon
```

Windows:
```bash
docker compose up -d
```

#### 查看服务状态
macOS/Linux:
```bash
./bin/magic.sh status
```

Windows:
```bash
docker compose ps
```

#### 查看日志
macOS/Linux:
```bash
./bin/magic.sh logs
```

Windows:
```bash
docker compose logs -f
```

### 3.3 安装 Docker

#### macOS
1. 访问 https://docs.docker.com/desktop/install/mac-install/
2. 下载并安装 Docker Desktop for Mac
![下载并安装 Docker Desktop for Mac](https://public-cdn.letsmagic.cn/static/img/install_docker_desktop_for_mac.png)

3. 启动 Docker Desktop 应用程序
![启动 Docker Desktop 应用程序](https://public-cdn.letsmagic.cn/static/img/start_docker_desktop_application.png)


#### Linux
1. 访问 https://docs.docker.com/engine/install/
2. 按照您的 Linux 发行版安装说明进行操作,下面使用 Ubuntu 为演示例子：
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



3. 安装完成后启动 Docker 服务：
```bash
sudo systemctl start docker
```

#### Windows
1. 访问 https://docs.docker.com/desktop/install/windows-install/
2. 下载并安装 Docker Desktop for Windows
![下载并安装 Docker Desktop for Windows](https://public-cdn.letsmagic.cn/static/img/download_docker_desktop_for_windows.png)

3. 启动 Docker Desktop 应用程序
4. 确保在设置中启用了 WSL 2 后端



## 四、故障排除

### 常见问题

1. **Docker 未运行**
   - 确保 Docker 服务已启动
   - macOS：打开 Docker Desktop 应用
   - Linux：运行 `sudo systemctl start docker`
   - Windows：打开 Docker Desktop 应用，检查系统托盘图标

2. **端口冲突**
   - 检查是否有其他服务占用了配置中使用的端口
   - 修改 .env 文件中的端口配置

3. **配置文件缺失**
   - 按照提示复制示例配置文件并进行必要的编辑

4. **网络问题**
   - 确保能够访问 Docker Hub 以拉取镜像
   - 检查防火墙设置是否阻止了 Docker 的网络访问

5. **Windows特有问题**
   - 确保开启了 WSL 2 支持
   - 如遇到权限问题，尝试以管理员身份运行命令提示符
   - 检查Windows防火墙是否阻止了 Docker 网络流量
6. **日志查看**
   - super-magic 查看 sandbox-agent 开头的容器日志
   - 接口问题查看 magic-service 容器日志
   - 前端UI问题查看 magic-web 容器日志
   - 跨域等网络问题查看 magic-caddy 容器日志

## 五、卸载

如需卸载 Magic 系统：

1. 停止并移除所有容器

   macOS/Linux:
   ```bash
   ./bin/magic.sh stop
   ```

   Windows:
   ```bash
   docker compose down
   ```

2. 移除 Docker 网络（如有需要）
   ```bash
   docker network rm magic-sandbox-network
   ```

3. 删除持久化文件目录 ./volumes
