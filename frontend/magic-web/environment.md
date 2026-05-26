# 环境变量说明

## 环境变量配置模版

```text
MAGIC_SERVICE_BASE_URL: ""
MAGIC_PUBLIC_CDN_URL: ""
MAGIC_SOCKET_BASE_URL: ""
MAGIC_APP_ENV: ""
MAGIC_KEEWOOD_WEB_URL: ""
MAGIC_APP_VERSION: ""
MAGIC_GATEWAY_ADDRESS: ""
MAGIC_ICP_CODE: ""
MAGIC_LOGIN_CONFIG: ""
MAGIC_WEB_URL: ""
MAGIC_TEAMSHARE_BASE_URL: ""
MAGIC_SERVICE_TEAMSHARE_BASE_URL: ""
MAGIC_EDITION: ""
MAGIC_IS_PRIVATE_DEPLOY: ""
MAGIC_AMAP_KEY: ""
MAGIC_APP_SHA: ""
MAGIC_PAYMENT_METHOD: ""
MAGIC_SERVICE_KEEWOOD_BASE_URL: ""
MAGIC_COPYRIGHT: ""
MAGIC_TEAMSHARE_WEB_URL: ""
MAGIC_HTML_SANDBOX_URL: ""
MAGIC_SW_MODE: ""
```



## 环境变量说明

> 下列每项携带 ✅ 开头的都必须配置，其余可选则为空配置。

### ✅ API 各服务地址

|          环境变量 |服务          |
|:-------------------------:|:------:|
|  MAGIC_SERVICE_BASE_URL  |       magic-service       |
| MAGIC_SOCKET_BASE_URL  |magic-service(web socket) |  
|MAGIC_SERVICE_TEAMSHARE_BASE_URL |     teamshare-service     | 
| MAGIC_SERVICE_KEEWOOD_BASE_URL |     keewood-service      | 
| MAGIC_GATEWAY_ADDRESS |         API 网关           | 

### ✅ 各 Web 客户端应用地址

|       应用        |  环境变量  |
|:---------------:|:------:|
|   magic   |  MAGIC_WEB_URL  |
| teamshare(办公配套) |  MAGIC_TEAMSHARE_WEB_URL  |
| keewood(旧版管理后台) |  MAGIC_KEEWOOD_WEB_URL  |

### ✅ 是否为私有化部署 MAGIC_IS_PRIVATE_DEPLOY （当前变量待移除）

```text
// 私有化部署示例
MAGIC_IS_PRIVATE_DEPLOY = "true"
```

### ✅ 私有化部署登录策略配置（SaaS无需配置） MAGIC_PRIVATE_DEPLOYMENT_CONFIG

支持登录策略

|      登录策略      |  策略值        | 配置 |
|:--------------:|:------:|:---------:|
|    短信验证码登录     | phone_captcha |     |
|    手机号+密码登录    | phone_password |      |
|    邮箱验证码登录     | email |     |
|     钉钉扫码登录     | DingTalk |        |
|      钉钉免登      | DingTalkAvoid |        |
|     企业微信登录     | wecom |         |
|   飞鼠扫码/免登登录    | Lark |         |

```text
// 私有化部署 示例(开启手机号+密码登录、短信验证码登录、邮箱登录，默认为邮箱登录)

MAGIC_PRIVATE_DEPLOYMENT_CONFIG = {"defaultIAM": "email", "iam": {"phone_password":{"enable":true},"email":{"enable":false},"phone_captcha":{"enable":true}}}
```

### ✅ SaaS 登录策略配置（私有化部署无需配置） MAGIC_LOGIN_CONFIG

支持登录策略

