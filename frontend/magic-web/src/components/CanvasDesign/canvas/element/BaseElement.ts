import Konva from "konva"
import type { BaseElementProps, LayerElement } from "../types"
import type { Canvas } from "../Canvas"
import type { Rect } from "../utils/utils"
import { TransformBehavior } from "../interaction/TransformManager"
import { HoverManager } from "../interaction/HoverManager"
import { normalizeSize } from "../utils/normalizeUtils"

/**
 * 变换上下文
 */
export interface TransformContext {
	/** 是否实时变换（transform 事件中） */
	isRealtime: boolean
	/** 是否正在缩放（通过 anchor） */
	isScaling: boolean
	/** 是否保持宽高比 */
	shouldKeepRatio: boolean
	/** 初始宽高比（用于锁定比例） */
	initialAspectRatio?: number
}

/**
 * 基础元素默认配置
 */
export const BASE_ELEMENT_DEFAULTS = {
	visible: true,
	opacity: 1,
	locked: false,
	draggable: true,
	listening: true,
	perfectDrawEnabled: false,
	zIndex: 0,
} as const

/**
 * 基础元素抽象类
 * 每个元素都是一个实例，封装了数据和渲染节点
 */
export abstract class BaseElement<T extends BaseElementProps = BaseElementProps> {
	public canvas: Canvas

	protected node: Konva.Node | null = null
	protected data: T

	constructor(data: T, canvas: Canvas) {
		this.data = data
		this.canvas = canvas
	}

	/**
	 * 渲染元素为 Konva 节点
	 * 可以多次调用以重新创建节点
	 * 注意：子类实现时应该调用 finalizeNode() 来完成节点的最终设置
	 */
	abstract render(): Konva.Node | null

	/**
	 * 更新元素数据和节点（数据变化时）
	 * @param newData 新的元素数据
	 * @returns 是否需要重新渲染节点（true 表示需要调用 rerender）
	 */
	abstract update(newData: T): boolean

	/**
	 * 生命周期钩子：节点已挂载到 Layer
	 * 在节点被添加到 Layer 后调用，此时可以安全地访问 stage
	 * 子类可以重写此方法来执行需要 stage 的初始化操作（如创建装饰器）
	 */
	onMounted(): void {
		// 默认实现为空，子类可以重写
	}

	/**
	 * 获取当前节点
	 */
	getNode(): Konva.Node | null {
		return this.node
	}

	/**
	 * 获取元素数据（内部使用，返回引用）
	 */
	getData(): T {
		return this.data
	}

	/**
	 * 导出元素数据（用于导出文档，返回深拷贝）
	 */
	exportData(): T {
		return JSON.parse(JSON.stringify(this.data)) as T
	}

	/**
	 * 获取元素 ID
	 */
	getId(): string {
		return this.data.id
	}

	/**
	 * 获取翻译文本（支持多语言）
	 * @param key 翻译键
	 * @param fallback 回退文本
	 * @returns 翻译后的文本或回退文本
	 */
	protected getText(key: string, fallback: string): string {
		if (this.canvas.t) {
			return this.canvas.t(key, fallback)
		}
		return fallback
	}

	/**
	 * 获取渲染名称（用于显示的默认名称，支持多语言）
	 * 子类必须实现此方法以返回元素的默认显示名称
	 */
	public abstract getRenderName(): string

	/**
	 * 获取名称标签文本（子类可重写以添加状态后缀）
	 * 优先使用 data.name（用户自定义名称），如果没有则使用 getRenderName()
	 */
	public getNameLabelText(): string {
		return this.data.name || this.getRenderName()
	}

	/**
	 * 获取尺寸标签文本
	 * 默认返回 "width x height" 格式，如果尺寸为 0 或不存在则返回空字符串
	 */
	public getSizeLabelText(): string {
		const width = this.data.width ?? 0
		const height = this.data.height ?? 0

		// 如果宽高都为 0，不显示
		if (width === 0 && height === 0) {
			return ""
		}

		// 格式化尺寸，保留整数或最多一位小数
		const formatSize = (value: number): string => {
			return Number.isInteger(value) ? value.toString() : value.toFixed(1)
		}

		return `${formatSize(width)} x ${formatSize(height)}`
	}

