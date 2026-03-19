import Konva from "konva"
import type { FrameElement as FrameElementData, LayerElement } from "../../types"
import { BaseElement, type TransformContext } from "../BaseElement"
import { TransformBehavior } from "../../interaction/TransformManager"
import type { Canvas } from "../../Canvas"
import { BorderDecorator } from "../decorators/BorderDecorator"
import { DECORATOR_COLORS, DECORATOR_CONFIG } from "../decorators/DecoratorConfig"
/**
 * 画框元素类
 * 画框本质上是一个带背景的组容器
 */
export class FrameElement extends BaseElement<FrameElementData> {
	// 边框装饰器
	private borderDecorator?: BorderDecorator

	constructor(data: FrameElementData, canvas: Canvas) {
		super(data, canvas)
	}

	/**
	 * 获取画框默认配置
	 */
	static getDefaultConfig() {
		return {}
	}

	/**
	 * 获取渲染名称（用于显示的默认名称，支持多语言）
	 */
	public getRenderName(): string {
		return this.getText("frame.defaultName", "画框")
	}

	/**
	 * 创建画框元素数据
	 */
	static createElementData(
		id: string,
		x: number,
		y: number,
		width: number,
		height: number,
		zIndex: number = 0,
	): FrameElementData {
		return {
			id,
			type: "frame" as const,
			x,
			y,
			width,
			height,
			zIndex,
		}
	}

	render(): Konva.Group | null {
		if (!this.data.width || !this.data.height) {
			return null
		}

		const width = this.data.width
		const height = this.data.height

		const group = new Konva.Group({
			// 设置裁剪函数实现 overflow hidden 效果
			clipFunc: (ctx) => {
				ctx.rect(0, 0, width, height)
			},
		})

		// 创建事件代理 hit 节点（必须在最底层）
		this.createHitNode(group, this.data.width, this.data.height)

		// 创建背景矩形
		const backgroundRect = new Konva.Rect({
			x: 0,
			y: 0,
			width: this.data.width,
			height: this.data.height,
			fill: "#FFFFFF",
			listening: false,
			name: "background",
		})

		group.add(backgroundRect)

		this.finalizeNode(group)
		return group
	}

	/**
	 * 生命周期钩子：节点已挂载到 Layer
	 * 在节点被添加到 Layer 后创建边框，确保可以访问 stage
	 */
	override onMounted(): void {
		if (this.node instanceof Konva.Group && this.data.width && this.data.height) {
			this.createBorder(this.node, this.data.width, this.data.height)
		}
	}

	/**
	 * 重写边界计算方法
	 * Frame 元素应该使用固定的 width/height，而不是计算子节点边界
	 */
	protected override setupCustomBoundingRect(node: Konva.Group): void {
		if (!(node instanceof Konva.Group)) {
			return
		}

		// Frame 元素使用固定尺寸，基于背景矩形的边界
		node.getClientRect = (config?: Parameters<Konva.Node["getClientRect"]>[0]) => {
			// 获取背景矩形（它的尺寸就是 Frame 的尺寸）
			const backgroundRect = node.findOne(".background") as Konva.Rect | undefined
			if (backgroundRect) {
				// 使用背景矩形的 getClientRect，它会正确处理相对位置
				return backgroundRect.getClientRect(config)
			}

			// 如果找不到背景矩形，使用默认的计算方式
			const width = node.width()
			const height = node.height()
			const scaleX = node.scaleX()
			const scaleY = node.scaleY()

			// 获取相对位置
			const pos = config?.relativeTo ? node.getPosition() : node.getAbsolutePosition()

			return {
				x: pos.x,
				y: pos.y,
				width: width * scaleX,
				height: height * scaleY,
			}
		}
	}

	update(newData: FrameElementData): boolean {
		this.data = newData

		// 画框元素不需要重新渲染，所有属性都可以通过 setAttrs 更新
		if (this.node instanceof Konva.Group) {
			// 更新基础属性（位置、可见性、透明度、zIndex、锁定状态）
			this.updateBaseProps(this.node, newData)

			// 更新 hit 节点尺寸
			const hitRect = this.node.findOne(".hit-area") as Konva.Rect | undefined
			if (hitRect) {
				hitRect.setAttrs({
					width: newData.width,
					height: newData.height,
				})
			}

			// 更新背景矩形尺寸
			const backgroundRect = this.node.findOne(".background") as Konva.Rect | undefined
			if (backgroundRect) {
				backgroundRect.setAttrs({
					width: newData.width,
					height: newData.height,
				})
			}

			// 更新边框尺寸
			if (this.borderDecorator && newData.width && newData.height) {
				this.borderDecorator.updateSize(newData.width, newData.height)
			}

			// 更新裁剪区域以匹配新尺寸
			if (newData.width && newData.height) {
				const width = newData.width
				const height = newData.height
				this.node.clipFunc((ctx) => {
					ctx.rect(0, 0, width, height)
				})
			}

			// 触发重绘
			this.node.getLayer()?.batchDraw()
		}

		return false
	}

