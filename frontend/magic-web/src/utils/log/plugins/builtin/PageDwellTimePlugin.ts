import { RouteTracker } from "../../trackers/RouteTracker"
import type { RouteChangeInfo } from "../../trackers/RouteTracker"
import type { LogContext, LoggerPlugin } from "../types"
import Logger from "@/utils/log/Logger"
import { throttle } from "lodash-es"

const INACTIVE_TIMEOUT = 10 * 60 * 1000 // 5分钟无活动超时

// Session会话接口
interface SessionInfo {
	route: RouteChangeInfo
	/** 页面打开时间 */
	start: number //
	/** 页面离开时间 */
	end: number //
	/** 会话开始时间戳 */
	startTime: number //
	/** 累计持续时间（毫秒） */
	duration: number
	/** 最后活动时间 */
	lastActiveTime: number
	/** 是否处于活动状态 */
	isActive: boolean
}

// 用户活动事件类型
const ACTIVITY_EVENTS = [
	"mousemove",
	"mousedown",
	"mouseup",
	"click",
	"keydown",
	"keyup",
	"scroll",
	"touchstart",
	"touchmove",
	"touchend",
] as const

export class PageDwellTimePlugin implements LoggerPlugin {
	/** 插件名称 */
	readonly name = "PageDwellTime"
	/** 插件版本 */
	readonly version?: "1.0.0"
	/** 插件优先级，数字越小优先级越高 */
	readonly priority?: 90
	/** 插件是否启用 */
	enabled: boolean = true

	private logger?: Logger | null = null
	private timer: NodeJS.Timeout | null = null
	private session: SessionInfo | null = null
	private activityListeners: Array<() => void> = []
	private throttledResetTimer: (() => void) | null = null

	// 页面生命周期监听器
	private lifecycleListeners: Array<() => void> = []
	private isPageVisible = true

	/**
	 * 插件初始化
	 */
	init?(logger: Logger) {
		this.logger = logger

		// 路由变化监听器
		RouteTracker.onRouteChange((route: RouteChangeInfo) => {
			if (this.session) {
				this.destroySession()
			}
			this.session = this.createSession(route)
		})
	}

	// 创建会话
	private createSession(route: RouteChangeInfo): SessionInfo {
		const now = performance.now()

		const session: SessionInfo = {
			route,
			start: Date.now(),
			end: 0,
			duration: 0,
			startTime: now,
			lastActiveTime: now,
			isActive: true,
		}

		// 设置活动监听器
		this.setupActivityListeners()

		// 浏览器边界事件
		this.setupPageLifecycleListeners()

		// 启动非活动定时器
		this.startInactivityTimer()

		return session
	}

	private setupPageLifecycleListeners() {
		// beforeunload - 页面即将卸载
		const beforeUnloadHandler = () => {
			this.destroySession("before_unload")
		}
		window.addEventListener("beforeunload", beforeUnloadHandler)
		this.lifecycleListeners.push(() =>
			window.removeEventListener("beforeunload", beforeUnloadHandler),
		)

		// pagehide - 页面隐藏（更可靠的页面退出检测）
		const pageHideHandler = () => {
			this.destroySession("page_hide")
		}
		window.addEventListener("pagehide", pageHideHandler)
		this.lifecycleListeners.push(() => window.removeEventListener("pagehide", pageHideHandler))

		// visibilitychange - 页面可见性变化
		const visibilityChangeHandler = () => {
			const isVisible = document.visibilityState === "visible"

			if (!isVisible && this.isPageVisible) {
				// 页面变为不可见
				this.handlePageVisibilityChange("hidden")
			} else if (isVisible && !this.isPageVisible) {
				// 页面变为可见
				this.handlePageVisibilityChange("visible")
			}

			this.isPageVisible = isVisible
		}
		document.addEventListener("visibilitychange", visibilityChangeHandler)

		// focus/blur - 窗口焦点变化
		const focusHandler = () => {
			// 窗口获得焦点
			if (this.session && !this.session.isActive) {
				this.onUserActivity()
			}
		}
		const blurHandler = () => {
			// 窗口失去焦点
		}
		window.addEventListener("focus", focusHandler)
		window.addEventListener("blur", blurHandler)
		this.lifecycleListeners.push(() => {
			window.removeEventListener("focus", focusHandler)
			window.removeEventListener("blur", blurHandler)
		})
	}

