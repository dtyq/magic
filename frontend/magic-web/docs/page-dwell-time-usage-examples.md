# 页面停留时间统计 - 使用示例

## 快速开始

### 1. 基础使用

```typescript
import { pageTracker } from "@/opensource/utils/log/logger/PageTrackingLogger"

// 在页面加载时开始跟踪
pageTracker.startTracking("home-page", {
	source: "direct",
	campaign: "homepage-redesign",
})

// 在页面卸载时会自动结束跟踪
// 也可以手动结束
// pageTracker.stopTracking()
```

### 2. React 组件中使用

```typescript
import React from "react"
import { usePageTracking } from "@/opensource/utils/log/logger/PageTrackingLogger"

function HomePage() {
	// 自动开始和结束页面跟踪
	const { trackEvent, trackPerformance, getCurrentState } = usePageTracking("home-page", {
		version: "v2.0",
		experiment: "new-layout",
	})

	const handleButtonClick = () => {
		// 跟踪用户交互事件
		trackEvent("button_click", {
			buttonId: "cta-primary",
			section: "hero",
		})
	}

	const handleLoadComplete = () => {
		// 跟踪页面性能
		trackPerformance({
			loadTime: performance.now(),
			resourceCount: document.querySelectorAll("img, script, link").length,
		})
	}

	return (
		<div>
			<h1>欢迎来到首页</h1>
			<button onClick={handleButtonClick}>开始使用</button>
		</div>
	)
}
```

### 3. Vue 组件中使用

```typescript
<template>
  <div>
    <h1>产品页面</h1>
    <button @click="handlePurchase">立即购买</button>
  </div>
</template>

<script setup lang="ts">
import { usePageTrackingVue } from '@/opensource/utils/log/logger/PageTrackingLogger'

// 自动开始和结束页面跟踪
const { trackEvent, trackPerformance } = usePageTrackingVue('product-page', {
  productId: 'prod-123',
  category: 'software'
})

const handlePurchase = () => {
  trackEvent('purchase_intent', {
    productId: 'prod-123',
    price: 99.99
  })
}
</script>
```

### 4. SPA 路由集成

#### React Router 集成

```typescript
import { useEffect } from "react"
import { useLocation } from "react-router-dom"
import { pageTracker } from "@/opensource/utils/log/logger/PageTrackingLogger"

function App() {
	const location = useLocation()

	useEffect(() => {
		// 路由变化时开始新的页面跟踪
		const pageId = location.pathname.replace("/", "") || "home"
		pageTracker.startTracking(pageId, {
			route: location.pathname,
			search: location.search,
			hash: location.hash,
		})
	}, [location])

	return <Routes>{/* 路由配置 */}</Routes>
}
```

#### Vue Router 集成

```typescript
import { watch } from "vue"
import { useRoute } from "vue-router"
import { pageTracker } from "@/opensource/utils/log/logger/PageTrackingLogger"

export default {
	setup() {
		const route = useRoute()

		watch(
			() => route.path,
			(newPath) => {
				const pageId = newPath.replace("/", "") || "home"
				pageTracker.startTracking(pageId, {
					route: newPath,
					query: route.query,
					params: route.params,
				})
			},
			{ immediate: true },
		)
	},
}
```

## 高级配置

### 1. 自定义页面追踪器

```typescript
import Logger from "@/opensource/utils/log/Logger"
import { BuiltinPlugins } from "@/opensource/utils/log/plugins"

// 创建专门的页面追踪器，针对特定业务场景优化
const customPageTracker = new Logger("custom_page_tracking", {
	plugins: [
		BuiltinPlugins.pageDwellTime({
			// 针对内容页面的配置
			minDwellTime: 2000, // 内容页面最小2秒才统计
			maxDwellTime: 60 * 60 * 1000, // 1小时分段上报
			heartbeatInterval: 30000, // 30秒心跳，适合长内容
			inactiveTimeout: 60000, // 1分钟无操作视为非活跃
			trackScrollDepth: true, // 重要：跟踪阅读深度
			samplingRate: 0.5, // 50%采样

			// 针对内容消费的特殊配置
			reportOnVisibilityChange: true, // 切换标签页时立即上报
			batchSize: 3, // 小批量，快速上报
			reportDelay: 2000, // 2秒延迟
		}),

		// 其他插件配置...
	],
})
```

### 2. 条件性跟踪

