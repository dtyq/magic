# 页面停留时间统计方案

## 概述

基于现有的日志采集系统，我设计了一个高精度的页面停留时间统计插件 `PageDwellTimePlugin`，确保数据的准确性和可靠性。

## 核心设计原则

### 1. 多维度时间统计

- **总停留时间**：用户从进入页面到离开页面的总时长
- **可见停留时间**：页面处于可见状态的累计时长（排除切换标签页、最小化等情况）
- **活跃停留时间**：用户实际与页面交互的累计时长（排除无操作状态）

### 2. 准确性保障机制

- **实时状态跟踪**：监听页面可见性、焦点状态、用户交互
- **心跳检测**：定期更新时间计算，防止长时间停留造成的计算偏差
- **事件驱动**：基于真实的浏览器事件，而非简单的时间差计算
- **异常处理**：处理页面刷新、强制关闭、网络断开等异常情况

### 3. 性能优化

- **事件节流**：对高频事件（滚动、鼠标移动）进行节流处理
- **异步上报**：使用 `requestIdleCallback` 在浏览器空闲时上报数据
- **批量处理**：多条数据批量上报，减少网络请求
- **采样控制**：支持采样率配置，降低性能影响

## 技术实现方案

### 1. 核心数据结构

```typescript
interface PageDwellData {
	// 基础信息
	page: string // 页面路径
	title: string // 页面标题
	enterTime: number // 进入时间戳
	leaveTime: number // 离开时间戳

	// 时间统计
	dwellTime: number // 总停留时长（毫秒）
	visibleDwellTime: number // 可见停留时长（毫秒）
	activeDwellTime: number // 活跃停留时长（毫秒）

	// 用户行为
	visibilityChangeCount: number // 可见性变化次数
	interactionCount: number // 用户交互次数
	maxScrollDepth: number // 最大滚动深度百分比

	// 会话信息
	sessionId: string // 会话ID
	userId?: string // 用户ID

	// 离开方式
	isNormalLeave: boolean // 是否正常离开
	leaveType: "navigation" | "beforeunload" | "pagehide" | "visibilitychange" | "manual"

	// 环境信息
	metadata: {
		referrer?: string // 来源页面
		userAgent?: string // 用户代理
		screenResolution?: string // 屏幕分辨率
		viewportSize?: string // 视口大小
		deviceType?: "mobile" | "tablet" | "desktop"
		networkType?: string // 网络类型
	}
}
```

### 2. 关键算法

#### 可见时间计算

```typescript
// 页面可见时开始计时
if (!document.hidden) {
	session.visibleStartTime = now
}

// 页面不可见时累加时间
if (document.hidden && session.visibleStartTime > 0) {
	session.visibleDwellTime += now - session.visibleStartTime
	session.visibleStartTime = 0
}
```

#### 活跃时间计算

```typescript
// 用户交互时重置活跃状态
handleUserActivity() {
  session.lastActivityTime = now
  if (!session.isActive) {
    session.isActive = true
    session.activeStartTime = now
  }
}

// 超时后标记为非活跃
setTimeout(() => {
  if (now - session.lastActivityTime > inactiveTimeout) {
    session.activeDwellTime += now - session.activeStartTime
    session.isActive = false
  }
}, inactiveTimeout)
```

#### 滚动深度计算

```typescript
updateScrollDepth() {
  const scrollTop = window.pageYOffset
  const documentHeight = document.documentElement.scrollHeight - window.innerHeight
  const scrollDepth = Math.round((scrollTop / documentHeight) * 100)
  session.maxScrollDepth = Math.max(session.maxScrollDepth, scrollDepth)
}
```

## 使用方法

### 1. 基础集成

```typescript
import { createPageDwellTimePlugin } from "@/opensource/utils/log/plugins/builtin/PageDwellTimePlugin"
import Logger from "@/opensource/utils/log/Logger"

// 创建专门的页面统计日志器
const pageTrackingLogger = new Logger("page_tracking", {
	plugins: [
		createPageDwellTimePlugin({
			enabled: true,
			minDwellTime: 1000, // 最小统计时长1秒
			heartbeatInterval: 15000, // 15秒心跳
			inactiveTimeout: 30000, // 30秒无操作视为非活跃
			trackScrollDepth: true, // 跟踪滚动深度
			trackInteractions: true, // 跟踪用户交互
			samplingRate: 1.0, // 100%采样
			batchSize: 10, // 批量上报10条
			reportDelay: 5000, // 5秒延迟上报
		}),
		// 其他必要插件
		createSensitiveDataPlugin(),
		createReporterPlugin(),
	],
})
```

### 2. SPA 应用集成

```typescript
// React Router 集成示例
import { useEffect } from "react"
import { useLocation } from "react-router-dom"

function App() {
	const location = useLocation()
	const pageDwellPlugin = pageTrackingLogger.getPluginManager().get("pageDwellTime")

	useEffect(() => {
		// 路由变化时结束当前会话，开始新会话
		if (pageDwellPlugin) {
			pageDwellPlugin.endCurrentSession()
		}
	}, [location.pathname])

	return <div>...</div>
}
```

### 3. 高级配置