	// 处理页面可见性变化
	private handlePageVisibilityChange(visibility: "visible" | "hidden") {
		if (!this.session) return

		const now = performance.now()

		if (visibility === "hidden") {
			// 页面变为不可见，暂停计时
			if (this.session.isActive) {
				this.session.duration += now - this.session.startTime
				this.session.isActive = false
			}

			// 清除定时器
			if (this.timer) {
				clearTimeout(this.timer)
				this.timer = null
			}
		} else {
			// 页面变为可见，恢复计时
			this.session.startTime = now
			this.session.lastActiveTime = now
			this.session.isActive = true
			this.startInactivityTimer()
		}
	}

	// 设置用户活动监听器
	private setupActivityListeners() {
		// 清理之前的监听器
		this.clearActivityListeners()

		// 创建节流的重置定时器函数
		this.throttledResetTimer = throttle(
			() => {
				this.onUserActivity()
			},
			1000,
			{ leading: false, trailing: true },
		)

		// 为每个活动事件添加监听器
		ACTIVITY_EVENTS.forEach((eventType) => {
			const listener = this.throttledResetTimer!
			window.addEventListener(eventType, listener, { passive: true })

			// 保存清理函数
			this.activityListeners.push(() => {
				window.removeEventListener(eventType, listener)
			})
		})
	}

	// 用户活动处理
	private onUserActivity() {
		if (!this.session || !this.isPageVisible) return

		const now = performance.now()

		// 如果当前处于非活动状态，需要累加之前的活动时间
		if (!this.session.isActive) {
			// 累加从会话开始到最后活动时间的持续时间
			const inactiveDuration = this.session.lastActiveTime - this.session.startTime
			this.session.duration += inactiveDuration
			// 重置会话开始时间为当前时间
			this.session.startTime = now
		}

		this.session.lastActiveTime = now
		this.session.isActive = true

		// 重启非活动定时器
		this.startInactivityTimer()
	}

	// 启动非活动定时器
	private startInactivityTimer() {
		// 清除之前的定时器
		if (this.timer) {
			clearTimeout(this.timer)
		}

		this.timer = setTimeout(() => {
			this.onUserInactive()
		}, INACTIVE_TIMEOUT)
	}

	// 用户非活动处理
	private onUserInactive() {
		if (!this.session) return

		const now = performance.now()

		// 累加活动时间到持续时间
		if (this.session.isActive) {
			this.session.duration += now - this.session.startTime
			this.session.isActive = false
		}

		// 清除定时器
		this.timer = null
	}

	// 销毁会话
	private destroySession(reason?: string) {
		if (!this.session) return

		const now = performance.now()

		// 如果会话仍处于活动状态，累加最后的活动时间
		if (this.session.isActive) {
			const finalActiveTime = now - this.session.startTime
			this.session.duration += finalActiveTime
		}

		// 记录最终的页面停留时间
		const totalDuration = Math.round(this.session.duration)

		// 通过logger记录
		if (this.logger) {
			this.logger.report({
				namespace: "PageDwellTime",
				data: {
					route: this.session.route.to,
					from: this.session.route.from,
					type: this.session.route.type,
					duration: totalDuration,
					start: this.session.startTime,
					end: Date.now(),
					reason,
				},
			})
		}

		// 清理资源
		this.clearActivityListeners()
		if (this.timer) {
			clearTimeout(this.timer)
			this.timer = null
		}

		this.session = null
	}

	// 清理页面生命周期监听器
	private clearLifecycleListeners() {
		if (this.lifecycleListeners.length > 0) {
			this.lifecycleListeners.forEach((cleanup) => cleanup())
			this.lifecycleListeners = []
		}
	}

	// 清理活动监听器
	private clearActivityListeners() {
		this.activityListeners.forEach((cleanup) => cleanup())
		this.activityListeners = []
		this.throttledResetTimer = null
	}

	/**
	 * 检查是否应该处理此日志
	 */
	shouldHandle(_context: LogContext) {
		return false
	}

	/**
	 * 处理日志上下文
	 */
	process(context: LogContext): LogContext {
		return context
	}

	/**
	 * 插件销毁
	 */
	destroy?(): void | Promise<void> {
		// 销毁当前会话
		if (this.session) {
			this.destroySession()
		}

		// 清理所有监听器
		this.clearActivityListeners()
		this.clearLifecycleListeners()

		// 清理定时器
		if (this.timer) {
			clearTimeout(this.timer)
			this.timer = null
		}

		// 重置状态
		this.logger = null
	}
}

/**
 * 去重插件工厂函数
 */
export function createPageDwellTimePlugin(): PageDwellTimePlugin {
	return new PageDwellTimePlugin()
}
