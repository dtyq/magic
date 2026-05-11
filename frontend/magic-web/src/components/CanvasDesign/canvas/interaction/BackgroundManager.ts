import type { Canvas } from "../Canvas"
import canvasBackgroundSvg from "../../assets/svg/canvas-background.svg"

/**
 * 背景管理器
 * 职责：
 * 1. 管理画布背景图案的显示
 * 2. 通过容器级 CSS 实现无限平铺效果
 * 3. 背景随画布平移同步偏移，但不再受有限 Konva 节点边界影响
 */
export class BackgroundManager {
	private canvas: Canvas

	// 背景可见性控制
	private visible = true

	// SVG 图案尺寸（与 SVG 文件中的 viewBox 一致）
	private readonly PATTERN_SIZE = 16

	// RAF ID，用于节流样式更新
	private rafId: number | null = null
	private unsubscribers: Array<() => void> = []
	private lastBackgroundPosition = ""
	private lastBackgroundSize = ""
	private lastVisibility: boolean | null = null

	constructor(options: { canvas: Canvas }) {
		const { canvas } = options
		this.canvas = canvas

		this.setupEventListeners()
		this.scheduleBackgroundUpdate()
	}

	/**
	 * 对齐到当前 tile 尺寸范围内，避免 position 累积过大。
	 */
	private normalizeOffset(offset: number): number {
		const normalized = offset % this.PATTERN_SIZE
		return normalized >= 0 ? normalized : normalized + this.PATTERN_SIZE
	}

	/**
	 * 清理容器上的背景样式，回退到外层容器底色。
	 */
	private clearBackgroundStyles(): void {
		const { style } = this.canvas.container
		style.backgroundImage = ""
		style.backgroundRepeat = ""
		style.backgroundPosition = ""
		style.backgroundSize = ""
		this.lastBackgroundPosition = ""
		this.lastBackgroundSize = ""
	}

	/**
	 * 将背景样式同步到容器。
	 * 使用容器背景而不是 Konva 节点，可以天然获得无边界的无限平铺效果。
	 */
	private applyBackgroundStyles(): void {
		if (!this.visible) {
			if (this.lastVisibility !== false) {
				this.clearBackgroundStyles()
				this.lastVisibility = false
			}
			return
		}

		const stagePosition = this.canvas.stage.position()
		const backgroundPosition = `${this.normalizeOffset(
			stagePosition.x,
		)}px ${this.normalizeOffset(stagePosition.y)}px`
		const backgroundSize = `${this.PATTERN_SIZE}px ${this.PATTERN_SIZE}px`
		const { style } = this.canvas.container

		style.backgroundImage = `url("${canvasBackgroundSvg}")`
		style.backgroundRepeat = "repeat"

		if (backgroundPosition !== this.lastBackgroundPosition) {
			style.backgroundPosition = backgroundPosition
			this.lastBackgroundPosition = backgroundPosition
		}

		if (backgroundSize !== this.lastBackgroundSize) {
			style.backgroundSize = backgroundSize
			this.lastBackgroundSize = backgroundSize
		}

		this.lastVisibility = true
	}

	/**
	 * 设置事件监听
	 */
	private setupEventListeners(): void {
		this.unsubscribers.push(
			this.canvas.eventEmitter.on("viewport:scale", this.scheduleBackgroundUpdate),
			this.canvas.eventEmitter.on("viewport:pan", this.scheduleBackgroundUpdate),
			this.canvas.eventEmitter.on("canvas:resize", this.scheduleBackgroundUpdate),
		)
	}

	/**
	 * 使用 requestAnimationFrame 节流背景样式更新。
	 */
	private scheduleBackgroundUpdate = (): void => {
		if (this.rafId !== null) {
			return
		}

		this.rafId = requestAnimationFrame(() => {
			this.applyBackgroundStyles()
			this.rafId = null
		})
	}

	/**
	 * 设置背景可见性
	 * @param visible - 是否可见
	 */
	public setVisible(visible: boolean): void {
		this.visible = visible
		this.scheduleBackgroundUpdate()
	}

	/**
	 * 获取背景可见性
	 */
	public isVisible(): boolean {
		return this.visible
	}

	/**
	 * 切换背景可见性
	 */
	public toggleVisible(): void {
		this.setVisible(!this.visible)
	}

	/**
	 * 销毁管理器
	 */
	public destroy(): void {
		if (this.rafId !== null) {
			cancelAnimationFrame(this.rafId)
			this.rafId = null
		}

		this.unsubscribers.forEach((unsubscribe) => unsubscribe())
		this.unsubscribers = []
		this.clearBackgroundStyles()
	}
}
