# 使用Python官方镜像
FROM python:3.12-slim

# 设置工作目录
WORKDIR /app

# 设置Python环境
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# 替换为阿里云镜像源
RUN rm -rf /etc/apt/sources.list.d/* && \
    echo "deb https://mirrors.aliyun.com/debian/ bookworm main contrib non-free non-free-firmware" > /etc/apt/sources.list && \
    echo "deb https://mirrors.aliyun.com/debian/ bookworm-updates main contrib non-free non-free-firmware" >> /etc/apt/sources.list && \
    echo "deb https://mirrors.aliyun.com/debian/ bookworm-backports main contrib non-free non-free-firmware" >> /etc/apt/sources.list && \
    echo "deb https://mirrors.aliyun.com/debian-security bookworm-security main contrib non-free non-free-firmware" >> /etc/apt/sources.list

# 安装必要的软件包，使用 --no-install-recommends 减小体积
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    gnupg \
    lsb-release \
    git \
    vim \
    patch \
    ca-certificates \
    tzdata \
    tcpdump \
    net-tools \
    iputils-ping \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# 设置时区为中国标准时间
ENV TZ=Asia/Shanghai
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# 设置pip镜像源
RUN pip config set global.index-url https://pypi.tuna.tsinghua.edu.cn/simple

# 复制并安装项目依赖
COPY requirements.txt .

# 安装依赖
RUN pip install -r requirements.txt

# 复制项目文件
COPY . .

# 暴露端口
EXPOSE 8003

# 启动命令
CMD ["python", "main.py"]