|      登录策略      |  策略值   |    登录方式归属     | 配置 |
|:--------------:|:------:|:-------------:|:--:|
|    短信验证码登录     | phone_captcha | SaaS \| 私有化登录 |    |
|    手机号+密码登录    | phone_password |     SaaS \| 私有化登录      |    |
|    邮箱验证码登录     | email |     SaaS      |    |
|    微信公众号登录     | wechat_official_account |     SaaS      |    |
| App客户端下 - 微信登录 | wechat_app |     SaaS      |  '{"enable":true,"appId":"","universalLink":""}'  |
|     钉钉扫码登录     | DingTalk |     私有化登录     |    |
|      钉钉免登      | DingTalkAvoid |     私有化登录     |    |
|     企业微信登录     | wecom |     私有化登录     |    |
|   飞鼠扫码/免登登录    | Lark |     私有化登录     |    |

```text
// SaaS 示例(开启微信公众号登录、手机号+密码登录、短信验证码登录)

MAGIC_LOGIN_CONFIG = {"wechat_official_account":{"enable":true,"default":true},"phone_password":{"enable":true},"email":{"enable":false},"phone_captcha":{"enable":true}}'
```

### ✅ 版本信息

| 变量名 |                   说明                   |              备注               |
|:---:|:--------------------------------------:|:-----------------------------:|
|  MAGIC_APP_ENV   |                 当前所在集群                 |                               |
| MAGIC_EDITION  |              应用版本（商业化/开源）              | "ENTERPRISE" \| "OPEN_SOURCE" |
| MAGIC_APP_VERSION  |      当前应用版本(由镜像构建阶段注入 gitlab 版本)       |             无需配置              |
| MAGIC_APP_SHA  | 当前应用开发版本(由镜像构建阶段注入 gitlab commit hash) |             无需配置              |

### 云服务商“应用性能全链路追踪”配置 MAGIC_APM

|   服务商类型    | 服务商  |                  备注                   |
|:----------:|:----:|:-------------------------------------:|
| Volcengine | 火山引擎 | { options: { appId: "", token: ""  }} |
|   Aliyun   | 阿里云  |                                       |

```text
// 火山引擎示例

MAGIC_APM = `{"strategy": "Volcengine", "options": { "appId": "", "token": "" }}`
```

### SaaS 订单支付方式 MAGIC_PAYMENT_METHOD

支持支付方式：

|    平台     |  支付方式  |
|:---------:|:------:|
|   阿里支付    | ALIPAY |
| Stripe 支付 | STRIPE |


### 版权配置 MAGIC_COPYRIGHT

该配置为站点版权信息，通常显示在页面底部。

```text
MAGIC_COPYRIGHT = ""
```

### 备案号 MAGIC_ICP_CODE

```text
MAGIC_ICP_CODE = ""
```

### CDN资源地址 MAGIC_CDNHOST

用于部分资源 CDN 加载的地址，默认不配置则加载当前站点资源。

```text
// 示例
MAGIC_CDNHOST = "https://cdn.magic.cn"

// 国内SaaS 示例
MAGIC_CDNHOST = "https://cdn.letsmagic.cn/__assets__/packages"
```

### App Service Worker 开关 MAGIC_SW_MODE

用于控制 Web 是否注册 App Service Worker，以及是否进入应急退场模式。

支持取值：

| 变量值 | 说明 | 是否注册 SW |
|:---:|:---|:---:|
| `on` | 显式开启 App Service Worker 缓存能力，使用构建产物中的正常 `/sw.js` | 是 |
| `none` | 显式关闭，不注册 App Service Worker；若浏览器中已有旧的 app SW，会在页面启动时主动注销 | 否 |
| `off` | 注册一个仅用于注销的 SW，不清理缓存桶 | 是 |
| `kill` | 注册一个用于清理缓存并注销的 SW；需配合 `MAGIC_SW_CLEAR_CACHES`，缺失时自动降级为 `off` | 是 |
| 空值/不配置/其他值 | 默认行为，等同 `none`。仅在特定环境显式配置 `on` 时才开启缓存能力 | 否 |

配置建议：