	/**
	 * 重写 getData 方法，动态获取子元素的最新数据
	 * 确保返回的 children 数组包含子元素的最新状态（如 zIndex）
	 */
	getData(): FrameElementData {
		// 如果没有 children，直接返回原始数据
		if (!this.data.children) {
			return this.data
		}

		// 动态获取所有子元素的最新数据
		const updatedChildren = this.data.children
			.map((child) => {
				const latestData = this.canvas.elementManager.getElementData(child.id)
				return latestData || child // 如果找不到最新数据，使用原始数据
			})
			.filter((child) => child !== null) // 过滤掉已删除的子元素

		// 返回包含最新子元素数据的 Frame 数据
		return {
			...this.data,
			children: updatedChildren,
		}
	}

	/**
	 * 将元素渲染到Canvas上下文
	 * @param ctx - Canvas 2D渲染上下文
	 * @param offsetX - 元素在Canvas中的X偏移量
	 * @param offsetY - 元素在Canvas中的Y偏移量
	 * @param options - 可选参数
	 * @param options.shouldDrawBorder - 是否绘制边框（默认 false）
	 * @param options.width - 可选的渲染宽度，如果提供则使用此宽度而非元素实际宽度
	 * @param options.height - 可选的渲染高度，如果提供则使用此高度而非元素实际高度
	 * @returns Promise<boolean> - 渲染是否成功
	 */
	public override async renderToCanvas(
		ctx: CanvasRenderingContext2D,
		offsetX: number,
		offsetY: number,
		options?: { shouldDrawBorder?: boolean; width?: number; height?: number },
	): Promise<boolean> {
		try {
			const width = this.data.width || 0
			const height = this.data.height || 0
			const scaleX = this.data.scaleX ?? 1
			const scaleY = this.data.scaleY ?? 1

			const actualWidth = width * scaleX
			const actualHeight = height * scaleY

			// 如果提供了可选的宽高，则使用提供的宽高，并计算缩放比例
			const renderWidth = options?.width ?? actualWidth
			const renderHeight = options?.height ?? actualHeight
			const scaleRatioX = renderWidth / actualWidth
			const scaleRatioY = renderHeight / actualHeight

			if (renderWidth <= 0 || renderHeight <= 0) {
				return false
			}

			// 保存当前Canvas状态
			ctx.save()

			// 设置裁剪区域（clipFunc）
			ctx.beginPath()
			ctx.rect(offsetX, offsetY, renderWidth, renderHeight)
			ctx.clip()

			// 绘制Frame的白色背景矩形
			ctx.fillStyle = "#FFFFFF"
			ctx.fillRect(offsetX, offsetY, renderWidth, renderHeight)

			// 递归渲染所有子元素
			const frameData = this.getData()
			if (frameData.children && frameData.children.length > 0) {
				// 按zIndex排序子元素（zIndex大的在前）
				const sortedChildren = [...frameData.children].sort(
					(a, b) => (b.zIndex ?? 0) - (a.zIndex ?? 0),
				)

				// 遍历子元素并渲染
				for (const child of sortedChildren) {
					const childInstance = this.canvas.elementManager.getElementInstance(child.id)

					if (childInstance && typeof childInstance.renderToCanvas === "function") {
						// 计算子元素相对于Frame的偏移量（考虑缩放比例）
						// Frame的子元素坐标已经是相对于Frame的
						const childOffsetX = offsetX + (child.x ?? 0) * scaleX * scaleRatioX
						const childOffsetY = offsetY + (child.y ?? 0) * scaleY * scaleRatioY

						// 计算子元素的缩放后尺寸
						const childWidth = (child.width ?? 0) * (child.scaleX ?? 1) * scaleRatioX
						const childHeight = (child.height ?? 0) * (child.scaleY ?? 1) * scaleRatioY

						// 调用子元素的 renderToCanvas 方法，传递缩放后的宽高
						// 子元素不绘制边框，因为边框应该由父 Frame 元素绘制
						await childInstance.renderToCanvas(ctx, childOffsetX, childOffsetY, {
							shouldDrawBorder: false,
							width: childWidth,
							height: childHeight,
						})
					}
				}
			}

			// 恢复Canvas状态
			ctx.restore()

			// 如果需要绘制边框，在恢复状态后绘制
			if (options?.shouldDrawBorder) {
				ctx.save()
				ctx.strokeStyle = DECORATOR_COLORS.BORDER_DEFAULT
				ctx.lineWidth = DECORATOR_CONFIG.BORDER_WIDTH
				ctx.strokeRect(offsetX, offsetY, renderWidth, renderHeight)
				ctx.restore()
			}

			return true
		} catch (error) {
			return false
		}
	}