	/**
	 * 将元素渲染到Canvas上下文（可选方法，子类可实现）
	 * 用于导出PNG等场景，将元素内容绘制到指定的Canvas 2D上下文中
	 * @param ctx - Canvas 2D渲染上下文
	 * @param offsetX - 元素在Canvas中的X偏移量
	 * @param offsetY - 元素在Canvas中的Y偏移量
	 * @param options - 渲染选项
	 * @param options.shouldDrawBorder - 是否绘制边框（默认 false）
	 * @param options.width - 可选的渲染宽度，如果提供则使用此宽度而非元素实际宽度
	 * @param options.height - 可选的渲染高度，如果提供则使用此高度而非元素实际高度
	 * @returns Promise<boolean> - 渲染是否成功

	 */
	public async renderToCanvas(
		ctx: CanvasRenderingContext2D,
		offsetX: number,
		offsetY: number,
		options?: { shouldDrawBorder?: boolean; width?: number; height?: number },
	): Promise<boolean> {
		// 默认实现返回 false，表示不支持
		// 子类可以重写此方法以提供具体实现
		void ctx
		void offsetX
		void offsetY
		void options
		return false
	}

	// ==================== 元素操作方法 ====================

	/**
	 * 获取元素位置
	 */
	public getPosition(): { x: number; y: number } {
		return { x: this.data.x ?? 0, y: this.data.y ?? 0 }
	}

	/**
	 * 设置元素位置（通过 ElementManager 统一更新）
	 */
	public setPosition(x: number, y: number, options?: { silent?: boolean }): void {
		// 通过 ElementManager 统一更新（会同时更新 data 和 node）
		this.canvas.elementManager.update(
			this.data.id,
			{ x, y },
			{
				mode: "full",
				silent: options?.silent ?? false,
			},
		)
	}

	/**
	 * 获取元素尺寸
	 */
	public getSize(): { width: number; height: number } {
		return {
			width: this.data.width ?? 0,
			height: this.data.height ?? 0,
		}
	}

	/**
	 * 设置元素尺寸（通过 ElementManager 统一更新）
	 */
	public setSize(width: number, height: number, options?: { silent?: boolean }): void {
		// 通过 ElementManager 统一更新（会自动规范化尺寸并同时更新 data 和 node）
		this.canvas.elementManager.update(
			this.data.id,
			{ width, height },
			{
				mode: "full",
				silent: options?.silent ?? false,
			},
		)
	}

	/**
	 * 获取透明度
	 */
	public getOpacity(): number {
		return this.data.opacity ?? 1
	}

	/**
	 * 设置透明度
	 * @param opacity - 透明度值 (0-1)
	 * @param options.temporary - 仅更新视图，不更新数据（用于临时视觉效果）
	 * @param options.silent - 不触发 ElementManager 更新事件
	 */
	public setOpacity(opacity: number, options?: { temporary?: boolean; silent?: boolean }): void {
		if (options?.temporary) {
			// 临时效果：只更新 node，不更新 data
			this.canvas.elementManager.update(
				this.data.id,
				{ opacity },
				{
					mode: "node-only",
					silent: true,
				},
			)
		} else {
			// 永久更新：通过 ElementManager 统一更新
			this.canvas.elementManager.update(
				this.data.id,
				{ opacity },
				{
					mode: "full",
					silent: options?.silent ?? false,
				},
			)
		}
	}

	/**
	 * 获取可见性
	 */
	public getVisible(): boolean {
		return this.data.visible ?? true
	}

	/**
	 * 设置可见性（通过 ElementManager 统一更新）
	 */
	public setVisible(visible: boolean, options?: { silent?: boolean }): void {
		// 通过 ElementManager 统一更新（会同时更新 data 和 node）
		this.canvas.elementManager.update(
			this.data.id,
			{ visible },
			{
				mode: "full",
				silent: options?.silent ?? false,
			},
		)
	}

	/**
	 * 获取缩放
	 */
	public getScale(): { scaleX: number; scaleY: number } {
		return {
			scaleX: this.data.scaleX ?? 1,
			scaleY: this.data.scaleY ?? 1,
		}
	}

