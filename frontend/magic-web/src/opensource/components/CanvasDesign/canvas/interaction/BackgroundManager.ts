import Konva from "konva"
import type { Canvas } from "../Canvas"
import canvasBackgroundSvg from "../../assets/svg/canvas-background.svg"

/**
 * 背景管理器
 * 职责：
 * 1. 管理画布背景图案的显示
 * 2. 实现背景的循环平铺效果
 * 3. 背景随画布缩放和平移
 * 4. 背景放在 contentLayer 的最底层，在所有用户内容下方
 */
export class BackgroundManager {
	private canvas: Canvas
	private backgroundRect: Konva.Rect | null = null
	private backgroundPattern: CanvasPattern | null = null
	private patternImage: HTMLImageElement | null = null

	// 背景可见性控制
	private visible = true

	// SVG 图案尺寸（与 SVG 文件中的 viewBox 一致）
	private readonly PATTERN_SIZE = 16

	// 缓存当前缩放比例，避免不必要的更新
	private lastScale = 1

	// RAF ID，用于节流重绘
	private rafId: number | null = null

	constructor(options: { canvas: Canvas }) {
		const { canvas } = options
		this.canvas = canvas

		this.setupEventListeners()
		// 异步初始化背景
		this.initialize()
	}

	/**
	 * 初始化背景
	 */
	private async initialize(): Promise<void> {
		try {
			// 加载 SVG 图案
			await this.loadPattern()

			// 创建背景矩形
			this.createBackground()
		} catch (error) {
			console.error("Failed to initialize canvas background:", error)
		}
	}

	/**
	 * 加载 SVG 图案并创建 CanvasPattern
	 */
	private async loadPattern(): Promise<void> {
		return new Promise((resolve, reject) => {
			const img = new Image()

			img.onload = () => {
				this.patternImage = img

				// 创建一个临时 canvas 来生成 pattern
				const canvas = document.createElement("canvas")
				const ctx = canvas.getContext("2d")

				if (!ctx) {
					reject(new Error("Failed to get canvas context"))
					return
				}

				// 设置 canvas 尺寸为图案尺寸
				canvas.width = this.PATTERN_SIZE
				canvas.height = this.PATTERN_SIZE

				// 绘制图像
				ctx.drawImage(img, 0, 0, this.PATTERN_SIZE, this.PATTERN_SIZE)

				// 创建重复的图案
				this.backgroundPattern = ctx.createPattern(canvas, "repeat")

				if (!this.backgroundPattern) {
					reject(new Error("Failed to create pattern"))
					return
				}

				// 清理临时 canvas
				canvas.width = 0
				canvas.height = 0

				resolve()
			}

			img.onerror = () => {
				reject(new Error("Failed to load background pattern"))
			}

			// 将 SVG 转换为 data URL
			img.src = canvasBackgroundSvg
		})
	}

	/**
	 * 计算背景所需尺寸
	 * 根据视口大小和最小缩放比例动态计算
	 */
	private calculateBackgroundSize(): number {
		const stage = this.canvas.stage
		const minScale = 0.01 // 最小缩放比例
		const viewportSize = Math.max(stage.width(), stage.height())
		// 考虑最小缩放和额外余量（2倍），确保覆盖所有情况
		return Math.ceil((viewportSize / minScale) * 2)
	}

	/**
	 * 创建背景矩形
	 */
	private createBackground(): void {
		if (!this.backgroundPattern || !this.patternImage) return

		// 动态计算背景尺寸，而不是使用固定的超大尺寸
		const size = this.calculateBackgroundSize()

		// 获取当前 stage 的缩放比例，用于设置初始图案缩放
		const currentScale = this.canvas.stage.scaleX()
		this.lastScale = currentScale

		this.backgroundRect = new Konva.Rect({
			x: -size / 2,
			y: -size / 2,
			width: size,
			height: size,
			fillPatternImage: this.patternImage,
			fillPatternRepeat: "repeat",
			fillPatternScale: { x: 1 / currentScale, y: 1 / currentScale },
			listening: false,
			name: "canvas-background",
			// 关键：排除在 getClientRect 计算之外
			// 这样 focusOnElements 和 fitToScreen 就不会包含背景
			// 参考：https://konvajs.org/docs/groups_and_layers/Layer_Management.html
		})

		// 将背景添加到 contentLayer 的最底层
		this.canvas.contentLayer.add(this.backgroundRect)
		this.backgroundRect.moveToBottom()

		// 设置初始可见性
		this.backgroundRect.visible(this.visible)

		this.canvas.contentLayer.batchDraw()
	}

	/**
	 * 设置事件监听
	 */
	private setupEventListeners(): void {
		// 监听视口缩放变化，更新背景
		// 只有缩放变化时才需要更新背景图案的缩放比例
		this.canvas.eventEmitter.on("viewport:scale", () => {
			this.updateBackground()
		})

		// 注意：不需要监听 viewport:pan 事件
		// 因为背景矩形在 contentLayer 中，会自动随 stage 平移
		// 只有缩放时才需要更新图案的缩放比例

		// 监听画布大小变化
		this.canvas.eventEmitter.on("canvas:resize", () => {
			this.updateBackground()
		})
	}

	/**
	 * 更新背景（位置和缩放）
	 * 背景随画布缩放和平移
	 */
	private updateBackground(): void {
		if (!this.backgroundRect) return

		// 背景作为画布的一部分，不需要特殊处理
		// 它会自动随 contentLayer 一起缩放和平移
		// 只需要确保图案的缩放比例正确
		const scale = this.canvas.stage.scaleX()

		// 检查背景尺寸是否足够（在窗口大幅调整时可能需要扩大）
		const requiredSize = this.calculateBackgroundSize()
		const currentSize = this.backgroundRect.width()
		let needsRedraw = false

		// 如果需要更大的背景尺寸，更新尺寸和位置
		if (requiredSize > currentSize) {
			this.backgroundRect.size({ width: requiredSize, height: requiredSize })
			this.backgroundRect.position({ x: -requiredSize / 2, y: -requiredSize / 2 })
			needsRedraw = true
		}

		// 如果缩放比例变化，更新图案缩放
		if (scale !== this.lastScale) {
			this.lastScale = scale
			this.backgroundRect.fillPatternScale({ x: 1 / scale, y: 1 / scale })
			needsRedraw = true
		}

		// 只有在需要时才重绘
		if (!needsRedraw) {
			return
		}

		// 使用 requestAnimationFrame 节流重绘，避免频繁重绘
		// 这在缩放动画期间特别重要
		if (this.rafId !== null) {
			cancelAnimationFrame(this.rafId)
		}

		this.rafId = requestAnimationFrame(() => {
			this.canvas.contentLayer.batchDraw()
			this.rafId = null
		})
	}

	/**
	 * 设置背景可见性
	 * @param visible - 是否可见
	 */
	public setVisible(visible: boolean): void {
		this.visible = visible

		if (this.backgroundRect) {
			this.backgroundRect.visible(visible)
			this.canvas.contentLayer.batchDraw()
		}
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
		// 取消待处理的 RAF
		if (this.rafId !== null) {
			cancelAnimationFrame(this.rafId)
			this.rafId = null
		}

		if (this.backgroundRect) {
			this.backgroundRect.destroy()
			this.backgroundRect = null
		}

		this.backgroundPattern = null
		this.patternImage = null

		this.canvas.eventEmitter.off("viewport:scale")
		this.canvas.eventEmitter.off("canvas:resize")
	}
}