- 默认保持空值或设置为 `none`，表示不注册 SW。
- 只有需要启用缓存能力的环境，才显式配置 `MAGIC_SW_MODE=on`。
- 需要应急退场时使用 `off` 或 `kill`；其中 `kill` 如果漏配 `MAGIC_SW_CLEAR_CACHES`，会按 `off` 处理，优先关闭缓存能力。

```text
// 默认：不注册 SW
MAGIC_SW_MODE = ""

// 显式开启 SW 缓存能力
MAGIC_SW_MODE = "on"

// 显式关闭且不注册 SW
MAGIC_SW_MODE = "none"

// 应急注销，不清缓存
MAGIC_SW_MODE = "off"

// 应急清缓存并注销
MAGIC_SW_MODE = "kill"
MAGIC_SW_CLEAR_CACHES = "ALL"
```

### API 缓存总开关 MAGIC_ENABLE_API_CACHE

用于控制 Service Worker 的 API 缓存策略总开关。该变量只影响走 SW API 缓存链路的请求，不影响静态资源缓存或 SW 注册行为。

支持取值：

| 变量值 | 说明 |
|:---:|:---|
| `false` | 显式关闭 API 缓存，不再命中 SW 的 API 缓存白名单逻辑 |
| `true` / 空值 / 不配置 / 其他值 | 默认开启 API 缓存；命中白名单的接口请求可进入 SW 缓存策略 |

配置建议：

- 默认可不配置，保持 API 缓存开启。
- 本地 `MAGIC_MOCK=true` 调试或排查缓存干扰问题时，建议显式设置 `MAGIC_ENABLE_API_CACHE=false`。

```text
// 默认：开启 API 缓存
MAGIC_ENABLE_API_CACHE = ""

// 显式开启 API 缓存
MAGIC_ENABLE_API_CACHE = "true"

// 显式关闭 API 缓存
MAGIC_ENABLE_API_CACHE = "false"
```

### iframe HTML 渲染站（跨域沙箱）MAGIC_HTML_SANDBOX_URL

用于 HTML 内容跨域 iframe 渲染（html-shabox）。配置后主应用将 iframe 的 `src` 指向渲染站地址，通过 postMessage 注入 HTML 与编辑运行时；不配置则使用同域模式（srcdoc/messenger）。

配置注意：

- 线上/预发渲染站可设置为：`MAGIC_HTML_SANDBOX_URL=https://husky.pages.letsmagic.space/index.html`
- 本地调试渲染站时，需要同时满足：
  - `MAGIC_HTML_SANDBOX_URL=http://localhost:4173/index.html`
  - `MAGIC_CDNHOST=""`（置空，否则可能导致样式资源加载异常）

| 变量名 | 说明 | 备注 |
|:---:|:---|:---|
| MAGIC_HTML_SANDBOX_URL | iframe 加载的 HTML 渲染站根地址 | 即 html-shabox 服务对外 URL，主应用 iframe src 指向该地址。开发示例：`http://localhost:4173` 或 `https://localhost:4173` |


```text
// 线上/预发示例
MAGIC_HTML_SANDBOX_URL = "https://husky.pages.letsmagic.space/index.html"

// 本地调试示例（与 pnpm dev 启动的 html-shabox 配合）
MAGIC_HTML_SANDBOX_URL = "http://localhost:4173/index.html"
MAGIC_CDNHOST = ""
```

### 高德地图 API Key MAGIC_AMAP_KEY

用于定位获取。

### 用户行为分析 MAGIC_USER_BEHAVIOR_ANALYSIS

用于配置用户行为分析的相关参数，通常为空字符串表示不启用。

支持第三方平台：

| 平台  |  标识 strategy   |     配置参数 options      |
|:---:|:------:|:---------------------:|
| 友盟+ |  CNZZ  |     { "id": "" }      |
| 谷歌  | Google |     { "id": "" }      |

```text
// 格式如下
[{"strategy": "", "options": { "id": "" }}]

// 启用多个第三方用户分析行为
[{"strategy": "CNZZ", "options": { "id": "" }}, {"strategy": "Google", "options": { "id": "" }}]
```


