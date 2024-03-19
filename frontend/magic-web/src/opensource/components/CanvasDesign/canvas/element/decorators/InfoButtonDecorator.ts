import Konva from "konva"
import { IMAGE_CONFIG, COLORS, LAYOUT } from "../elements/ImageElement.config"
import infoIcon from "../../../assets/svg/Info.svg"
import type { Canvas } from "../../Canvas"

/**
 * Info 按钮装饰器配置
 */
export interface InfoButtonDecoratorConfig {
	/** 元素 ID */
	elementId: string
	/** Canvas 实例 */
	canvas: Canvas
	/** 元素宽度 */
	width: number
	/** 元素高度 */
	height: number
	/** 点击回调 */
	onClick?: () => void
}

/**
 * Info 按钮装饰器
 * 负责管理 Info 按钮的创建、显示、隐藏和交互
 */
export class InfoButtonDecorator {
	private group: Konva.Group
	private config: InfoButtonDecoratorConfig
	private buttonGroup?: Konva.Group
	private viewportScaleHandler?: () => void
	private elementTransformHandler?: () => void
	private deselectHandler?: () => void

	constructor(group: Konva.Group, config: InfoButtonDecoratorConfig) {
		this.group = group
		this.config = config
	}

	/**
	 * 创建 Info 按钮
	 */
	public create(): void {
		// 如果已存在按钮组，先清理旧的事件监听器
		if (this.buttonGroup) {
			this.removeViewportScaleListener()
		}

		const buttonSize = IMAGE_CONFIG.INFO_BUTTON_SIZE
		const iconSize = IMAGE_CONFIG.INFO_ICON_SIZE
		const offset = IMAGE_CONFIG.OFFSET

		// 按钮位置（右上角）
		const buttonX = this.config.width - buttonSize - offset
		const buttonY = offset

		// 创建按钮容器 Group，用于统一控制缩放
		const buttonGroup = new Konva.Group({
			x: buttonX,
			y: buttonY,
			listening: true,
			visible: false, // 默认隐藏，hover 时显示
			name: "decorator-info-button-group",
		})

		// 创建按钮背景（圆角矩形）
		const buttonBg = new Konva.Rect({
			x: 0,
			y: 0,
			width: buttonSize,
			height: buttonSize,
			cornerRadius: IMAGE_CONFIG.CORNER_RADIUS,
			fill: COLORS.BUTTON_BG,
			listening: true,
			name: "decorator-info-button",
		})

		buttonGroup.add(buttonBg)

		// 加载 Info 图标
		const infoImage = new Image()
		infoImage.onload = () => {
			// 计算图标居中位置
			const iconX = (buttonSize - iconSize) / 2
			const iconY = (buttonSize - iconSize) / 2

			// 创建图标节点
			const iconNode = new Konva.Image({
				image: infoImage,
				width: iconSize,
				height: iconSize,
				x: iconX,
				y: iconY,
				listening: false,
			})

			buttonGroup.add(iconNode)
			this.group.add(buttonGroup)

			// 绑定事件
			this.setupButtonEvents(buttonBg)

			// 按钮组已添加到 stage，现在可以设置缩放
			this.updateButtonScale()

			this.group.getLayer()?.batchDraw()
		}

		infoImage.src = infoIcon

		// 保存按钮组引用
		this.buttonGroup = buttonGroup

		// 监听 viewport 缩放事件
		this.setupViewportScaleListener()

		// 设置 hover 显示/隐藏逻辑
		this.setupHoverBehavior()

		// 监听元素 transform 事件
		this.setupElementTransformListener()
	}