```typescript
import { pageTracker } from "@/opensource/utils/log/logger/PageTrackingLogger"

class ConditionalPageTracker {
	private shouldTrack(pageId: string): boolean {
		// 根据业务规则决定是否跟踪
		const excludePages = ["login", "register", "error"]
		if (excludePages.includes(pageId)) return false

		// 只跟踪登录用户
		const user = getCurrentUser()
		if (!user) return false

		// 根据用户权限决定
		if (user.role === "admin") return true
		if (user.isPremium) return true

		// 普通用户随机采样
		return Math.random() < 0.1
	}

	startTracking(pageId: string, metadata?: any) {
		if (this.shouldTrack(pageId)) {
			pageTracker.startTracking(pageId, {
				...metadata,
				trackingReason: "qualified_user",
			})
		}
	}
}
```

### 3. 性能优化配置

```typescript
// 针对移动端的优化配置
const mobileOptimizedConfig = {
	enabled: true,
	minDwellTime: 500, // 移动端用户停留时间较短
	heartbeatInterval: 20000, // 降低心跳频率，节省电池
	inactiveTimeout: 15000, // 移动端更快进入非活跃状态
	trackScrollDepth: true, // 移动端滚动是重要指标
	trackInteractions: false, // 减少事件监听，提高性能
	samplingRate: 0.05, // 移动端5%采样
	batchSize: 2, // 小批量，快速上报
	reportDelay: 1000, // 1秒延迟，快速上报
}

// 针对桌面端的配置
const desktopOptimizedConfig = {
	enabled: true,
	minDwellTime: 1000,
	heartbeatInterval: 15000,
	inactiveTimeout: 30000,
	trackScrollDepth: true,
	trackInteractions: true,
	samplingRate: 0.2, // 桌面端20%采样
	batchSize: 10,
	reportDelay: 5000,
}

// 根据设备类型动态配置
function getDeviceOptimizedConfig() {
	const isMobile = /Mobi|Android/i.test(navigator.userAgent)
	return isMobile ? mobileOptimizedConfig : desktopOptimizedConfig
}
```

## 数据分析示例

### 1. 基础统计查询

```sql
-- 页面平均停留时间统计
SELECT
  page,
  COUNT(*) as visit_count,
  AVG(dwellTime / 1000) as avg_dwell_seconds,
  AVG(visibleDwellTime / 1000) as avg_visible_seconds,
  AVG(activeDwellTime / 1000) as avg_active_seconds,
  AVG(maxScrollDepth) as avg_scroll_depth,
  AVG(interactionCount) as avg_interactions
FROM page_dwell_logs
WHERE dwellTime >= 1000  -- 过滤掉过短访问
  AND timestamp >= UNIX_TIMESTAMP(DATE_SUB(NOW(), INTERVAL 7 DAY)) * 1000
GROUP BY page
ORDER BY visit_count DESC;
```

### 2. 用户行为分析

```sql
-- 用户参与度分析
SELECT
  CASE
    WHEN activeDwellTime / visibleDwellTime >= 0.8 THEN 'high_engagement'
    WHEN activeDwellTime / visibleDwellTime >= 0.5 THEN 'medium_engagement'
    ELSE 'low_engagement'
  END as engagement_level,
  COUNT(*) as session_count,
  AVG(dwellTime / 1000) as avg_dwell_time,
  AVG(maxScrollDepth) as avg_scroll_depth
FROM page_dwell_logs
WHERE visibleDwellTime > 0
GROUP BY engagement_level;
```

### 3. 页面性能关联分析

```sql
-- 停留时间与页面性能的关联分析
SELECT
  p.page,
  AVG(p.dwellTime / 1000) as avg_dwell_time,
  AVG(perf.loadTime) as avg_load_time,
  CORR(p.dwellTime, perf.loadTime) as correlation
FROM page_dwell_logs p
JOIN page_performance_logs perf ON p.sessionId = perf.sessionId
WHERE p.dwellTime >= 1000
GROUP BY p.page
HAVING COUNT(*) >= 100  -- 至少100个样本
ORDER BY correlation DESC;
```

## 监控和告警

### 1. 数据质量监控

```typescript
// 数据质量检查器
class PageTrackingQualityMonitor {
	private checkDataQuality() {
		const recentLogs = this.getRecentLogs(24 * 60 * 60 * 1000) // 24小时内的数据

		const qualityMetrics = {
			totalSessions: recentLogs.length,
			validSessions: recentLogs.filter((log) => this.isValidSession(log)).length,
			averageDwellTime: this.calculateAverage(recentLogs, "dwellTime"),
			suspiciousSessions: recentLogs.filter((log) => this.isSuspicious(log)).length,
		}

		// 发送质量报告
		this.reportQualityMetrics(qualityMetrics)
	}

	private isValidSession(log: any): boolean {
		return (
			log.dwellTime >= 1000 &&
			log.dwellTime <= 24 * 60 * 60 * 1000 &&
			log.visibleDwellTime <= log.dwellTime &&
			log.activeDwellTime <= log.visibleDwellTime
		)
	}

	private isSuspicious(log: any): boolean {
		// 检测异常数据
		return (
			log.dwellTime > 2 * 60 * 60 * 1000 || // 超过2小时
			log.interactionCount > 1000 || // 交互次数异常多
			log.visibilityChangeCount > 50
		) // 可见性变化异常频繁
	}
}
```