	/**
	 * 设置缩放（通过 ElementManager 统一更新）
	 */
	public setScale(scaleX: number, scaleY: number, options?: { silent?: boolean }): void {
		// 通过 ElementManager 统一更新（会同时更新 data 和 node）
		this.canvas.elementManager.update(
			this.data.id,
			{ scaleX, scaleY },
			{
				mode: "full",
				silent: options?.silent ?? false,
			},
		)
	}

	// ==================== 变换行为相关方法 ====================

	/**
	 * 获取元素的变换行为
	 * 子类可以重写此方法来定义自己的变换行为
	 * @returns 变换行为类型
	 */
	public getTransformBehavior(): TransformBehavior {
		return TransformBehavior.USE_SCALE
	}

	/**
	 * 是否需要在 transformer 缩放时保持宽高比
	 * 子类可以重写此方法来定义是否需要保持比例
	 * @returns 是否需要保持比例，默认返回 interactionConfig.aspectRatioLocked
	 */
	public shouldKeepRatio(): boolean {
		return this.data.interactionConfig?.aspectRatioLocked ?? false
	}

	/**
	 * 当元素在 transform 过程中尺寸改变时调用（仅对 REALTIME_APPLY_TO_SIZE 生效）
	 * 子类可以重写此方法来更新内部节点
	 * @param width - 新的宽度
	 * @param height - 新的高度
	 */
	public onTransformResize?(width: number, height: number): void

	/**
	 * 应用变换到元素（由 TransformManager 调用）
	 * 子类可以重写此方法来定制变换行为
	 * @param updates - 变换属性（x, y, width, height, scaleX, scaleY）
	 * @param context - 变换上下文
	 * @returns 实际应用的更新（可能经过规范化）
	 */
	public applyTransform(
		updates: Partial<LayerElement>,
		context: TransformContext,
	): Partial<LayerElement> {
		const behavior = this.getTransformBehavior()

		// 默认行为：USE_SCALE
		if (behavior === TransformBehavior.USE_SCALE) {
			// 直接应用 scale
			return {
				x: updates.x,
				y: updates.y,
				scaleX: updates.scaleX,
				scaleY: updates.scaleY,
			}
		}

		// APPLY_TO_SIZE 和 REALTIME_APPLY_TO_SIZE 由子类处理
		// 这里提供一个基础实现，子类可以重写
		return updates
	}

	/**
	 * 将 scale 应用到 width/height（辅助方法）
	 * @param updates - 包含 width, height, scaleX, scaleY 的更新
	 * @param context - 变换上下文
	 * @returns 包含新的 width 和 height
	 */
	protected applyScaleToSize(
		updates: Partial<LayerElement>,
		context: TransformContext,
	): { width: number; height: number } {
		const width = updates.width ?? this.data.width ?? 0
		const height = updates.height ?? this.data.height ?? 0
		const scaleX = updates.scaleX ?? 1
		const scaleY = updates.scaleY ?? 1

		// 计算新的尺寸
		const newWidth = width * scaleX
		const newHeight = height * scaleY

		// 规范化尺寸
		const normalizedSize = normalizeSize(newWidth, newHeight, {
			precision: "integer",
			keepAspectRatio: context.shouldKeepRatio,
			aspectRatio: context.shouldKeepRatio ? context.initialAspectRatio : undefined,
		})

		return normalizedSize
	}

	/**
	 * 获取 zIndex
	 */
	public getZIndex(): number {
		return this.data.zIndex ?? 0
	}

	/**
	 * 设置 zIndex
	 */
	public setZIndex(zIndex: number): void {
		this.data = { ...this.data, zIndex }
		this.canvas.elementManager.update(this.data.id, { zIndex }, { silent: false })
	}

	/**
	 * 判断元素是否锁定
	 */
	public isLocked(): boolean {
		return this.data.locked ?? false
	}

	/**
	 * 设置锁定状态
	 */
	public setLocked(locked: boolean): void {
		this.data = { ...this.data, locked }
		if (this.node) {
			const canDrag = this.canElementTransform()
			this.node.draggable(canDrag)
			this.node.getLayer()?.batchDraw()
		}
		this.canvas.elementManager.update(this.data.id, { locked }, { silent: false })
	}

