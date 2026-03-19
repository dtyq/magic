import type {
	ViewTransitionConfig,
	ViewTransitionType,
	ViewTransitionDirection,
} from "@/types/viewTransition"

/**
 * 检查浏览器是否支持 View Transition API
 */
export function isViewTransitionSupported(): boolean {
	return typeof document !== "undefined" && "startViewTransition" in document
}

/**
 * 检查用户是否偏好减少动画
 */
export function prefersReducedMotion(): boolean {
	if (typeof window === "undefined") return false
	return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

/**
 * 生成唯一的 View Transition 名称
 */
export function generateTransitionName(prefix: string = "vt"): string {
	return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * 获取过渡方向对应的 CSS 变换
 */
export function getTransformByDirection(direction: ViewTransitionDirection): string {
	const transforms = {
		left: "translateX(-100%)",
		right: "translateX(100%)",
		up: "translateY(-100%)",
		down: "translateY(100%)",
	}
	return transforms[direction] || transforms.right
}

/**
 * 获取过渡类型对应的 CSS 类名
 */
export function getTransitionClassName(
	type: ViewTransitionType,
	direction?: ViewTransitionDirection,
): string {
	switch (type) {
		case "fade":
			return "view-transition-fade"
		case "slide":
			return `view-transition-slide-${direction || "right"}`
		case "scale":
			return "view-transition-scale"
		case "flip":
			return "view-transition-flip"
		case "custom":
			return "view-transition-custom"
		default:
			return "view-transition-fade"
	}
}

/**
 * 应用 View Transition 样式到元素
 */
export function applyTransitionStyles(element: HTMLElement, config: ViewTransitionConfig): void {
	if (!element || !config) return

	const className = getTransitionClassName(config.type || "fade", config.direction)
	element.classList.add(className)

	// 设置 view-transition-name
	if (config.name) {
		element.style.viewTransitionName = config.name
	}

	// 设置动画持续时间
	if (config.duration) {
		element.style.setProperty("--view-transition-duration", `${config.duration}ms`)
	}

	// 设置缓动函数
	if (config.easing) {
		element.style.setProperty("--view-transition-easing", config.easing)
	}
}

/**
 * 清理 View Transition 样式
 */
export function cleanupTransitionStyles(element: HTMLElement): void {
	if (!element) return

	// 移除所有过渡相关的类名
	const transitionClasses = [
		"view-transition-fade",
		"view-transition-slide-left",
		"view-transition-slide-right",
		"view-transition-slide-up",
		"view-transition-slide-down",
		"view-transition-scale",
		"view-transition-flip",
		"view-transition-custom",
	]

	transitionClasses.forEach((className) => {
		element.classList.remove(className)
	})

	// 清理 CSS 自定义属性
	element.style.removeProperty("view-transition-name")
	element.style.removeProperty("--view-transition-duration")
	element.style.removeProperty("--view-transition-easing")
}

/**
 * 等待下一帧
 */
export function nextFrame(): Promise<void> {
	return new Promise((resolve) => {
		requestAnimationFrame(() => {
			requestAnimationFrame(() => resolve())
		})
	})
}

/**
 * 等待指定时间
 */
export function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * 执行 View Transition
 */
export async function executeViewTransition(
	callback: () => void | Promise<void>,
	config: ViewTransitionConfig = {},
): Promise<void> {
	// 检查是否应该跳过动画
	if (prefersReducedMotion() && !config.enabled) {
		callback()
		return
	}

	// 检查浏览器支持
	if (!isViewTransitionSupported()) {
		// 使用移动端降级策略
		const { executeFallbackTransition } = await import("./mobileViewTransitionFallback")
		return executeFallbackTransition(callback, config)
	}

	try {
		// 调用开始回调
		config.onStart?.()

		// 为页面导航设置特殊的 CSS 样式
		if (config.type && config.type !== "fade") {
			const className = getTransitionClassName(config.type, config.direction)
			document.documentElement.classList.add(className)

			// 设置根元素的 view-transition-name
			const transitionName =
				config.type === "slide"
					? `slide-${config.direction || "right"}-transition`
					: `${config.type}-transition`
			document.documentElement.style.viewTransitionName = transitionName
		}

		// 启动 View Transition
		const transition = document.startViewTransition?.(async () => {
			await callback()
		})

		if (!transition) {
			callback()
			return
		}

		// 等待过渡准备完成
		await transition.ready

		// 等待过渡动画完成
		await transition.finished

		// 清理样式
		if (config.type && config.type !== "fade") {
			const className = getTransitionClassName(config.type, config.direction)
			document.documentElement.classList.remove(className)
			document.documentElement.style.removeProperty("view-transition-name")
		}

		// 调用完成回调
		config.onComplete?.()
	} catch (error) {
		console.warn("View Transition failed:", error)

		// 清理样式（错误情况下）
		if (config.type && config.type !== "fade") {
			const className = getTransitionClassName(config.type, config.direction)
			document.documentElement.classList.remove(className)
			document.documentElement.style.removeProperty("view-transition-name")
		}

		// 出错时的降级处理
		if (config.fallback) {
			config.fallback()
		} else {
			callback()
		}
	}
}

/**
 * 预设动画配置的辅助函数
 */
export const ViewTransitionHelpers = {
	/**
	 * 创建淡入淡出过渡
	 */
	fade: (duration = 300): ViewTransitionConfig => ({
		type: "fade",
		duration,
		easing: "ease-in-out",
	}),

	/**
	 * 创建滑动过渡
	 */
	slide: (
		direction: ViewTransitionDirection = "right",
		duration = 300,
	): ViewTransitionConfig => ({
		type: "slide",
		direction,
		duration,
		easing: "cubic-bezier(0.4, 0, 0.2, 1)",
	}),

	/**
	 * 创建缩放过渡
	 */
	scale: (duration = 250): ViewTransitionConfig => ({
		type: "scale",
		duration,
		easing: "cubic-bezier(0.34, 1.56, 0.64, 1)",
	}),

	/**
	 * 创建翻转过渡
	 */
	flip: (duration = 400): ViewTransitionConfig => ({
		type: "flip",
		duration,
		easing: "cubic-bezier(0.25, 0.46, 0.45, 0.94)",
	}),
}

/**
 * 调试工具：记录 View Transition 状态
 */
export function debugViewTransition(transition: ViewTransition, name?: string): void {
	if (process.env.NODE_ENV !== "development") return

	const prefix = name ? `[ViewTransition:${name}]` : "[ViewTransition]"

	console.group(`${prefix} Starting...`)

	transition.ready
		.then(() => {
			console.log(`${prefix} Ready`)
		})
		.catch((error) => {
			console.error(`${prefix} Ready failed:`, error)
		})

	transition.updateCallbackDone
		.then(() => {
			console.log(`${prefix} Update callback done`)
		})
		.catch((error) => {
			console.error(`${prefix} Update callback failed:`, error)
		})

	transition.finished
		.then(() => {
			console.log(`${prefix} Finished`)
			console.groupEnd()
		})
		.catch((error) => {
			console.error(`${prefix} Finished with error:`, error)
			console.groupEnd()
		})
}
