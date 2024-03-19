// 路由变化信息接口
export interface RouteChangeInfo {
	from: string
	to: string
	type: "push" | "replace" | "pop" | "direct"
	state?: any
	isForward: boolean
	isBackward: boolean
	navigationStack: string[]
}

// 路由变化回调函数类型
type RouteChangeCallback = (info: RouteChangeInfo) => void

// 全局路由监听器
class GlobalRouteTracker {
	private static instance: GlobalRouteTracker
	private currentPath: string
	private isInitialized = false
	private navigationStack: string[] = []
	private callbacks: Set<RouteChangeCallback> = new Set()

	static getInstance(): GlobalRouteTracker {
		if (!GlobalRouteTracker.instance) {
			GlobalRouteTracker.instance = new GlobalRouteTracker()
		}
		return GlobalRouteTracker.instance
	}

	private constructor() {
		this.currentPath = location.pathname + location.search + location.hash
		this.setupHistoryWrappers()
		this.setupPopstateListener()
		this.setupInitialState()
	}

	private setupInitialState() {
		// 初始化时记录当前路由
		this.navigationStack.push(this.currentPath)
		this.isInitialized = true

		// 延迟一帧确保初始化完成
		requestAnimationFrame(() => {
			this.handleRouteChange("", this.currentPath, "direct")
		})
	}

	private setupHistoryWrappers() {
		// 包装 pushState
		const originalPushState = window.history.pushState
		window.history.pushState = (state: any, unused: string, url?: string | URL | null) => {
			const fromPath = this.currentPath
			const result = originalPushState.call(window.history, state, unused, url)
			const toPath = location.pathname + location.search + location.hash

			this.updateCurrentPath(fromPath, toPath, "push", state)
			return result
		}

		// 包装 replaceState
		const originalReplaceState = window.history.replaceState
		window.history.replaceState = (state: any, unused: string, url?: string | URL | null) => {
			const fromPath = this.currentPath
			const result = originalReplaceState.call(window.history, state, unused, url)
			const toPath = location.pathname + location.search + location.hash

			this.updateCurrentPath(fromPath, toPath, "replace", state)
			return result
		}
	}

	private setupPopstateListener() {
		// 监听浏览器前进后退
		window.addEventListener("popstate", (event) => {
			const fromPath = this.currentPath
			const toPath = location.pathname + location.search + location.hash

			this.updateCurrentPath(fromPath, toPath, "pop", event.state)
		})
	}

	private updateCurrentPath(
		fromPath: string,
		toPath: string,
		type: RouteChangeInfo["type"],
		state?: any,
	) {
		if (!this.isInitialized) return

		// 更新导航栈
		if (type === "push") {
			this.navigationStack.push(toPath)
		} else if (type === "replace") {
			this.navigationStack[this.navigationStack.length - 1] = toPath
		} else if (type === "pop") {
			// popstate 事件处理较复杂，需要判断是前进还是后退
			const currentIndex = this.navigationStack.findIndex((path) => path === toPath)
			if (currentIndex !== -1) {
				// 找到了目标路径，截断栈到该位置
				this.navigationStack = this.navigationStack.slice(0, currentIndex + 1)
			} else {
				// 没找到，可能是外部导航，添加到栈中
				this.navigationStack.push(toPath)
			}
		}

		this.currentPath = toPath

		// 只有路径真正发生变化时才触发回调
		if (fromPath !== toPath) {
			this.handleRouteChange(fromPath, toPath, type, state)
		}
	}

	private handleRouteChange(
		fromPath: string,
		toPath: string,
		type: RouteChangeInfo["type"],
		state?: any,
	) {
		const isForward = this.isForwardNavigation(fromPath, toPath, type)
		const isBackward = this.isBackwardNavigation(fromPath, toPath, type)

		const routeInfo: RouteChangeInfo = {
			from: fromPath,
			to: toPath,
			type,
			state,
			isForward,
			isBackward,
			navigationStack: [...this.navigationStack],
		}

		// 调用所有注册的回调函数
		this.callbacks.forEach((callback) => {
			try {
				callback(routeInfo)
			} catch (error) {
				console.error("Route change callback error:", error)
			}
		})
	}

	private isForwardNavigation(from: string, to: string, type: string): boolean {
		if (type === "push") return true
		if (type === "pop") {
			const fromIndex = this.navigationStack.lastIndexOf(from)
			const toIndex = this.navigationStack.lastIndexOf(to)
			return toIndex > fromIndex
		}
		return false
	}

	private isBackwardNavigation(from: string, to: string, type: string): boolean {
		if (type === "pop") {
			const fromIndex = this.navigationStack.lastIndexOf(from)
			const toIndex = this.navigationStack.lastIndexOf(to)
			return toIndex < fromIndex && toIndex !== -1
		}
		return false
	}

	// 公共API：注册路由变化回调
	onRouteChange(callback: RouteChangeCallback): () => void {
		this.callbacks.add(callback)

		// 返回取消订阅函数
		return () => {
			this.callbacks.delete(callback)
		}
	}

	// 公共API：获取当前导航栈
	getNavigationStack(): string[] {
		return [...this.navigationStack]
	}

	// 公共API：获取当前路径
	getCurrentPath(): string {
		return this.currentPath
	}
}

// 初始化全局路由追踪器
export const RouteTracker = GlobalRouteTracker.getInstance()