	/**
	 * 设置拖拽状态
	 */
	public setDraggable(draggable: boolean): void {
		if (this.node) {
			this.node.draggable(draggable)
		}
	}

	/**
	 * 设置监听状态
	 */
	public setListening(listening: boolean): void {
		if (this.node) {
			this.node.listening(listening)
		}
	}

	/**
	 * 销毁元素
	 */
	destroy(): void {
		this.node?.destroy()
		this.node = null
	}

	/**
	 * 重新渲染节点
	 * 销毁旧节点，创建新节点，但保持元素实例不变
	 * @returns 新创建的节点
	 */
	rerender(): Konva.Node | null {
		const parent = this.node?.getParent()
		const oldNode = this.node

		// 清理旧节点的监听器
		if (oldNode) {
			this.cleanupNodeListeners(oldNode)
		}

		// 销毁旧节点
		oldNode?.destroy()

		// 创建新节点
		const newNode = this.render()

		// 如果有父容器，添加回去
		if (newNode && parent) {
			parent.add(newNode)

			// 调用生命周期钩子：节点已重新挂载
			this.onMounted()

			// 重新排列节点顺序，确保 zIndex 生效
			// 判断父容器是 layer 还是 group（画框）
			if (parent === this.canvas.contentLayer) {
				// 顶层元素，重新排列顶层元素顺序
				this.canvas.elementManager.reorderTopLevelElementsPublic()
			} else {
				// 子元素（在画框内），重新排列父容器内的子元素顺序
				const parentElement = this.canvas.elementManager.findParentElement(this.data.id)
				if (parentElement) {
					this.canvas.elementManager.reorderChildrenInParentPublic(
						parentElement.getData().id,
					)
				}
			}
		}

		// 触发 element:rerendered 事件（用于更新依赖节点的功能，如 Transformer、Marker 等）
		if (newNode) {
			this.canvas.eventEmitter.emit({
				type: "element:rerendered",
				data: { elementId: this.data.id, data: this.data },
			})
		}

		return newNode
	}

	/**
	 * 应用基础属性到 Konva 节点
	 */
	protected applyBaseProps(node: Konva.Node): void {
		// 位置
		if (this.data.x !== undefined) node.x(this.data.x)
		if (this.data.y !== undefined) node.y(this.data.y)

		// 缩放
		if (this.data.scaleX !== undefined) node.scaleX(this.data.scaleX)
		if (this.data.scaleY !== undefined) node.scaleY(this.data.scaleY)

		// 对于 Group 类型节点，设置 width 和 height
		if (node instanceof Konva.Group) {
			if (this.data.width !== undefined) node.width(this.data.width)
			if (this.data.height !== undefined) node.height(this.data.height)
		}

		// 可见性和透明度
		node.visible(this.data.visible ?? BASE_ELEMENT_DEFAULTS.visible)
		node.opacity(this.data.opacity ?? BASE_ELEMENT_DEFAULTS.opacity)

		// 设置节点 ID 和名称
		node.id(this.data.id)
		if (this.data.name !== undefined) {
			node.name(this.data.name)
		}

		// 设置拖拽和交互 - 使用 PermissionManager 判断
		const canDrag = this.canElementTransform()
		node.draggable(canDrag)
	}

	/**
	 * 更新基础属性到 Konva 节点（用于增量更新，不重新渲染）
	 * 子类在 update() 方法中应该调用此方法来更新基础属性
	 */
	protected updateBaseProps(node: Konva.Node, newData: T): void {
		// 位置
		if (newData.x !== undefined) node.x(newData.x)
		if (newData.y !== undefined) node.y(newData.y)

		// 缩放
		if (newData.scaleX !== undefined) node.scaleX(newData.scaleX)
		if (newData.scaleY !== undefined) node.scaleY(newData.scaleY)

		// 对于 Group 类型节点，更新 width 和 height
		if (node instanceof Konva.Group) {
			if (newData.width !== undefined) node.width(newData.width)
			if (newData.height !== undefined) node.height(newData.height)
		}

		// 可见性和透明度
		if (newData.visible !== undefined) {
			node.visible(newData.visible)
		}
		if (newData.opacity !== undefined) {
			node.opacity(newData.opacity)
		}

		// 锁定状态 - 使用 PermissionManager 判断
		if (newData.locked !== undefined) {
			const canDrag = this.canElementTransform()
			node.draggable(canDrag)
		}
	}

