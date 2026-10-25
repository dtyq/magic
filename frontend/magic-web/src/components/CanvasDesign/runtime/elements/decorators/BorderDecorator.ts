import Konva from "konva"
import { DECORATOR_CONFIG, DECORATOR_COLORS, DECORATOR_LAYOUT } from "./DecoratorConfig"
import { ImageStaticLoader } from "../../resources/image/ImageStaticLoader"
import type { Canvas } from "../../core/Canvas"
import imageBackgroundSelected from "../../../assets/image/image-background-selected.jpg"
import imageBackgroundUnselected from "../../../assets/image/image-background-unselected.jpg"

/**
 * 边框装饰器配置
 */
export interface BorderDecoratorConfig {
	/** 是否是生成中或加载中状态（使用渐变边框） */
	isAnimated: boolean
	/** 元素 ID（用于判断选中状态） */
	elementId: string
	/** Canvas 实例 */
	canvas: Canvas
}

/**
 * 边框装饰器
 * 负责管理元素的边框显示、动画和背景切换
 */
export class BorderDecorator {
	private group: Konva.Group
	private width: number
	private height: number
	private config: BorderDecoratorConfig
	private imageLoader = new ImageStaticLoader()

	private borderRect?: Konva.Rect
	private borderAnimation?: Konva.Animation
	private borderUpdateHandler?: () => void
	private backgroundNode?: Konva.Image
	private currentBackgroundType?: "selected" | "unselected"
	private backgroundSwitchRequestId = 0
	private renderVisibilityEnabled = true

	constructor(group: Konva.Group, width: number, height: number, config: BorderDecoratorConfig) {
		this.group = group
		this.width = width
		this.height = height
		this.config = config
	}

	/**
	 * 创建边框
	 */
	public create(backgroundNode?: Konva.Image): void {
		this.backgroundNode = backgroundNode

		// 如果已存在边框，先清理
		if (this.borderRect) {
			this.borderRect.destroy()
			this.borderRect = undefined
		}

		const stage = this.group.getStage()
		if (!stage) return
		// Konva draws a non-scaling stroke in canvas pixel space, so static borders keep a
		// constant screen width without recalculating their stroke on every viewport scale.
		const usesScreenSpaceStroke = !this.config.isAnimated
		const strokeWidth = usesScreenSpaceStroke
			? DECORATOR_CONFIG.BORDER_WIDTH
			: this.calculateStrokeWidth(stage)

		// 创建边框矩形
		const borderRect = new Konva.Rect({
			x: 0,
			y: 0,
			width: this.width,
			height: this.height,
			strokeWidth,
			...(usesScreenSpaceStroke ? { strokeScaleEnabled: false } : {}),
			listening: false,
			name: "decorator-border",
		})

		// 根据是否是动画状态设置不同的边框样式
		if (this.config.isAnimated) {
			// 生成中或加载中状态：使用线性渐变
			const angle = DECORATOR_LAYOUT.GRADIENT_ANGLE * (Math.PI / 180)
			const gradientLength = Math.sqrt(this.width * this.width + this.height * this.height)

			// 计算渐变的起点和终点
			const startX = this.width / 2 - (Math.cos(angle - Math.PI / 2) * gradientLength) / 2
			const startY = this.height / 2 - (Math.sin(angle - Math.PI / 2) * gradientLength) / 2
			const endX = this.width / 2 + (Math.cos(angle - Math.PI / 2) * gradientLength) / 2
			const endY = this.height / 2 + (Math.sin(angle - Math.PI / 2) * gradientLength) / 2

			borderRect.strokeLinearGradientStartPoint({ x: startX, y: startY })
			borderRect.strokeLinearGradientEndPoint({ x: endX, y: endY })
			borderRect.strokeLinearGradientColorStops([
				DECORATOR_LAYOUT.GRADIENT_START_STOP,
				DECORATOR_COLORS.GRADIENT_START,
				DECORATOR_LAYOUT.GRADIENT_END_STOP,
				DECORATOR_COLORS.GRADIENT_END,
			])
		} else {
			// 其他状态：使用纯色边框
			borderRect.stroke(DECORATOR_COLORS.BORDER_DEFAULT)
		}

		this.group.add(borderRect)
		borderRect.moveToTop()

		// 保存边框引用
		this.borderRect = borderRect

		// 如果是动画状态，启动旋转动画
		if (this.config.isAnimated && this.renderVisibilityEnabled) {
			this.startAnimation()
		}

		// 监听 viewport 缩放事件和选中事件
		this.setupUpdateListener()
	}

