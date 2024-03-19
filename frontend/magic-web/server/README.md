# Magic Web Server

Express 服务器，用于提供 SSR、API 代理和静态资源服务。

## 快速开始

### HTTP 服务（默认）

```bash
# 开发环境
npm run dev

# 生产环境
npm start
```

访问：http://localhost:8080

### HTTPS 服务

#### 方式 1：使用 mkcert（推荐）

mkcert 会生成受信任的本地证书，浏览器不会显示警告。

```bash
# 1. 安装 mkcert
brew install mkcert        # macOS
# choco install mkcert     # Windows
# 参考官网安装             # Linux: https://github.com/FiloSottile/mkcert

# 2. 初始化本地 CA（只需运行一次）
mkcert -install

# 3. 生成证书
npm run generate-cert:mkcert

# 4. 启动 HTTPS 服务器
npm run dev:https          # 开发环境
npm run start:https        # 生产环境
```

访问：
- https://localhost:8443
- https://magic.t.teamshare.cn:8443

#### 方式 2：使用 OpenSSL（自签名证书）

这种方式会生成自签名证书，浏览器会显示警告。

```bash
# 1. 生成自签名证书
npm run generate-cert

# 2. 启动 HTTPS 服务器
npm run dev:https          # 开发环境
npm run start:https        # 生产环境
```

访问：https://localhost:8443

⚠️ **注意**：浏览器会显示"不安全"警告，点击"继续访问"即可。

#### 方式 3：手动配置证书

如果你有自己的证书文件，可以直接放到 `server/ssl/` 目录：

```bash
server/ssl/
  ├── cert.pem   # 证书文件
  └── key.pem    # 私钥文件
```

然后运行：

```bash
npm run dev:https
```

## 端口配置

- **HTTP**: 8080
- **HTTPS**: 8443

可以在 `app.cjs` 或 `app.https.cjs` 中修改端口。

## 支持的域名

HTTPS 证书支持以下域名（通过 mkcert 或 openssl 生成）：

- localhost
- magic.t.teamshare.cn
- t.letsmagic.cn
- www.letsmagic.cn
- www-pre.letsmagic.cn
- magic-web.saas-test.cn-beijing.volce.teamshare.work

## 证书自动查找顺序

`app.https.cjs` 会按以下顺序查找证书：

1. `server/ssl/cert.pem` 和 `server/ssl/key.pem`（自定义证书）
2. `~/.vite-plugin-mkcert/cert.pem` 和 `~/.vite-plugin-mkcert/dev.pem`（复用 Vite 的证书）
3. 如果都找不到，只启动 HTTP 服务

## 目录结构

```
server/
├── app.cjs                    # HTTP 服务器
├── app.https.cjs              # HTTPS 服务器
├── config.js                  # 配置文件
├── routes/                    # 路由
├── middleware/                # 中间件
├── apis/                      # API 处理
├── ssl/                       # SSL 证书目录（gitignore）
│   ├── cert.pem
│   └── key.pem
├── scripts/                   # 证书生成脚本
│   ├── generate-cert.js
│   └── generate-cert-mkcert.js
└── README.md
```

## 环境变量

可以通过环境变量配置：

```bash
# 示例
NODE_ENV=production npm run start:https
```

## 常见问题

### Q: 浏览器显示"不安全"警告？

**A**: 如果使用自签名证书（openssl 生成），这是正常的。有两个解决方案：

1. **推荐**：使用 `mkcert` 生成受信任的证书
2. 在浏览器中点击"高级" → "继续访问"

### Q: 证书过期怎么办？

**A**: 重新生成证书：

```bash
# 删除旧证书
rm server/ssl/*.pem

# 重新生成
npm run generate-cert:mkcert
```

### Q: 如何在 hosts 文件中配置域名？

**A**: 编辑 `/etc/hosts`（macOS/Linux）或 `C:\Windows\System32\drivers\etc\hosts`（Windows）：

```
127.0.0.1 magic.t.teamshare.cn
127.0.0.1 t.letsmagic.cn
```

### Q: 可以同时启动 HTTP 和 HTTPS 吗？

**A**: 可以！`app.https.cjs` 会同时启动两个服务：

- HTTP: http://localhost:8080
- HTTPS: https://localhost:8443

## 与 Vite 配置同步

本服务器的 SSL 配置与 `vite.config.ts` 中的 `mkcert` 插件完全兼容。

如果你已经运行过 `pnpm dev`（前端开发服务器），vite-plugin-mkcert 会自动生成证书，后端服务器可以直接复用这些证书。

## 生产环境部署

在生产环境中，建议使用：

1. **Nginx** 或 **Caddy** 作为反向代理处理 HTTPS
2. 使用 **Let's Encrypt** 生成免费的正式 SSL 证书
3. Node.js 服务只需提供 HTTP 服务（由反向代理处理 HTTPS）

```nginx
# Nginx 配置示例
server {
    listen 443 ssl http2;
    server_name magic.t.teamshare.cn;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```







