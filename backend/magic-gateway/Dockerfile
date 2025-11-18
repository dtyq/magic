FROM public.ecr.aws/docker/library/golang:1.24-alpine AS builder

# 设置Go模块代理
ENV GOPROXY=https://goproxy.cn,direct

WORKDIR /app

# 设置Alpine国内镜像
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories

# 复制依赖文件
COPY go.mod go.sum ./

# 下载依赖
RUN go mod download

# 复制源代码
COPY . .

# 编译整个包（包含 main.go, url_validator.go 等所有文件）
RUN CGO_ENABLED=0 GOOS=linux go build -o api-gateway .

# 使用多阶段构建减小镜像大小
FROM public.ecr.aws/docker/library/alpine:latest

WORKDIR /app

# 设置Alpine国内镜像
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories

# 从builder阶段复制编译好的二进制文件
COPY --from=builder /app/api-gateway /app/

# 创建配置目录
RUN mkdir -p /app/config

# 设置时区为亚洲/上海
RUN apk add --no-cache tzdata && \
    cp /usr/share/zoneinfo/Asia/Shanghai /etc/localtime && \
    echo "Asia/Shanghai" > /etc/timezone && \
    apk del tzdata

# 环境变量
ENV MAGIC_GATEWAY_ENV=dev
ENV MAGIC_GATEWAY_DEBUG=false

# 暴露端口



# 添加健康检查
#HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
#  CMD wget -q -O- http://localhost:${PORT}/status || exit 1

# 启动服务
CMD ["./api-gateway"]
