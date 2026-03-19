/**
 * 移动端 View Transition 降级策略
 * 当 View Transition API 不支持时提供备用动画方案
 */

import type { ViewTransitionConfig } from "@/types/viewTransition"

/**
 * CSS 过渡动画类名
 */
const FALLBACK_CLASSES = {
	fade: "vt-fallback-fade",
	slide: "vt-fallback-slide",
	scale: "vt-fallback-scale",
	flip: "vt-fallback-flip",
	custom: "vt-fallback-custom",
} as const

/**
 * 添加降级样式到页面
 */
function injectFallbackStyles(): void {
	if (typeof document === "undefined") return

	const styleId = "view-transition-fallback-styles"
	if (document.getElementById(styleId)) return

	const style = document.createElement("style")
	style.id = styleId
	style.textContent = `
		/* View Transition 降级动画样式 */
		.vt-fallback-container {
			position: relative;
			overflow: hidden;
		}
		
		.vt-fallback-old,
		.vt-fallback-new {
			position: absolute;
			top: 0;
			left: 0;
			width: 100%;
			height: 100%;
		}
		
		/* 淡入淡出降级 */
		.vt-fallback-fade .vt-fallback-old {
			animation: vt-fallback-fade-out 300ms ease-in-out forwards;
		}
		
		.vt-fallback-fade .vt-fallback-new {
			animation: vt-fallback-fade-in 300ms ease-in-out forwards;
		}
		
		@keyframes vt-fallback-fade-out {
			from { opacity: 1; }
			to { opacity: 0; }
		}
		
		@keyframes vt-fallback-fade-in {
			from { opacity: 0; }
			to { opacity: 1; }
		}
		
		/* 滑动降级 */
		.vt-fallback-slide.slide-left .vt-fallback-old {
			animation: vt-fallback-slide-out-left 300ms cubic-bezier(0.4, 0, 0.2, 1) forwards;
		}
		
		.vt-fallback-slide.slide-left .vt-fallback-new {
			animation: vt-fallback-slide-in-left 300ms cubic-bezier(0.4, 0, 0.2, 1) forwards;
		}
		
		.vt-fallback-slide.slide-right .vt-fallback-old {
			animation: vt-fallback-slide-out-right 300ms cubic-bezier(0.4, 0, 0.2, 1) forwards;
		}
		
		.vt-fallback-slide.slide-right .vt-fallback-new {
			animation: vt-fallback-slide-in-right 300ms cubic-bezier(0.4, 0, 0.2, 1) forwards;
		}
		
		@keyframes vt-fallback-slide-out-left {
			from { transform: translateX(0); }
			to { transform: translateX(-100%); }
		}
		
		@keyframes vt-fallback-slide-in-left {
			from { transform: translateX(100%); }
			to { transform: translateX(0); }
		}
		
		@keyframes vt-fallback-slide-out-right {
			from { transform: translateX(0); }
			to { transform: translateX(100%); }
		}
		
		@keyframes vt-fallback-slide-in-right {
			from { transform: translateX(-100%); }
			to { transform: translateX(0); }
		}
		
		/* 缩放降级 */
		.vt-fallback-scale .vt-fallback-old {
			animation: vt-fallback-scale-out 250ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
		}
		
		.vt-fallback-scale .vt-fallback-new {
			animation: vt-fallback-scale-in 250ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
		}
		
		@keyframes vt-fallback-scale-out {
			from { transform: scale(1); opacity: 1; }
			to { transform: scale(0.8); opacity: 0; }
		}
		
		@keyframes vt-fallback-scale-in {
			from { transform: scale(1.2); opacity: 0; }
			to { transform: scale(1); opacity: 1; }
		}
		
		/* 移动端优化 */
		@media (max-width: 768px) {
			.vt-fallback-fade .vt-fallback-old,
			.vt-fallback-fade .vt-fallback-new {
				animation-duration: 250ms;
			}
			
			.vt-fallback-slide .vt-fallback-old,
			.vt-fallback-slide .vt-fallback-new {
				animation-duration: 250ms;
			}
			
			.vt-fallback-scale .vt-fallback-old,
			.vt-fallback-scale .vt-fallback-new {
				animation-duration: 200ms;
			}
		}
		
		/* 减少动画偏好支持 */
		@media (prefers-reduced-motion: reduce) {
			.vt-fallback-old,
			.vt-fallback-new {
				animation-duration: 0ms !important;
			}
		}
	`

	document.head.appendChild(style)
}

/**
 * 创建降级动画容器
 */