	/**
	 * 设置节点监听器
	 * 子类可以重写此方法来添加额外的监听器
	 */
	protected setupNodeListeners(node: Konva.Node): void {
		// 设置右键菜单
		this.setupContextMenu(node)
	}

	/**
	 * 清理节点监听器
	 */
	protected cleanupNodeListeners(node: Konva.Node): void {
		// 移除右键菜单监听器
		node.off("contextmenu")
	}

	/**
	 * 完成节点设置（应用属性和设置监听器）
	 * 子类在 render() 方法中创建节点后应该调用此方法
	 */
	protected finalizeNode(node: Konva.Node): void {
		this.applyBaseProps(node)
		this.setupNodeListeners(node)
		this.setupCustomBoundingRect(node)
		this.node = node
	}

	/**
	 * 设置自定义边界计算（用于 Transformer）
	 * 重写节点的 getClientRect 方法，排除装饰性元素（名称标签等）
	 */
	protected setupCustomBoundingRect(node: Konva.Node): void {
		if (!(node instanceof Konva.Group)) {
			return
		}

		// 保存原始的 getClientRect 方法
		const originalGetClientRect = node.getClientRect.bind(node)

		// 重写 getClientRect 方法
		node.getClientRect = (config?: Parameters<Konva.Node["getClientRect"]>[0]) => {
			// 计算排除装饰性元素的边界
			const rects: { x: number; y: number; width: number; height: number }[] = []
			const children = node.children || []

			for (const child of children) {
				// 跳过装饰性元素（名称以 decorator- 开头）
				if (child.name().startsWith("decorator-")) {
					continue
				}

				// 获取子节点的边界
				const childRect = child.getClientRect(config)
				if (childRect.width > 0 && childRect.height > 0) {
					rects.push(childRect)
				}
			}

			// 如果没有有效的子节点，使用原始方法
			if (rects.length === 0) {
				return originalGetClientRect(config)
			}

			// 计算包含所有非装饰性子节点的边界
			let minX = Number.POSITIVE_INFINITY
			let minY = Number.POSITIVE_INFINITY
			let maxX = Number.NEGATIVE_INFINITY
			let maxY = Number.NEGATIVE_INFINITY

			for (const rect of rects) {
				minX = Math.min(minX, rect.x)
				minY = Math.min(minY, rect.y)
				maxX = Math.max(maxX, rect.x + rect.width)
				maxY = Math.max(maxY, rect.y + rect.height)
			}

			return {
				x: minX,
				y: minY,
				width: maxX - minX,
				height: maxY - minY,
			}
		}
	}

	/**
	 * 创建事件代理 hit 节点
	 * 用于 Group 元素，当所有子节点都设置了 listening: false 时，hit 节点可以接收事件并代理到父 Group
	 */
	protected createHitNode(group: Konva.Group, width: number, height: number): Konva.Rect {
		const hitRect = new Konva.Rect({
			x: 0,
			y: 0,
			width,
			height,
			fill: "white",
			opacity: 0,
			listening: true,
			name: "hit-area",
		})

		// 让 hit 节点继承父 Group 的 ID
		hitRect.id(this.data.id)

		group.add(hitRect)

		return hitRect
	}

	/**
	 * 设置元素的右键菜单事件监听
	 */
	protected setupContextMenu(node: Konva.Node): void {
		node.on("contextmenu", (e: Konva.KonvaEventObject<MouseEvent>) => {
			e.evt.preventDefault()
			e.cancelBubble = true

			this.canvas.eventEmitter.emit({
				type: "element:contextmenu",
				data: {
					elementId: this.data.id,
					x: e.evt.clientX,
					y: e.evt.clientY,
				},
			})
		})
	}