	/**
	 * 更新边框的显示状态和样式
	 */
	public update(): void {
		if (!this.borderRect) return

		if (!this.borderRect.getStage()) return

		// 检查元素是否被选中
		const isSelected = this.config.canvas.selectionManager.isSelected(this.config.elementId)

		// 如果被选中，隐藏边框并切换到选中状态背景；否则显示边框并切换到未选中状态背景
		if (isSelected) {
			this.borderRect.visible(false)
			// 停止动画（选中时不需要动画）
			this.stopAnimation()
			// 切换到选中状态背景
			if (this.backgroundNode && this.currentBackgroundType !== "selected") {
				this.switchToSelectedBackground()
			}
		} else {
			this.borderRect.visible(true)
			if (this.config.isAnimated) this.updateStrokeWidth()
			// 如果是动画状态且动画未运行，启动动画
			if (this.config.isAnimated && this.renderVisibilityEnabled && !this.borderAnimation) {
				this.startAnimation()
			}
			// 切换到未选中状态背景
			if (this.backgroundNode && this.currentBackgroundType !== "unselected") {
				this.switchToUnselectedBackground()
			}
		}

		this.borderRect.getLayer()?.batchDraw()
	}

	/**
	 * 更新边框尺寸
	 */
	public updateSize(width: number, height: number): void {
		this.width = width
		this.height = height

		if (this.borderRect) {
			if (this.config.isAnimated) {
				const stage = this.borderRect.getStage()
				if (stage) this.borderRect.strokeWidth(this.calculateStrokeWidth(stage))
			}

			this.borderRect.width(width)
			this.borderRect.height(height)

			// 如果是动画状态，需要重新计算渐变
			if (this.config.isAnimated) {
				const angle = DECORATOR_LAYOUT.GRADIENT_ANGLE * (Math.PI / 180)
				const gradientLength = Math.sqrt(width * width + height * height)

				const startX = width / 2 - (Math.cos(angle - Math.PI / 2) * gradientLength) / 2
				const startY = height / 2 - (Math.sin(angle - Math.PI / 2) * gradientLength) / 2
				const endX = width / 2 + (Math.cos(angle - Math.PI / 2) * gradientLength) / 2
				const endY = height / 2 + (Math.sin(angle - Math.PI / 2) * gradientLength) / 2

				this.borderRect.strokeLinearGradientStartPoint({ x: startX, y: startY })
				this.borderRect.strokeLinearGradientEndPoint({ x: endX, y: endY })
			}

			// 更新尺寸后，确保边框在最上层
			this.moveToTop()
		}
	}

	/**
	 * Far elements remain mounted in the Konva tree, so visibility culling must also stop their
	 * element-local animation. The owning element reapplies this state after each rerender.
	 */
	public setRenderVisibility(enabled: boolean): void {
		if (this.renderVisibilityEnabled === enabled) return
		this.renderVisibilityEnabled = enabled
		if (!enabled) {
			this.stopAnimation()
			return
		}

		if (
			this.config.isAnimated &&
			this.borderRect &&
			!this.config.canvas.selectionManager.isSelected(this.config.elementId)
		) {
			this.startAnimation()
		}
	}

	/**
	 * 将边框移动到最上层
	 * 确保边框始终显示在所有子元素之上
	 */
	public moveToTop(): void {
		if (this.borderRect) {
			this.borderRect.moveToTop()
			this.borderRect.getLayer()?.batchDraw()
		}
	}

	/**
	 * 计算动画边框宽度
	 * 根据 stage 缩放和元素缩放计算边框宽度
	 */
	private calculateStrokeWidth(stage: Konva.Stage): number {
		const elementScaleX = this.group.scaleX()
		const elementScaleY = this.group.scaleY()
		const avgScale = (elementScaleX + elementScaleY) / 2
		return DECORATOR_CONFIG.BORDER_WIDTH / (stage.scaleX() * avgScale)
	}

	/** 动画边框仍使用渐变描边，需在 viewport 缩放时更新其局部线宽。 */
	private updateStrokeWidth(): void {
		if (!this.borderRect?.visible()) return
		const stage = this.borderRect.getStage()
		if (!stage) return

		const strokeWidth = this.calculateStrokeWidth(stage)
		if (this.borderRect.strokeWidth() !== strokeWidth) {
			this.borderRect.strokeWidth(strokeWidth)
		}
	}

	/**
	 * 更新动画边框的视口缩放布局。
	 * 媒体元素会把它和自身内容布局合并到同一个 scheduler callback，避免一个元素注册多个
	 * 等待同一 viewport:scale 事件的 callback。
	 */
	public updateViewportScaleLayout(): void {
		if (!this.config.isAnimated) return
		this.updateStrokeWidth()
	}

	/**
	 * 设置背景节点
	 */
	public setBackgroundNode(backgroundNode: Konva.Image): void {
		this.backgroundNode = backgroundNode
	}

	/**
	 * 开始背景切换并返回请求 ID 和背景节点
	 * @returns 请求 ID 和背景节点
	 */
	private beginBackgroundSwitch(): { requestId: number; backgroundNode?: Konva.Image } {
		const backgroundNode = this.backgroundNode
		const requestId = ++this.backgroundSwitchRequestId
		return { requestId, backgroundNode }
	}