	/**
	 * 设置按钮事件
	 */
	private setupButtonEvents(buttonBg: Konva.Rect): void {
		// 在 mousedown 时就处理按钮点击并阻止事件传播
		buttonBg.on("mousedown", (e) => {
			// 立即阻止事件传播（包括捕获和冒泡）
			e.cancelBubble = true
			if (e.evt) {
				e.evt.stopPropagation()
				e.evt.stopImmediatePropagation()
			}

			// 选中该图片元素
			this.config.canvas.selectionManager.select(this.config.elementId, false)

			// 触发点击回调
			if (this.config.onClick) {
				this.config.onClick()
			} else {
				// 默认行为：触发显示 MessageHistory 事件
				this.config.canvas.eventEmitter.emit({
					type: "element:image:infoButtonClick",
					data: {
						elementId: this.config.elementId,
					},
				})
			}
		})

		// 阻止 mouseup 和 mousemove 事件传播
		buttonBg.on("mouseup", (e) => {
			e.cancelBubble = true
			if (e.evt) {
				e.evt.stopPropagation()
			}
		})

		buttonBg.on("mousemove", (e) => {
			e.cancelBubble = true
			if (e.evt) {
				e.evt.stopPropagation()
			}
		})

		// 也阻止 click 事件传播（虽然主要逻辑在 mousedown）
		buttonBg.on("click tap", (e) => {
			e.cancelBubble = true
			if (e.evt) {
				e.evt.stopPropagation()
			}
		})

		// 添加悬停效果（只在选择工具下生效）
		buttonBg.on("mouseenter", () => {
			// 检查当前工具是否为选择工具
			const currentTool = this.config.canvas.toolManager.getActiveTool()
			const isSelectionTool =
				currentTool && this.config.canvas.toolManager.getSelectionTool() === currentTool
			if (!isSelectionTool) {
				return
			}

			buttonBg.fill(COLORS.BUTTON_BG_HOVER)
			this.config.canvas.cursorManager.setTemporary("pointer")
			this.group.getLayer()?.batchDraw()
		})

		buttonBg.on("mouseleave", () => {
			// 检查当前工具是否为选择工具
			const currentTool = this.config.canvas.toolManager.getActiveTool()
			const isSelectionTool =
				currentTool && this.config.canvas.toolManager.getSelectionTool() === currentTool
			if (!isSelectionTool) {
				return
			}

			buttonBg.fill(COLORS.BUTTON_BG)
			this.config.canvas.cursorManager.restoreToolCursor()
			this.group.getLayer()?.batchDraw()
		})
	}

	/**
	 * 更新 info 按钮的缩放比例，使其不受 viewport 缩放和元素 transform 影响
	 */
	public updateButtonScale(): void {
		if (!this.buttonGroup) return

		const stage = this.buttonGroup.getStage()
		if (!stage) return

		// 获取 viewport 缩放
		const viewportScale = stage.scaleX()

		// 获取元素自身的缩放
		const elementScaleX = this.group.scaleX()
		const elementScaleY = this.group.scaleY()

		// 计算图片元素在屏幕上的实际尺寸
		const elementScreenWidth = this.config.width * elementScaleX * viewportScale
		const elementScreenHeight = this.config.height * elementScaleY * viewportScale
		const minElementScreenSize = Math.min(elementScreenWidth, elementScreenHeight)

		// 如果图片元素在屏幕上太小，隐藏按钮
		if (minElementScreenSize < IMAGE_CONFIG.MIN_ELEMENT_SCREEN_SIZE_FOR_INFO_BUTTON) {
			this.buttonGroup.visible(false)
			return
		}

		// 计算总的反向缩放（同时抵消 viewport 和元素自身的缩放）
		const inverseScaleX = 1 / (viewportScale * elementScaleX)
		const inverseScaleY = 1 / (viewportScale * elementScaleY)

		this.buttonGroup.scale({ x: inverseScaleX, y: inverseScaleY })

		// 更新按钮位置，考虑缩放后的实际尺寸
		const buttonSize = IMAGE_CONFIG.INFO_BUTTON_SIZE
		const maxScreenOffset = LAYOUT.MAX_SCREEN_OFFSET
		const minScreenOffset = LAYOUT.MIN_SCREEN_OFFSET

		// 计算缩放后按钮的实际尺寸
		const scaledButtonSize = buttonSize * inverseScaleX

		// offset 在画布坐标系中保持相对固定，但在屏幕上限制在 4-8px 范围内
		const baseCanvasOffset = IMAGE_CONFIG.OFFSET

		// 计算该 offset 在当前缩放下对应的屏幕像素
		const totalScale = viewportScale * elementScaleX
		const screenOffset = baseCanvasOffset * totalScale

		// 如果屏幕像素超出范围，则调整画布坐标的 offset
		let canvasOffset = baseCanvasOffset
		if (screenOffset > maxScreenOffset) {
			canvasOffset = maxScreenOffset / totalScale
		} else if (screenOffset < minScreenOffset) {
			canvasOffset = minScreenOffset / totalScale
		}

		// 重新计算位置
		const adjustedX = this.config.width - scaledButtonSize - canvasOffset
		const adjustedY = canvasOffset

		this.buttonGroup.position({
			x: adjustedX,
			y: adjustedY,
		})
	}

	/**
	 * 更新配置（当元素尺寸变化时）
	 */
	public updateConfig(config: Partial<InfoButtonDecoratorConfig>): void {
		this.config = { ...this.config, ...config }
		this.updateButtonScale()
	}

