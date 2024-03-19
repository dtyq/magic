# 使用 Playwright 基础镜像
FROM mcr.microsoft.com/playwright:v1.49.1-noble

# 设置工作目录
WORKDIR /app

# 设置Python环境
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV TZ=Asia/Shanghai

# 替换为中国的镜像源
# RUN sed -i 's/archive.ubuntu.com/mirrors.tuna.tsinghua.edu.cn/g' /etc/apt/sources.list && \
#     sed -i 's/security.ubuntu.com/mirrors.tuna.tsinghua.edu.cn/g' /etc/apt/sources.list

# 安装必要的软件包，使用 --no-install-recommends 减小体积
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3-pip \
    python3-venv \
    python3-full \
    git \
    vim \
    patch \
    tzdata \
    ripgrep \
    tree \
    fontconfig \
    fonts-wqy-zenhei \
    fonts-wqy-microhei \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* \
    && ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# 更新字体缓存
RUN fc-cache -fv

# 直接安装指定版本的Node.js和TypeScript
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y nodejs && \
    npm config set registry https://registry.npmmirror.com && \
    npm install -g typescript@5.8.3 && \
    # 将Node.js版本固定到22.14.0
    npm install -g n && \
    n 22.14.0 && \
    # 打印版本信息
    echo "========== Node.js 版本信息 ==========" && \
    node -v && \
    echo "========== TypeScript 版本信息 ==========" && \
    tsc -v

# 设置 pip 镜像源
# RUN pip config set global.index-url https://pypi.tuna.tsinghua.edu.cn/simple

# 创建并激活虚拟环境
RUN python3 -m venv /venv
ENV PATH="/venv/bin:$PATH"

# 安装 tiktoken
RUN pip install tiktoken

# 预加载 tiktoken 编码器，因为要下载令牌表文件 cl100k_base.tiktoken
RUN echo "import tiktoken; tiktoken.get_encoding('cl100k_base'); print('Tiktoken cl100k_base encoding preloaded successfully')" > preload_tiktoken.py && \
    python preload_tiktoken.py && \
    rm preload_tiktoken.py

# 复制并安装项目依赖
COPY requirements.txt .


# 安装依赖
RUN pip install -r requirements.txt

# 安装沙箱环境依赖
COPY requirements_sandbox.txt .
RUN pip install -r requirements_sandbox.txt

# 更新环境变量路径
ENV PATH="/usr/local/bin:${PATH}"