	/**
	 * 检查当前背景切换是否有效
	 * @param requestId 请求 ID
	 * @param backgroundNode 背景节点
	 * @returns 是否有效
	 */
	private isCurrentBackgroundSwitch(requestId: number, backgroundNode?: Konva.Image): boolean {
		return (
			requestId === this.backgroundSwitchRequestId &&
			Boolean(backgroundNode) &&
			this.backgroundNode === backgroundNode
		)
	}

	/**
	 * 切换到选中状态背景
	 */
	private async switchToSelectedBackground(): Promise<void> {
		const { requestId, backgroundNode } = this.beginBackgroundSwitch()
		if (!backgroundNode) return

		const selectedImage = await this.imageLoader.loadImage(imageBackgroundSelected)
		if (!this.isCurrentBackgroundSwitch(requestId, backgroundNode)) return

		backgroundNode.image(selectedImage)
		this.currentBackgroundType = "selected"
		backgroundNode.getLayer()?.batchDraw()
	}

	/**
	 * 切换到未选中状态背景
	 */
	private async switchToUnselectedBackground(): Promise<void> {
		const { requestId, backgroundNode } = this.beginBackgroundSwitch()
		if (!backgroundNode) return

		const unselectedImage = await this.imageLoader.loadImage(imageBackgroundUnselected)
		if (!this.isCurrentBackgroundSwitch(requestId, backgroundNode)) return

		backgroundNode.image(unselectedImage)
		this.currentBackgroundType = "unselected"
		backgroundNode.getLayer()?.batchDraw()
	}

	/** 设置边框选中状态和元素变换监听。 */
	private setupUpdateListener(): void {
		if (this.borderUpdateHandler) return

		this.borderUpdateHandler = () => {
			this.update()
		}
		// 监听选中/取消选中事件
		this.config.canvas.eventEmitter.on("element:select", this.borderUpdateHandler)
		this.config.canvas.eventEmitter.on("element:deselect", this.borderUpdateHandler)

		// 监听 Group 的 transform 事件（transformer 缩放时触发）
		this.group.on("transform", this.borderUpdateHandler)

		// 初始化边框状态
		this.update()
	}

	/**
	 * 启动边框旋转动画（仅用于动画状态的渐变边框）
	 */
	private startAnimation(): void {
		// 先停止之前的动画
		this.stopAnimation()

		const layer = this.group.getLayer()
		if (!layer || !this.borderRect || !this.renderVisibilityEnabled) return

		// 创建渐变旋转动画（让渐变色围绕边框流动）
		this.borderAnimation = new Konva.Animation((frame) => {
			if (!this.borderRect || !this.config.isAnimated) {
				// 如果边框被销毁或不再是动画状态，停止动画
				this.stopAnimation()
				return
			}

			// 旋转速度：每秒旋转约18度，完整旋转一圈需要约20秒
			const rotation = (frame.time * DECORATOR_LAYOUT.ANIMATION_ROTATION_SPEED) % 360
			const angle = (DECORATOR_LAYOUT.GRADIENT_ANGLE + rotation) * (Math.PI / 180)
			const gradientLength = Math.sqrt(this.width * this.width + this.height * this.height)

			// 计算旋转后的渐变起点和终点
			const startX = this.width / 2 - (Math.cos(angle - Math.PI / 2) * gradientLength) / 2
			const startY = this.height / 2 - (Math.sin(angle - Math.PI / 2) * gradientLength) / 2
			const endX = this.width / 2 + (Math.cos(angle - Math.PI / 2) * gradientLength) / 2
			const endY = this.height / 2 + (Math.sin(angle - Math.PI / 2) * gradientLength) / 2

			// 更新渐变位置
			if (this.borderRect) {
				this.borderRect.strokeLinearGradientStartPoint({ x: startX, y: startY })
				this.borderRect.strokeLinearGradientEndPoint({ x: endX, y: endY })
			}
		}, layer)

		this.borderAnimation.start()
	}

	/**
	 * 停止边框旋转动画
	 */
	private stopAnimation(): void {
		if (this.borderAnimation) {
			this.borderAnimation.stop()
			this.borderAnimation = undefined
		}
	}

	/**
	 * 销毁装饰器
	 */
	public destroy(): void {
		// 移除事件监听
		if (this.borderUpdateHandler) {
			this.config.canvas.eventEmitter.off("element:select", this.borderUpdateHandler)
			this.config.canvas.eventEmitter.off("element:deselect", this.borderUpdateHandler)
			this.group.off("transform", this.borderUpdateHandler)
			this.borderUpdateHandler = undefined
		}

		// 停止动画
		this.stopAnimation()

		// 销毁边框
		if (this.borderRect) {
			this.borderRect.destroy()
			this.borderRect = undefined
		}

		// 清理引用
		this.backgroundSwitchRequestId += 1
		this.backgroundNode = undefined
		this.currentBackgroundType = undefined
	}
}