### 2. 实时告警

```typescript
// 实时数据异常告警
class PageTrackingAlertManager {
	private setupAlerts() {
		// 数据量异常告警
		this.monitorDataVolume()

		// 性能影响告警
		this.monitorPerformanceImpact()

		// 错误率告警
		this.monitorErrorRate()
	}

	private monitorDataVolume() {
		setInterval(
			() => {
				const currentHourVolume = this.getCurrentHourDataVolume()
				const expectedVolume = this.getExpectedVolume()

				if (currentHourVolume < expectedVolume * 0.5) {
					this.sendAlert("数据量异常偏低", {
						current: currentHourVolume,
						expected: expectedVolume,
						severity: "warning",
					})
				}
			},
			60 * 60 * 1000,
		) // 每小时检查一次
	}
}
```

## 隐私和合规

### 1. 数据脱敏配置

```typescript
const privacyConfig = {
	// 自动脱敏用户标识
	anonymizeUserId: true,

	// 脱敏URL中的敏感参数
	sensitiveUrlParams: ["token", "key", "secret", "userId", "email"],

	// 排除敏感页面
	excludePages: ["/login", "/register", "/payment", "/personal-info", "/settings/security"],

	// 数据保留期限
	dataRetentionDays: 90,

	// 地理位置限制
	allowedRegions: ["CN", "US", "EU"],
}
```

### 2. 用户同意管理

```typescript
class ConsentManager {
	private hasTrackingConsent(): boolean {
		// 检查用户是否同意数据跟踪
		return localStorage.getItem("tracking_consent") === "granted"
	}

	private requestConsent(): Promise<boolean> {
		// 显示同意弹窗
		return new Promise((resolve) => {
			showConsentDialog({
				onAccept: () => {
					localStorage.setItem("tracking_consent", "granted")
					resolve(true)
				},
				onDecline: () => {
					localStorage.setItem("tracking_consent", "denied")
					resolve(false)
				},
			})
		})
	}

	async initializeTracking() {
		if (!this.hasTrackingConsent()) {
			const consent = await this.requestConsent()
			if (!consent) {
				// 禁用跟踪
				pageTracker.destroy()
				return
			}
		}

		// 启用跟踪
		pageTracker.startTracking(getCurrentPageId())
	}
}
```

## 故障排除

### 1. 常见问题诊断

```typescript
class PageTrackingDiagnostics {
	runDiagnostics() {
		const results = {
			pluginLoaded: this.checkPluginLoaded(),
			eventListeners: this.checkEventListeners(),
			dataUpload: this.checkDataUpload(),
			performance: this.checkPerformanceImpact(),
			sampling: this.checkSamplingRate(),
		}

		console.table(results)
		return results
	}

	private checkPluginLoaded(): boolean {
		const plugin = PageTrackingLogger.getPluginManager().get("pageDwellTime")
		return plugin && plugin.enabled
	}

	private checkEventListeners(): boolean {
		// 检查关键事件监听器是否正常工作
		const testEvent = new Event("visibilitychange")
		document.dispatchEvent(testEvent)
		return true // 简化实现
	}

	private checkDataUpload(): boolean {
		// 检查数据是否正常上报
		const pendingCount = this.getPendingDataCount()
		return pendingCount < 100 // 待上报数据不超过100条
	}
}
```

### 2. 调试工具

```typescript
// 开发环境调试工具
if (process.env.NODE_ENV === "development") {
	// 暴露全局调试接口
	;(window as any).pageTrackingDebug = {
		getCurrentState: () => pageTracker.getCurrentState(),
		getStats: () => PageTrackingLogger.getPluginManager().getStats(),
		runDiagnostics: () => new PageTrackingDiagnostics().runDiagnostics(),

		// 模拟各种场景
		simulatePageHide: () => document.dispatchEvent(new Event("pagehide")),
		simulateVisibilityChange: () => {
			Object.defineProperty(document, "hidden", { value: true, configurable: true })
			document.dispatchEvent(new Event("visibilitychange"))
		},
	}
}
```

通过这些示例和配置，您可以根据具体的业务需求和技术环境，灵活地实施页面停留时间统计功能，确保数据的准确性和系统的稳定性。