function createFallbackContainer(config: ViewTransitionConfig): HTMLElement {
	const container = document.createElement("div")
	container.className = "vt-fallback-container"

	// 添加类型特定的类名
	if (config.type) {
		container.classList.add(FALLBACK_CLASSES[config.type])

		// 滑动动画需要方向信息
		if (config.type === "slide" && config.direction) {
			container.classList.add(`slide-${config.direction}`)
		}
	}

	return container
}

/**
 * 执行降级动画
 */
export async function executeFallbackTransition(
	callback: () => void | Promise<void>,
	config: ViewTransitionConfig = {},
): Promise<void> {
	// 注入降级样式
	injectFallbackStyles()

	// 检查是否应该跳过动画
	if (window.matchMedia("(prefers-reduced-motion: reduce)").matches && !config.enabled) {
		await callback()
		return
	}

	try {
		// 调用开始回调
		config.onStart?.()

		// 对于页面级过渡，我们采用简单的淡入淡出效果
		if (config.type === "slide" || config.type === "fade") {
			// 创建过渡遮罩
			const overlay = document.createElement("div")
			overlay.style.cssText = `
				position: fixed;
				top: 0;
				left: 0;
				width: 100%;
				height: 100%;
				background: var(--background, #fff);
				z-index: 9999;
				pointer-events: none;
				opacity: 0;
				transition: opacity ${config.duration || 300}ms ease-in-out;
			`

			document.body.appendChild(overlay)

			// 触发淡入
			requestAnimationFrame(() => {
				overlay.style.opacity = "1"
			})

			// 在动画中点执行回调
			setTimeout(
				async () => {
					await callback()

					// 触发淡出
					overlay.style.opacity = "0"

					// 清理
					setTimeout(() => {
						if (overlay.parentNode) {
							overlay.parentNode.removeChild(overlay)
						}
						config.onComplete?.()
					}, config.duration || 300)
				},
				(config.duration || 300) / 2,
			)
		} else {
			// 其他类型直接执行回调
			await callback()
			config.onComplete?.()
		}
	} catch (error) {
		console.warn("Fallback transition failed:", error)
		await callback()
		config.onComplete?.()
	}
}

/**
 * 智能选择最佳降级策略
 */
export function selectBestFallbackStrategy(config: ViewTransitionConfig): ViewTransitionConfig {
	const isMobile =
		/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
			navigator.userAgent,
		) || window.innerWidth <= 768

	const isLowPerformance = navigator.hardwareConcurrency <= 2 || window.devicePixelRatio > 2

	// 移动端或低性能设备优化
	if (isMobile || isLowPerformance) {
		return {
			...config,
			duration: Math.min(config.duration || 300, 250),
			type: config.type === "flip" ? "fade" : config.type, // flip 动画在移动端改为 fade
		}
	}

	return config
}

/**
 * 检测设备性能并返回建议的配置
 */
export function getPerformanceOptimizedConfig(config: ViewTransitionConfig): ViewTransitionConfig {
	const optimized = selectBestFallbackStrategy(config)

	// 电池状态检测（如果支持）
	if ("getBattery" in navigator) {
		; (navigator as any).getBattery?.().then((battery: any) => {
			if (battery.level < 0.2) {
				// 低电量时进一步优化
				optimized.duration = Math.min(optimized.duration || 300, 150)
				optimized.type = "fade" // 强制使用最简单的动画
			}
		})
	}

	return optimized
}

/**
 * 移动端手势支持的降级动画
 */
export class MobileFallbackTransition {
	private container: HTMLElement | null = null
	private config: ViewTransitionConfig

	constructor(config: ViewTransitionConfig = {}) {
		this.config = getPerformanceOptimizedConfig(config)
		injectFallbackStyles()
	}

	async execute(callback: () => void | Promise<void>): Promise<void> {
		return executeFallbackTransition(callback, this.config)
	}

	// 为触摸手势优化的预加载
	preload(): void {
		// 预热动画引擎
		const testDiv = document.createElement("div")
		testDiv.style.cssText = `
			position: fixed;
			top: -100px;
			left: -100px;
			width: 1px;
			height: 1px;
			opacity: 0;
			transition: opacity 1ms;
		`
		document.body.appendChild(testDiv)

		requestAnimationFrame(() => {
			testDiv.style.opacity = "1"
			setTimeout(() => {
				document.body.removeChild(testDiv)
			}, 10)
		})
	}
}

/**
 * 导出便捷函数
 */
export const mobileFallback = {
	fade: (duration = 250) => new MobileFallbackTransition({ type: "fade", duration }),
	slide: (direction: "left" | "right" | "up" | "down" = "left", duration = 250) =>
		new MobileFallbackTransition({ type: "slide", direction, duration }),
	scale: (duration = 200) => new MobileFallbackTransition({ type: "scale", duration }),
}
