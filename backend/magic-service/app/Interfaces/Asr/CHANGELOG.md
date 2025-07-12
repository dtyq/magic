# ASR Token API 变更日志

## 2024-01-XX - 新增refresh参数和duration修改

### 新增功能
- ✅ 为 `GET /api/v1/asr/tokens` 接口新增 `refresh` 参数
- ✅ 支持强制刷新token功能，当 `refresh=true` 时会清除缓存并重新获取

### 变更内容
- 🔄 默认duration从3600秒改为7200秒（2小时）
- 🔄 不再接受外部传入的duration参数，固定为7200秒
- 🔄 优化缓存逻辑，支持按需刷新
- 🔄 `duration` 字段动态显示：新token显示7200秒，缓存token显示剩余时间

### 接口变更
- **GET /api/v1/asr/tokens**
  - 新增：`refresh` 参数（boolean，默认false）
  - 移除：`duration` 参数
  - 修改：Token有效期固定为7200秒
  - 优化：`duration` 字段动态显示剩余有效时间

### 技术改进
- 🚀 提升token使用体验，减少频繁过期问题
- 🔧 增强缓存控制灵活性
- 📊 动态显示token剩余时间，提升用户体验
- 📝 更新完整的API文档和使用示例

## 2024-01-XX - 重构完成

### 移除的功能
- ❌ 移除了 `GET /api/v1/asr/config` 接口
- ❌ 删除了 `AsrTokenController` 类
- ❌ 删除了 `TestJwtTokenCommand` 测试命令

### 新增的功能
- ✅ 创建了 `AsrTokenApi` 类，符合项目Facade模式
- ✅ 创建了 `AbstractApi` 基类，提供通用功能
- ✅ 重构了目录结构，使用 `Facade` 子目录

### 保持的功能
- ✅ `GET /api/v1/asr/tokens` - 获取JWT Token
- ✅ `DELETE /api/v1/asr/tokens` - 清除JWT Token缓存
- ✅ 用户鉴权机制
- ✅ Redis缓存机制
- ✅ 性能优化（93.8%提升）

### 技术改进
- 📁 目录结构更符合项目规范
- 🏗️ 使用Facade模式，继承AbstractApi
- 🧹 代码更加简洁，移除了不必要的配置接口
- 📝 保持了完整的文档和错误处理

## 文件结构

```
app/Interfaces/Asr/
├── Facade/
│   ├── AbstractApi.php      # 基础API类
│   └── AsrTokenApi.php      # JWT Token API
├── README.md                # API文档
└── CHANGELOG.md             # 变更日志
```

## 路由映射

```
GET    /api/v1/asr/tokens  → AsrTokenApi::show()
DELETE /api/v1/asr/tokens  → AsrTokenApi::destroy()
``` 