	/**
	 * 设置 viewport 缩放事件监听
	 */
	private setupViewportScaleListener(): void {
		if (this.viewportScaleHandler) return

		this.viewportScaleHandler = () => {
			this.updateButtonScale()
			this.buttonGroup?.getLayer()?.batchDraw()
		}

		this.config.canvas.eventEmitter.on("viewport:scale", this.viewportScaleHandler)
	}

	/**
	 * 移除 viewport 缩放事件监听
	 */
	private removeViewportScaleListener(): void {
		if (this.viewportScaleHandler) {
			this.config.canvas.eventEmitter.off("viewport:scale", this.viewportScaleHandler)
			this.viewportScaleHandler = undefined
		}
	}

	/**
	 * 设置元素 transform 事件监听（监听 transformer 缩放）
	 */
	private setupElementTransformListener(): void {
		if (this.elementTransformHandler) return

		this.elementTransformHandler = () => {
			this.updateButtonScale()
			this.buttonGroup?.getLayer()?.batchDraw()
		}

		// 监听 Group 的 transform 事件
		this.group.on("transform", this.elementTransformHandler)
	}

	/**
	 * 移除元素 transform 事件监听
	 */
	private removeElementTransformListener(): void {
		if (this.elementTransformHandler) {
			this.group.off("transform", this.elementTransformHandler)
			this.elementTransformHandler = undefined
		}
	}

	/**
	 * 处理 mouseleave 逻辑（隐藏按钮）
	 */
	private handleMouseLeave(): void {
		if (this.buttonGroup) {
			this.buttonGroup.visible(false)
			this.group.getLayer()?.batchDraw()
		}
	}

	/**
	 * 设置 info 按钮的 hover 显示/隐藏逻辑
	 */
	private setupHoverBehavior(): void {
		this.group.on("mouseenter", () => {
			if (this.buttonGroup) {
				// 先设置为可见
				this.buttonGroup.visible(true)
				// 更新按钮缩放，内部会根据元素屏幕尺寸判断是否需要隐藏
				this.updateButtonScale()
				this.group.getLayer()?.batchDraw()
			}
		})

		this.group.on("mouseleave", () => {
			this.handleMouseLeave()
		})

		// 监听元素取消选中事件，执行 mouseleave 逻辑
		this.deselectHandler = () => {
			// 检查当前元素是否被选中
			if (!this.config.canvas.selectionManager.isSelected(this.config.elementId)) {
				this.handleMouseLeave()
			}
		}
		this.config.canvas.eventEmitter.on("element:deselect", this.deselectHandler)

		// 监听拖拽开始事件，隐藏 info button
		this.group.on("dragstart", () => {
			if (this.buttonGroup) {
				this.buttonGroup.visible(false)
				this.group.getLayer()?.batchDraw()
			}
		})

		// 监听拖拽结束事件，如果鼠标还在元素上则显示 info button
		this.group.on("dragend", () => {
			if (this.buttonGroup) {
				// 检查鼠标是否还在元素上
				const stage = this.group.getStage()
				if (stage) {
					const pointerPos = stage.getPointerPosition()
					if (pointerPos) {
						const shape = stage.getIntersection(pointerPos)
						// 如果鼠标还在图片元素内，更新按钮缩放并显示
						const isInGroup =
							shape &&
							(this.group.findOne(
								(node: Konva.Node) =>
									node === shape || shape.getAncestors().includes(node),
							) ||
								shape.name().startsWith("decorator-"))
						if (isInGroup) {
							// 先设置为可见
							this.buttonGroup.visible(true)
							// 更新按钮缩放，内部会根据元素屏幕尺寸判断是否需要隐藏
							this.updateButtonScale()
							this.group.getLayer()?.batchDraw()
						}
					}
				}
			}
		})
	}

	/**
	 * 显示按钮
	 */
	public show(): void {
		if (this.buttonGroup) {
			this.buttonGroup.visible(true)
			this.updateButtonScale()
			this.group.getLayer()?.batchDraw()
		}
	}

	/**
	 * 隐藏按钮
	 */
	public hide(): void {
		if (this.buttonGroup) {
			this.buttonGroup.visible(false)
			this.group.getLayer()?.batchDraw()
		}
	}

	/**
	 * 移除元素取消选中事件监听
	 */
	private removeDeselectListener(): void {
		if (this.deselectHandler) {
			this.config.canvas.eventEmitter.off("element:deselect", this.deselectHandler)
			this.deselectHandler = undefined
		}
	}

	/**
	 * 销毁装饰器
	 */
	public destroy(): void {
		this.removeViewportScaleListener()
		this.removeElementTransformListener()
		this.removeDeselectListener()

		if (this.buttonGroup) {
			this.buttonGroup.destroy()
			this.buttonGroup = undefined
		}
	}
}
