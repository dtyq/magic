# 前端日志采集系统设计方案

## 目录

-   [系统概述](#系统概述)
-   [架构设计](#架构设计)
-   [核心组件](#核心组件)
-   [插件系统](#插件系统)
-   [上报机制](#上报机制)
-   [数据安全与隐私](#数据安全与隐私)
-   [性能优化](#性能优化)
-   [监控与统计](#监控与统计)
-   [运营数据采集扩展](#运营数据采集扩展)
-   [最佳实践](#最佳实践)

## 系统概述

本系统是一个企业级前端日志采集解决方案，采用插件化架构设计，支持多种日志类型、多种上报方式，并具备完善的数据安全保护机制。

### 核心特性

-   🔌 **插件化架构**：可扩展的插件系统，支持自定义日志处理逻辑
-   🛡️ **数据安全**：内置敏感数据脱敏，支持多种脱敏规则
-   📊 **智能去重**：防止重复日志频繁上报，支持指数退避策略
-   🚀 **多种上报方式**：支持 Fetch、Beacon、XHR 多种上报机制
-   📈 **性能监控**：内置 Web Vitals、资源监控、错误监控
-   🔄 **队列管理**：支持批量上报、延迟发送、重试机制
-   🎯 **精准追踪**：基于 traceId 的链路追踪

### 技术栈

-   **语言**：TypeScript
-   **架构模式**：插件化架构 + 工厂模式
-   **上报方式**：Fetch API / sendBeacon / XMLHttpRequest
-   **数据处理**：流式处理 + 批量上报

## 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                        Logger 核心                          │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │   TraceId管理   │  │   配置管理      │  │  生命周期    │ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                     插件管理系统                             │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────┐ │
│  │ 错误解析器   │ │ 敏感数据    │ │ 日志去重    │ │ 控制台  │ │
│  │ Plugin      │ │ 脱敏Plugin  │ │ Plugin      │ │ Plugin   │ │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────┘ │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────┐ │
│  │ Web Vitals  │ │ 资源监控     │ │ 网络监控     │ │ 上报器    │ │
│  │ Plugin      │ │ Plugin      │ │ Plugin      │ │ Plugin  │ │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────┘ │
└─────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                      上报系统                               │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────┐ │
│  │ 队列管理器  │ │ Fetch       │ │ Beacon      │ │ XHR     │ │
│  │ LogQueue    │ │ Reporter    │ │ Reporter    │ │Reporter │ │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────┘ │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────┐ │
│  │ 批量处理    │ │ 重试机制    │ │ 压缩处理    │ │ 错误    │ │
│  │ Batch       │ │ Retry       │ │ Compression │ │Fallback │ │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## 核心组件

### 1. Logger 主类

**位置**: `src/utils/log/Logger.ts`

Logger 是整个系统的核心入口，负责：

-   **TraceId 管理**：为每个会话生成唯一标识
-   **插件系统管理**：注册、初始化、销毁插件
-   **日志上下文构建**：收集用户信息、URL、时间戳等
-   **配置管理**：支持不同日志级别的开关控制

```typescript
interface LoggerOptions {
	enableConfig?: {
		console?: boolean
		warn?: boolean
		error?: boolean
		trace?: boolean
	}
	plugins?: LoggerPlugin[]
}
```

**核心方法**：

-   `log()` - 普通日志
-   `warn()` - 警告日志
-   `error()` - 错误日志
-   `report()` - 主动上报

### 2. 敏感数据脱敏器

**位置**: `src/utils/log/SensitiveMasker.ts`

负责保护用户隐私和企业数据安全：

**支持的脱敏规则**：

-   邮箱地址脱敏
-   API 密钥脱敏
-   JWT Token 脱敏
-   身份证号脱敏
-   URL 参数脱敏
-   自定义关键词脱敏

**脱敏策略**：

```typescript
// 保留前4位和后4位，中间用*替代
"user@example.com" → "user******.com"
"sk-1234567890abcdef" → "sk-1****cdef"
```

### 3. 日志去重器

**位置**: `src/utils/log/LogDeduplicator.ts`

防止相同错误被频繁重复上报：

**去重策略**：

-   **时间窗口**：5 分钟内的重复日志进行去重
-   **最大重复次数**：单个错误最多上报 10 次
-   **指数退避**：采用智能退避算法减少重复上报
-   **缓存管理**：最多缓存 1000 条记录，定期清理

**退避策略**：

```
第1-4次：立即发送
第5-8次：每2次发送1次
第9次及以上：每4次发送1次
```

## 插件系统

### 插件架构

**位置**: `src/utils/log/plugins/`

采用标准的插件架构模式，支持插件的动态注册、优先级排序和生命周期管理。

**插件接口**：

```typescript
interface LoggerPlugin {
	readonly name: string
	readonly version?: string
	readonly priority?: number
	enabled: boolean

	init?(logger: Logger, manager: PluginManager): void
	shouldHandle?(context: LogContext): boolean
	process(context: LogContext): LogContext | Promise<LogContext>
	destroy?(): void | Promise<void>
}
```

### 内置插件

#### 1. 错误解析插件 (ErrorParserPlugin)

-   解析 JavaScript 错误对象
-   提取堆栈信息和错误类型
-   格式化错误消息

#### 2. 敏感数据脱敏插件 (SensitiveDataPlugin)

-   基于 SensitiveMasker 的脱敏处理
-   支持多种脱敏规则配置
-   递归处理嵌套对象

#### 3. 去重插件 (DeduplicationPlugin)

-   基于 LogDeduplicator 的去重逻辑
-   支持自定义去重策略
-   提供统计信息

#### 4. 控制台输出插件 (ConsolePlugin)

-   格式化控制台输出
-   支持不同日志级别的样式
-   可配置输出格式

#### 5. 上报插件 (ReporterPlugin)

-   集成上报系统
-   支持多种上报方式选择
-   支持压缩和批量处理

#### 6. Web Vitals 监控插件 (WebVitalsPlugin)

-   监控核心 Web 性能指标
-   支持 LCP、FID、CLS 等指标
-   自动上报性能数据

#### 7. 网络监控插件 (FetchMonitorPlugin)

-   监控 Fetch 请求
-   记录请求耗时和状态
-   检测网络异常

#### 8. 资源监控插件 (ResourceMonitorPlugin)

-   监控静态资源加载
-   检测加载失败的资源
-   统计资源加载性能

#### 9. 全局错误监控插件 (ErrorMonitorPlugin)

-   监听全局未捕获错误
-   监听 Promise rejection
-   自动上报错误信息

## 上报机制

### 上报器架构

**位置**: `src/utils/log/reporters/`

采用工厂模式设计，支持多种上报方式和自动降级。

### 上报器类型

#### 1. FetchLogReporter

-   **特点**：现代浏览器首选，功能最完整
-   **优势**：支持 Promise、请求中止、完整的 HTTP 功能
-   **适用场景**：常规日志上报、现代浏览器环境

#### 2. BeaconLogReporter

-   **特点**：页面卸载时可靠发送
-   **优势**：不会被页面关闭中断、自动处理 beforeunload 事件
-   **适用场景**：页面关闭前的重要日志、用户行为追踪

#### 3. XhrLogReporter

-   **特点**：兼容性最好
-   **优势**：支持所有浏览器、功能完整
-   **适用场景**：老版本浏览器、企业内网环境

### 队列管理系统

**位置**: `src/utils/log/reporters/LogQueue.ts`

提供统一的队列管理功能：

**核心特性**：

-   **批量上报**：支持配置批量大小
-   **延迟发送**：避免频繁请求
-   **重试机制**：支持指数退避重试
-   **队列限制**：防止内存溢出
-   **统计监控**：提供队列状态统计

**配置选项**：

```typescript
interface LogQueueConfig {
	batchSize?: number // 批量大小，默认10
	delayMs?: number // 延迟时间，默认5000ms
	retryCount?: number // 重试次数，默认3
	maxQueueSize?: number // 最大队列大小，默认1000
}
```

### 工厂模式

**位置**: `src/utils/log/reporters/ReporterFactory.ts`

支持智能选择最佳上报器：

```typescript
// 自动选择最佳上报器
const reporter = ReporterFactory.createBest({
	priority: ["fetch", "beacon", "xhr"],
	enableFallback: true,
	queueConfig: {
		batchSize: 20,
		delayMs: 5000,
	},
})
```

## 数据安全与隐私

### 脱敏规则

系统内置多种脱敏规则，确保敏感数据不会被意外上报：

1. **邮箱脱敏**：`user@example.com` → `user******.com`
2. **API 密钥脱敏**：`sk-1234567890abcdef` → `sk-1****cdef`
3. **JWT Token 脱敏**：保留前后 10 位，中间用\*替代
4. **身份证脱敏**：保留前 6 位和后 4 位
5. **URL 参数脱敏**：敏感参数值进行脱敏
6. **自定义关键词**：支持配置敏感关键词列表

### 脱敏配置

```typescript
const sensitiveConfig = {
	keys: ["password", "token", "secret", "auth", "account", "address", "phone", "email"],
	patterns: [
		{ pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/ },
		{ pattern: /(\bapi[_-]?key=)([^&\s]+)/gi },
	],
	preserveStart: 4,
	preserveEnd: 4,
	maskChar: "*",
}
```

## 性能优化

### 1. 智能去重

-   基于日志内容生成哈希值
-   时间窗口内的重复日志合并
-   指数退避策略减少网络请求

### 2. 批量上报

-   支持配置批量大小
-   延迟发送减少请求频率
-   压缩算法减少传输数据量

### 3. 异步处理

-   所有日志处理都在异步环境中执行
-   使用 requestIdleCallback 避免阻塞主线程
-   插件并行处理提高效率

### 4. 内存管理

-   定期清理过期的缓存数据
-   限制队列最大大小
-   及时释放不再使用的资源

## 监控与统计

### 插件统计

```typescript
// 获取插件统计信息
const pluginStats = logger.getPluginManager().getStats()
/*
{
  total: 9,
  enabled: 8,
  disabled: 1,
  plugins: [
    { name: "errorParser", enabled: true, priority: 10 },
    { name: "sensitiveData", enabled: true, priority: 20 }
  ]
}
*/
```

### 去重统计

```typescript
// 获取去重统计信息
const deduplicationStats = LogDeduplicator.getInstance().getStats()
/*
{
  totalCachedLogs: 156,
  recentLogs: 23,
  duplicatesByNamespace: {
    "api": 45,
    "ui": 12,
    "error": 67
  }
}
*/
```

### 队列统计

```typescript
// 获取队列统计信息
const queueStats = logQueue.getStats()
/*
{
  pendingCount: 15,
  sentCount: 234,
  failedCount: 3,
  totalProcessed: 252
}
*/
```

## 运营数据采集扩展

基于当前的插件化架构，我们可以轻松扩展运营层面的数据采集功能。

### 1. 用户行为分析插件

**功能**：追踪用户的关键行为路径和交互模式

```typescript
// 建议实现：UserBehaviorPlugin
interface UserBehaviorData {
	userId: string
	sessionId: string
	action: string // 行为类型：click, scroll, input, navigation
	element: string // 元素标识
	page: string // 页面路径
	timestamp: number
	duration?: number // 停留时长
	metadata: {
		coordinates?: { x: number; y: number }
		scrollDepth?: number
		inputLength?: number
		previousPage?: string
	}
}

// 采集策略
const behaviorPlugin = createUserBehaviorPlugin({
	trackClicks: true, // 点击追踪
	trackScrolling: true, // 滚动追踪
	trackInputs: false, // 输入追踪（需考虑隐私）
	trackNavigation: true, // 页面导航追踪
	samplingRate: 0.1, // 采样率10%
	batchSize: 50, // 批量上报大小
	reportInterval: 30000, // 30秒上报一次
})
```

**运营价值**：

-   识别用户使用热点功能
-   分析用户流失点
-   优化界面布局和交互设计
-   个性化推荐算法数据支持

### 2. 业务指标监控插件

**功能**：监控关键业务指标和转化漏斗

```typescript
// 建议实现：BusinessMetricsPlugin
interface BusinessMetric {
	metricName: string // 指标名称
	metricValue: number // 指标值
	metricType: "counter" | "gauge" | "histogram"
	dimensions: Record<string, string> // 维度标签
	timestamp: number
}

// 使用示例
logger.report("business_metric", {
	metricName: "document_created",
	metricValue: 1,
	metricType: "counter",
	dimensions: {
		documentType: "presentation",
		userTier: "premium",
		feature: "ai_assistant",
	},
})

// 转化漏斗追踪
logger.report("funnel_step", {
	funnelName: "user_onboarding",
	stepName: "email_verification",
	stepOrder: 2,
	success: true,
	userId: "user_123",
})
```

**运营价值**：

-   实时监控业务关键指标
-   分析功能使用率和转化率
-   A/B 测试效果评估
-   产品决策数据支持

### 3. 性能体验监控插件

**功能**：全面监控用户体验相关的性能指标

```typescript
// 建议实现：UserExperiencePlugin
interface UXMetric {
	metricType: "page_load" | "interaction" | "resource" | "error"
	value: number
	context: {
		page: string
		userAgent: string
		networkType?: string
		deviceType?: string
		location?: string
	}
	timestamp: number
}

// 扩展监控指标
const uxPlugin = createUserExperiencePlugin({
	// 页面加载性能
	trackPageLoad: {
		enabled: true,
		includeResourceTiming: true,
		trackLargestContentfulPaint: true,
		trackFirstInputDelay: true,
		trackCumulativeLayoutShift: true,
	},

	// 交互性能
	trackInteractions: {
		enabled: true,
		trackClickDelay: true,
		trackScrollJank: true,
		trackInputLatency: true,
	},

	// 错误影响分析
	trackErrorImpact: {
		enabled: true,
		correlateWithUserActions: true,
		trackRecoveryTime: true,
	},
})
```

**运营价值**：

-   识别性能瓶颈和用户痛点
-   监控不同用户群体的体验差异
-   量化性能优化的业务价值
-   建立性能预警机制

### 4. 特征工程数据插件

**功能**：为机器学习和数据分析提供特征数据

```typescript
// 建议实现：FeatureEngineeringPlugin
interface FeatureData {
	userId: string
	sessionId: string
	features: {
		// 用户特征
		userTenure: number // 用户使用时长
		activityLevel: "low" | "medium" | "high"
		preferredFeatures: string[] // 偏好功能

		// 会话特征
		sessionDuration: number // 会话时长
		pagesVisited: number // 访问页面数
		actionsPerformed: number // 执行操作数
		errorEncountered: number // 遇到错误数

		// 上下文特征
		timeOfDay: "morning" | "afternoon" | "evening" | "night"
		dayOfWeek: string
		deviceType: "mobile" | "tablet" | "desktop"
		browserType: string

		// 业务特征
		documentsCreated: number // 创建文档数
		collaborationsInitiated: number // 发起协作数
		premiumFeaturesUsed: string[] // 使用的高级功能
	}
	timestamp: number
}
```

**运营价值**：

-   用户分群和画像构建
-   个性化推荐系统
-   流失预测模型
-   产品智能化功能

### 5. 实时运营决策插件

**功能**：支持实时运营决策的数据采集

```typescript
// 建议实现：RealtimeOperationsPlugin
interface OperationalEvent {
	eventType: string
	severity: "low" | "medium" | "high" | "critical"
	affectedUsers?: string[]
	impactScope: "user" | "team" | "organization" | "global"
	metadata: Record<string, any>
	timestamp: number
}

// 实时事件示例
const events = [
	{
		eventType: "feature_adoption_spike",
		severity: "medium",
		metadata: {
			featureName: "ai_writing_assistant",
			adoptionRate: 0.45,
			previousRate: 0.12,
			timeWindow: "1hour",
		},
	},
	{
		eventType: "error_rate_increase",
		severity: "high",
		impactScope: "global",
		metadata: {
			errorType: "api_timeout",
			affectedEndpoint: "/api/documents/save",
			errorRate: 0.15,
			baselineRate: 0.02,
		},
	},
]
```

**运营价值**：

-   实时监控系统健康度
-   快速响应用户问题
-   动态调整产品策略
-   自动化运营决策

### 6. 数据采集配置管理

```typescript
// 统一的采集配置管理
interface DataCollectionConfig {
	// 采集开关
	enableUserBehavior: boolean
	enableBusinessMetrics: boolean
	enableUXMonitoring: boolean
	enableFeatureEngineering: boolean
	enableRealtimeOperations: boolean

	// 采样配置
	samplingRates: {
		userBehavior: number // 用户行为采样率
		performance: number // 性能数据采样率
		businessEvents: number // 业务事件采样率
	}

	// 上报配置
	reportingConfig: {
		batchSizes: Record<string, number>
		intervals: Record<string, number>
		priorities: Record<string, number>
	}

	// 隐私配置
	privacyConfig: {
		anonymizeUserIds: boolean
		excludeSensitivePages: string[]
		dataRetentionDays: number
	}
}

// 动态配置更新
const configManager = new DataCollectionConfigManager({
	remoteConfigUrl: "/api/data-collection-config",
	refreshInterval: 300000, // 5分钟刷新一次
	fallbackConfig: defaultConfig,
})
```

### 7. 数据管道和存储建议

**实时数据管道**：

```
前端日志 → 消息队列(Kafka) → 流处理(Flink) → 实时存储(Redis/ClickHouse)
                                      ↓
                               批处理(Spark) → 数据仓库(BigQuery/Snowflake)
```

**存储策略**：

-   **热数据**：Redis (实时查询，7 天)
-   **温数据**：ClickHouse (分析查询，90 天)
-   **冷数据**：对象存储 (长期归档，>90 天)

**数据治理**：

-   数据血缘追踪
-   数据质量监控
-   隐私合规检查
-   自动化数据清理

### 8. 运营仪表板集成

基于采集的数据，建议构建以下运营仪表板：

**实时监控仪表板**：

-   系统健康度指标
-   用户活跃度实时统计
-   错误率和性能指标
-   关键业务指标趋势

**用户分析仪表板**：

-   用户行为热力图
-   功能使用率分析
-   用户旅程分析
-   流失用户分析

**产品分析仪表板**：

-   功能采用率趋势
-   A/B 测试结果
-   转化漏斗分析
-   产品性能评估

**运营决策仪表板**：

-   关键指标预警
-   异常检测结果
-   自动化建议
-   ROI 分析报告

## 最佳实践

### 1. 插件开发

-   遵循单一职责原则
-   实现完整的生命周期方法
-   提供详细的错误处理
-   支持配置验证

### 2. 性能优化

-   合理配置批量大小和延迟时间
-   使用采样策略减少数据量
-   定期清理缓存数据
-   监控内存使用情况

### 3. 数据安全

-   严格执行数据脱敏规则
-   定期审查敏感关键词列表
-   实施数据访问权限控制
-   遵循数据保护法规

### 4. 监控运维

-   建立完善的监控指标体系
-   设置合理的告警阈值
-   定期分析日志采集效果
-   持续优化采集策略

### 5. 扩展开发

-   基于插件架构开发新功能
-   保持向后兼容性
-   提供完整的文档和示例
-   进行充分的测试验证

## 总结

本日志采集系统采用现代化的架构设计，具备高度的可扩展性和灵活性。通过插件化架构，系统可以根据不同的业务需求进行定制和扩展。完善的数据安全机制确保了用户隐私和企业数据的安全。多样化的上报机制保证了日志数据的可靠传输。

未来，系统可以进一步扩展运营数据采集功能，为业务决策提供更加丰富和准确的数据支持，实现从技术监控到业务智能的全面升级。
