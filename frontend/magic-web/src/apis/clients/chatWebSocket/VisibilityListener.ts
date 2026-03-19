import { logger as Logger } from "@/utils/log"

/**
 * 页面可见性监听器
 * 负责监听页面可见性变化，并提供状态查询接口
 */
export class VisibilityListener {
	private isVisible = true
	private initialized = false
	private changeHandler: (() => void) | null = null
	private onVisibleChangeCallback: ((visible: boolean) => void) | null = null
	// ✅ 延迟创建 logger，避免循环依赖
	private logger = Logger.createLogger("visibility listener")

	/**
	 * 初始化页面可见性监听
	 */
	init() {
		if (this.initialized) return

		// SSR 环境检查
		if (typeof document === "undefined") return

		this.isVisible = !document.hidden
		this.initialized = true

		this.changeHandler = () => {
			const wasVisible = this.isVisible
			this.isVisible = !document.hidden

			if (wasVisible !== this.isVisible && this.onVisibleChangeCallback) {
				this.onVisibleChangeCallback(this.isVisible)
			}
		}

		document.addEventListener("visibilitychange", this.changeHandler)
		this.logger.log("页面可见性监听器已初始化")
	}

	/**
	 * 设置可见性变化回调
	 * @param callback 当可见性变化时调用的回调函数
	 */
	onVisibleChange(callback: (visible: boolean) => void) {
		this.onVisibleChangeCallback = callback
	}

	/**
	 * 获取当前页面是否可见
	 * @returns 页面是否可见
	 */
	getIsVisible(): boolean {
		return this.isVisible
	}

	/**
	 * 清理页面可见性监听器
	 */
	destroy() {
		if (this.changeHandler && typeof document !== "undefined") {
			document.removeEventListener("visibilitychange", this.changeHandler)
			this.changeHandler = null
		}
		this.initialized = false
	}
}