	/**
	 * 获取元素的边界矩形（用于交互计算）
	 * 子类可以重写此方法来提供自定义的边界计算逻辑
	 * 默认使用 Konva 的 getClientRect()
	 *
	 * @returns 边界矩形，如果无法计算则返回 null
	 */
	public getBoundingRect(): Rect | null {
		if (!this.node) return null

		const clientRect = this.node.getClientRect({
			relativeTo: this.node.getLayer() || undefined,
		})

		return {
			x: clientRect.x,
			y: clientRect.y,
			width: clientRect.width,
			height: clientRect.height,
		}
	}

	/**
	 * 获取节点相对于 layer 的矩形信息
	 * 用于创建和更新 hover 效果
	 *
	 * 此方法会正确处理：
	 * 1. Frame 内的子元素（相对坐标转绝对坐标）
	 * 2. Viewport 的缩放和平移（使用 relativeTo 参数）
	 * 3. 带 offset 的形状（通过 clientRect 计算中心点）
	 *
	 * @returns 相对于 layer 的位置和尺寸信息，如果无法计算则返回 null
	 */
	protected getLayerRelativeRect(): {
		x: number
		y: number
		width: number
		height: number
		centerX: number
		centerY: number
	} | null {
		if (!this.node) return null

		const layer = this.node.getLayer()
		if (!layer) return null

		const clientRect = this.node.getClientRect({ relativeTo: layer })

		return {
			x: clientRect.x,
			y: clientRect.y,
			width: clientRect.width,
			height: clientRect.height,
			centerX: clientRect.x + clientRect.width / 2,
			centerY: clientRect.y + clientRect.height / 2,
		}
	}

	/**
	 * 获取 hover 效果节点应该使用的位置
	 * 此方法会考虑形状的 offset，返回正确的注册点位置
	 *
	 * 子类可以重写此方法来处理特殊的 offset 情况
	 *
	 * @returns hover 节点的位置 { x, y }，如果无法计算则返回 null
	 */
	protected getHoverPosition(): { x: number; y: number } | null {
		const rect = this.getLayerRelativeRect()
		if (!rect) return null

		// 默认使用左上角坐标（适用于无 offset 的形状，如矩形、三角形）
		return {
			x: rect.x,
			y: rect.y,
		}
	}

	/**
	 * 创建 hover 效果节点
	 * 子类可以重写此方法来提供自定义的 hover 效果
	 * 默认返回 null，表示使用 HoverManager 的默认矩形边框
	 *
	 * @param stage Konva Stage 实例，用于获取缩放比例等信息
	 * @returns Konva Shape/Group 节点或 null（使用默认效果）
	 */
	public createHoverEffect(stage: Konva.Stage): Konva.Shape | Konva.Group | null {
		// 默认返回 null，使用 HoverManager 的默认矩形边框
		void stage
		return null
	}

	/**
	 * 更新 hover 效果节点（当 viewport 缩放变化或元素变换时）
	 * 子类如果实现了自定义 hover 效果，应该重写此方法
	 *
	 * @param hoverNode hover 效果节点
	 * @param stage Konva Stage 实例
	 */
	public updateHoverEffect(hoverNode: Konva.Shape | Konva.Group, stage: Konva.Stage): void {
		// 默认实现：更新描边宽度以适应缩放
		if (hoverNode instanceof Konva.Shape) {
			hoverNode.strokeWidth(HoverManager.HOVER_STROKE_WIDTH / stage.scaleX())
		} else if (hoverNode instanceof Konva.Group) {
			// 递归更新 Group 中的所有子节点
			hoverNode.children.forEach((child) => {
				if (child instanceof Konva.Shape) {
					child.strokeWidth(HoverManager.HOVER_STROKE_WIDTH / stage.scaleX())
				}
			})
		}
	}

	/**
	 * 获取默认配置（子类实现）
	 */
	static getDefaultConfig(): Record<string, unknown> {
		return {}
	}

	/**
	 * 判断元素是否可以变换（拖拽、缩放、旋转）
	 * 使用 PermissionManager 统一判断
	 */
	protected canElementTransform(): boolean {
		return this.canvas.permissionManager.canTransform(this.data)
	}
}
