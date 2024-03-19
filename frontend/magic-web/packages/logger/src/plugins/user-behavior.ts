import { BasePlugin } from "./base-plugin"

export interface IUserBehaviorOptions {
	/** 是否追踪点击事件 */
	trackClick?: boolean
	/** 是否追踪页面浏览 */
	trackPageView?: boolean
	/** 是否追踪页面停留时间 */
	trackPageDwell?: boolean
}

/**
 * 用户行为追踪插件
 * 自动收集用户点击、页面浏览等行为数据
 */
export class UserBehaviorPlugin extends BasePlugin {
	name = "user-behavior"
	version = "1.0.0"

	private options: IUserBehaviorOptions
	private clickHandler: ((e: MouseEvent) => void) | null = null
	private pageEnterTime = 0

	constructor(options: IUserBehaviorOptions = {}) {
		super()
		this.options = {
			trackClick: true,
			trackPageView: true,
			trackPageDwell: true,
			...options,
		}
	}

	protected onInstall(): void {
		if (typeof window === "undefined") return

		if (this.options.trackClick) {
			this.setupClickTracking()
		}

		if (this.options.trackPageView) {
			this.trackPageView()
		}

		if (this.options.trackPageDwell) {
			this.setupPageDwellTracking()
		}
	}

	protected onUninstall(): void {
		if (this.clickHandler && typeof document !== "undefined") {
			document.removeEventListener("click", this.clickHandler)
		}
	}

	private setupClickTracking(): void {
		this.clickHandler = (e: MouseEvent) => {
			const target = e.target as HTMLElement

			this.logger?.track({
				name: "click",
				properties: {
					tagName: target.tagName,
					className: target.className,
					id: target.id,
					text: target.textContent?.slice(0, 50),
				},
			})
		}

		document.addEventListener("click", this.clickHandler)
	}

	private trackPageView(): void {
		this.logger?.track({
			name: "page_view",
			properties: {
				url: window.location.href,
				referrer: document.referrer,
				title: document.title,
			},
		})
	}

	private setupPageDwellTracking(): void {
		this.pageEnterTime = Date.now()

		window.addEventListener("beforeunload", () => {
			const dwellTime = Date.now() - this.pageEnterTime

			this.logger?.track({
				name: "page_dwell",
				properties: {
					url: window.location.href,
					duration: dwellTime,
				},
			})
		})
	}
}