	// ==================== 变换行为相关方法 ====================

	/**
	 * Frame 需要实时将 scale 应用到尺寸，以防止子元素跟随缩放
	 */
	public override getTransformBehavior(): TransformBehavior {
		return TransformBehavior.REALTIME_APPLY_TO_SIZE
	}

	/**
	 * 应用变换到画框元素
	 * REALTIME_APPLY_TO_SIZE 行为：始终实时将 scale 应用到 width/height
	 */
	public override applyTransform(
		updates: LayerElement,
		context: TransformContext,
	): Partial<LayerElement> {
		const scaleX = updates.scaleX ?? 1
		const scaleY = updates.scaleY ?? 1

		// 始终实时应用到尺寸（防止子元素跟随缩放）
		if (scaleX !== 1 || scaleY !== 1) {
			const newSize = this.applyScaleToSize(updates, context)

			// 更新内部节点（背景、边框等）
			this.updateInternalNodes(newSize.width, newSize.height)

			return {
				x: updates.x,
				y: updates.y,
				width: newSize.width,
				height: newSize.height,
				scaleX: 1,
				scaleY: 1,
			}
		}

		// scale 为 1 时，也可能需要更新尺寸（纯拖拽或位置变化）
		if (updates.width !== undefined && updates.height !== undefined) {
			this.updateInternalNodes(updates.width, updates.height)
		}

		return {
			x: updates.x,
			y: updates.y,
			width: updates.width,
			height: updates.height,
			scaleX: 1,
			scaleY: 1,
		}
	}

	/**
	 * 更新内部节点（背景、边框、裁剪区域等）
	 */
	private updateInternalNodes(width: number, height: number): void {
		if (this.node instanceof Konva.Group) {
			// 更新背景矩形
			const backgroundRect = this.node.findOne(".background") as Konva.Rect | undefined
			if (backgroundRect) {
				backgroundRect.width(width)
				backgroundRect.height(height)
			}

			// 更新 hit 区域
			const hitRect = this.node.findOne(".hit-area") as Konva.Rect | undefined
			if (hitRect) {
				hitRect.width(width)
				hitRect.height(height)
			}

			// 更新边框尺寸
			if (this.borderDecorator) {
				this.borderDecorator.updateSize(width, height)
			}

			// 更新裁剪区域
			this.node.clipFunc((ctx) => {
				ctx.rect(0, 0, width, height)
			})
		}
	}

	/**
	 * 在 transform 过程中更新背景和 hit 区域
	 * @deprecated 使用 applyTransform 替代
	 */
	public override onTransformResize(width: number, height: number): void {
		this.updateInternalNodes(width, height)
	}

	/**
	 * 重新渲染节点（重写以清理边框装饰器）
	 */
	override rerender(): Konva.Node | null {
		// 在重新渲染前清理边框装饰器
		this.borderDecorator?.destroy()
		this.borderDecorator = undefined

		// 调用父类的 rerender
		return super.rerender()
	}

	/**
	 * 销毁元素时清理资源
	 */
	override destroy(): void {
		this.borderDecorator?.destroy()
		this.borderDecorator = undefined
		super.destroy()
	}

	/**
	 * 创建边框
	 */
	private createBorder(group: Konva.Group, width: number, height: number): void {
		this.borderDecorator = new BorderDecorator(group, width, height, {
			isAnimated: false, // Frame 元素不需要动画边框
			elementId: this.data.id,
			canvas: this.canvas,
		})
		// Frame 不需要背景切换功能，所以不传递背景节点
		this.borderDecorator.create()
	}

	/**
	 * 确保边框始终在最上层
	 * 当子元素被添加或重新排序时调用
	 */
	public ensureBorderOnTop(): void {
		this.borderDecorator?.moveToTop()
	}
}