```typescript
const advancedConfig = {
	// 性能优化
	samplingRate: 0.1, // 10%采样，降低性能影响
	minDwellTime: 3000, // 提高最小统计时长到3秒
	maxDwellTime: 20 * 60 * 1000, // 20分钟分段上报

	// 精确度控制
	heartbeatInterval: 10000, // 10秒心跳，提高精确度
	inactiveTimeout: 15000, // 15秒无操作超时

	// 上报策略
	reportOnVisibilityChange: true, // 页面隐藏时立即上报
	batchSize: 5, // 小批量上报
	reportDelay: 3000, // 3秒延迟上报

	// 功能开关
	trackScrollDepth: true, // 启用滚动深度跟踪
	trackInteractions: true, // 启用交互跟踪
}
```

## 数据准确性保障

### 1. 时间同步机制

```typescript
// 定期校准时间，防止长时间运行导致的累积误差
setInterval(() => {
	const now = performance.now() + performance.timeOrigin
	this.updateDwellTimes(now)
}, heartbeatInterval)
```

### 2. 异常情况处理

```typescript
// 页面卸载时的数据保护
window.addEventListener("beforeunload", () => {
	// 立即计算并上报最终数据
	this.endPageSession("beforeunload")
	// 使用 sendBeacon 确保数据发送
	this.flushPendingReports()
})

// 页面隐藏时的数据保护
document.addEventListener("visibilitychange", () => {
	if (document.hidden) {
		// 页面隐藏时立即上报当前数据
		this.reportCurrentSession()
	}
})
```

### 3. 数据完整性验证

```typescript
// 上报前的数据验证
validateDwellData(data: PageDwellData): boolean {
  // 检查时间逻辑
  if (data.leaveTime < data.enterTime) return false
  if (data.visibleDwellTime > data.dwellTime) return false
  if (data.activeDwellTime > data.visibleDwellTime) return false

  // 检查最小时长要求
  if (data.dwellTime < this.options.minDwellTime) return false

  return true
}
```

## 运营数据分析

### 1. 基础指标

- **平均停留时长**：所有用户的平均页面停留时间
- **有效停留时长**：排除非活跃时间的平均停留时长
- **页面跳出率**：停留时间小于阈值的访问比例
- **深度浏览率**：滚动深度超过 50%的访问比例

### 2. 用户行为分析

```sql
-- 页面停留时长分布
SELECT
  page,
  AVG(dwellTime) as avg_dwell_time,
  AVG(visibleDwellTime) as avg_visible_time,
  AVG(activeDwellTime) as avg_active_time,
  AVG(maxScrollDepth) as avg_scroll_depth,
  COUNT(*) as visit_count
FROM page_dwell_logs
WHERE dwellTime >= 1000  -- 过滤掉过短访问
GROUP BY page
ORDER BY avg_dwell_time DESC
```

### 3. 异常检测

```sql
-- 检测异常的停留时间数据
SELECT *
FROM page_dwell_logs
WHERE
  dwellTime > 30 * 60 * 1000  -- 超过30分钟
  OR visibleDwellTime > dwellTime  -- 可见时间超过总时间
  OR activeDwellTime > visibleDwellTime  -- 活跃时间超过可见时间
  OR visibilityChangeCount > 100  -- 异常的可见性变化次数
```

## 最佳实践建议

### 1. 采样策略

```typescript
// 根据用户类型调整采样率
const getSamplingRate = (userId: string): number => {
	// VIP用户100%采样
	if (isVipUser(userId)) return 1.0

	// 新用户50%采样
	if (isNewUser(userId)) return 0.5

	// 普通用户10%采样
	return 0.1
}
```

### 2. 性能监控

```typescript
// 监控插件性能影响
const performanceMonitor = {
	startTime: 0,
	endTime: 0,

	measurePluginImpact() {
		this.startTime = performance.now()
		// 执行插件逻辑
		this.endTime = performance.now()

		const duration = this.endTime - this.startTime
		if (duration > 5) {
			// 超过5ms记录性能问题
			console.warn(`PageDwellTimePlugin performance issue: ${duration}ms`)
		}
	},
}
```

### 3. 数据质量保证

```typescript
// 数据清洗规则
const cleanDwellData = (data: PageDwellData): PageDwellData | null => {
	// 过滤异常数据
	if (data.dwellTime < 100 || data.dwellTime > 24 * 60 * 60 * 1000) {
		return null // 过短或过长的访问
	}

	// 修正数据异常
	if (data.visibleDwellTime > data.dwellTime) {
		data.visibleDwellTime = data.dwellTime
	}

	if (data.activeDwellTime > data.visibleDwellTime) {
		data.activeDwellTime = data.visibleDwellTime
	}

	return data
}
```

### 4. 隐私保护

```typescript
// 敏感数据处理
const sanitizeDwellData = (data: PageDwellData): PageDwellData => {
	return {
		...data,
		// 移除或脱敏敏感信息
		userId: data.userId ? hashUserId(data.userId) : undefined,
		metadata: {
			...data.metadata,
			userAgent: data.metadata.userAgent?.substring(0, 50), // 截断用户代理
		},
	}
}
```

## 总结

这个页面停留时间统计方案具有以下优势：

1. **高精度**：多维度时间统计，区分总时长、可见时长、活跃时长
2. **高可靠性**：完善的异常处理和数据保护机制
3. **高性能**：事件节流、批量上报、采样控制
4. **易扩展**：基于插件架构，可灵活配置和扩展
5. **数据完整**：收集丰富的上下文信息，支持深度分析

通过这个方案，您可以获得准确、可靠的页面停留时间数据，为产品优化和用户体验改进提供有力的数据支撑。
