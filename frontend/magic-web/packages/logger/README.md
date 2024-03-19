# @magic-web/logger

统一的日志追踪解决方案，支持阿里云 ARMS 和火山引擎 APMPlus。

## 特性

-   🎯 **统一接口**：抽象统一的 API，屏蔽底层平台差异
-   🔌 **配置驱动**：通过配置文件轻松切换追踪平台
-   🧩 **插件系统**：丰富的插件生态，支持自定义扩展
-   📦 **按需加载**：支持 Tree Shaking，减少打包体积
-   🔒 **类型安全**：完整的 TypeScript 类型定义
-   ⚡ **高性能**：事件队列、批量上报、数据压缩

## 安装

```bash
pnpm add @magic-web/logger

# 根据使用的平台安装对应的 SDK
pnpm add @apmplus/web        # 火山引擎 APMPlus
# 或
pnpm add @arms/rum-browser   # 阿里云 ARMS RUM
```

## 快速开始

### 基础使用

```typescript
import { createLogger } from "@magic-web/logger"

const logger = createLogger({
	provider: {
		type: "volcengine",
		appId: 123456,
		token: "your-token-here",
	},
	autoStart: true,
})

// 设置用户信息
logger.setUser({
	id: "12345",
	name: "John Doe",
})

// 追踪自定义事件
logger.track({
	name: "button_click",
	properties: {
		buttonName: "submit",
	},
})

// 捕获错误
try {
	// some code
} catch (error) {
	logger.captureError(error)
}
```

### 使用插件

```typescript
import { createLogger } from "@magic-web/logger"
import { PerformancePlugin, UserBehaviorPlugin } from "@magic-web/logger/plugins"

const logger = createLogger({
	provider: {
		type: "volcengine",
		appId: 123456,
		token: "your-token-here",
	},
	plugins: [
		new PerformancePlugin(),
		new UserBehaviorPlugin({
			trackClick: true,
			trackPageView: true,
		}),
	],
})
```

### React 集成

```typescript
import { createLogger } from "@magic-web/logger"
import { UserBehaviorPlugin } from "@magic-web/logger/plugins"

const logger = createLogger({
	provider: {
		type: "volcengine",
		appId: 123456,
		token: "your-token",
	},
	plugins: [new UserBehaviorPlugin()],
})

function App() {
	useEffect(() => {
		logger.setUser({
			id: getCurrentUserId(),
		})
	}, [])

	return <YourApp />
}
```

## 配置

### 火山引擎 APMPlus 配置

```typescript
{
  provider: {
    type: 'volcengine',
    appId: 123456,      // aid
    token: 'your-token',
    env: 'production',
    extra: {
      // 火山引擎特定配置
      plugins: []
    }
  }
}
```

### 阿里云 ARMS RUM 配置

```typescript
{
  provider: {
    type: 'aliyun',
    appId: 'your-project-id',  // pid
    token: 'your-token',
    env: 'production',
    extra: {
      // 阿里云特定配置
      endpoint: 'https://arms-retcode.aliyuncs.com',
      version: '1.0.0',
      enableSPA: true,
      sendResource: true
    }
  }
}
```

## 插件系统

### 内置插件

-   **PerformancePlugin**: 性能监控
-   **UserBehaviorPlugin**: 用户行为追踪
-   **ErrorPlugin**: 错误监控
-   **CustomEventPlugin**: 自定义事件

### 自定义插件

```typescript
import { BasePlugin } from "@magic-web/logger/plugins"

class MyPlugin extends BasePlugin {
	name = "my-plugin"

	protected onInstall(): void {
		// 插件安装逻辑
	}

	protected onUninstall(): void {
		// 插件卸载逻辑
	}
}

logger.use(new MyPlugin())
```

## API 文档

查看完整的 [API 文档](./docs/api-reference.md)

## 贡献

欢迎贡献！请查看 [贡献指南](./DESIGN.md#十六贡献指南)

## 许可证

MIT
