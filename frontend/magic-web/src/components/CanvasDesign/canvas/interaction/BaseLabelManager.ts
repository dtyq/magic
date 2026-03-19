import Konva from "konva"
import { ElementTypeEnum, type LayerElement } from "../types"
import type { Canvas } from "../Canvas"

/**
 * 标签配置
 */
export interface LabelConfig {
	/** 字体大小（像素） */
	fontSize: number
	/** 文本颜色 */
	textColor: string
	/** 字体族 */
	fontFamily: string
	/** 标签距离元素的距离（像素） */
	offsetTop: number
	/** 标签左侧对齐偏移（像素） */
	offsetLeft: number
}

/**
 * 标签可见性配置
 */
export interface LabelVisibilityConfig {
	/** 哪些元素类型需要显示标签 */
	elementTypes: Set<string>
	/** 哪些元素类型一直显示（如 Frame） */
	alwaysVisibleTypes: Set<string>
	/** 哪些元素类型在选中或 hover 时显示（如 Image） */
	hoverOrSelectTypes: Set<string>
}

/**
 * 基础标签管理器配置
 */
export interface BaseLabelManagerConfig {
	/** 画布实例 */
	canvas: Canvas
	/** 标签样式配置 */
	labelConfig: LabelConfig
	/** 标签可见性配置 */
	visibilityConfig: LabelVisibilityConfig
}

/**
 * 基础标签管理器抽象类
 * 职责：
 * 1. 在独立的 Layer 上渲染元素的标签
 * 2. 监听元素变化，同步更新标签
 * 3. 管理标签的可见性
 * 4. 处理标签的位置和缩放
 */
export abstract class BaseLabelManager {
	protected canvas: Canvas
	protected labelConfig: LabelConfig
	protected visibilityConfig: LabelVisibilityConfig

	// 存储每个元素的标签
	protected labelMap: Map<string, Konva.Group> = new Map()

	// 追踪上一次 hover 的元素 ID
	protected lastHoveredElementId: string | null = null

	// 静态注册表，用于不同 LabelManager 之间的协调
	protected static labelManagers: BaseLabelManager[] = []

	constructor(options: BaseLabelManagerConfig) {
		const { canvas } = options
		this.canvas = canvas
		this.labelConfig = options.labelConfig
		this.visibilityConfig = options.visibilityConfig

		// 注册到静态列表
		BaseLabelManager.labelManagers.push(this)

		this.setupEventListeners()
	}

	/**
	 * 获取标签文本（由子类实现）
	 */
	protected abstract getLabelText(elementId: string): string

	/**
	 * 计算标签位置（由子类实现，返回相对于元素边界矩形的偏移）
	 */
	protected abstract calculateLabelPosition(
		boundingRect: { x: number; y: number; width: number; height: number },
		labelSize: { width: number; height: number },
		inverseScale: number,
	): { x: number; y: number }

	/**
	 * 设置事件监听器
	 */
	private setupEventListeners(): void {
		// 监听元素创建
		this.canvas.eventEmitter.on("element:created", (event) => {
			this.createOrUpdateLabel(event.data.elementId)
		})

		// 监听元素删除
		this.canvas.eventEmitter.on("element:deleted", (event) => {
			this.removeLabel(event.data.elementId)
		})

		// 处理拖拽移动事件
		const handleDragMove = (elementId: string) => {
			this.updateLabelPosition(elementId)
			const element = this.canvas.elementManager.getElementData(elementId)
			if (
				element?.type === ElementTypeEnum.Frame &&
				"children" in element &&
				element.children
			) {
				this.updateLabelsForFrameChildren(element.children)
			}
		}

		// 监听拖拽移动事件
		this.canvas.eventEmitter.on("elements:transform:dragmove", ({ data }) => {
			data.elementIds.forEach((elementId) => handleDragMove(elementId))
		})

		// 监听缩放移动事件
		this.canvas.eventEmitter.on("elements:transform:anchorDragmove", ({ data }) => {
			data.elementIds.forEach((elementId) => handleDragMove(elementId))
		})

		// 监听元素数据更新（属性变化，如名称变化或 zIndex 变化）
		this.canvas.eventEmitter.on("element:updated", (event) => {
			this.createOrUpdateLabel(event.data.elementId)
			// zIndex 可能已改变，需要重新排序所有标签
			this.reorderAllLabels()
		})

		// 监听元素重新渲染（位置、尺寸变化等）
		this.canvas.eventEmitter.on("element:rerendered", (event) => {
			this.createOrUpdateLabel(event.data.elementId)
			// zIndex 可能已改变，需要重新排序所有标签
			this.reorderAllLabels()
		})

		// 监听选择变化
		this.canvas.eventEmitter.on("element:select", () => {
			this.updateAllLabelsVisibility()
		})

		this.canvas.eventEmitter.on("element:deselect", () => {
			this.updateAllLabelsVisibility()
		})

		// 监听 hover 变化
		this.canvas.eventEmitter.on("element:hover", (event) => {
			const newHoveredId = event.data.elementId

			// 如果有之前 hover 的元素，更新其可见性
			if (this.lastHoveredElementId) {
				this.updateLabelVisibility(this.lastHoveredElementId)
			}

			// 如果有新 hover 的元素，更新其可见性
			if (newHoveredId) {
				this.updateLabelVisibility(newHoveredId)
			}

			// 更新追踪的 hover 元素
			this.lastHoveredElementId = newHoveredId
		})

		// 监听 viewport 缩放变化（pan 不需要：overlayLayer 随 stage 平移，标签相对关系不变）
		// ViewportController 已做 RAF 节流，此处直接更新以减少一帧延迟
		this.canvas.eventEmitter.on("viewport:scale", () => {
			this.updateAllLabels()
		})

		// 监听文档恢复事件（撤销/恢复时触发）
		this.canvas.eventEmitter.on("document:restored", () => {
			// 先为所有需要显示标签的元素创建或更新标签
			// 因为恢复时，之前被删除的元素的标签可能已经被移除
			const allElements = this.canvas.elementManager.getAllElements()
			for (const elementData of allElements) {
				if (this.shouldShowLabel(elementData.id)) {
					this.createOrUpdateLabel(elementData.id)
				}
			}
			// 更新所有标签的位置和可见性
			this.updateAllLabels()
			// 重新排序所有标签（zIndex 可能已改变）
			this.reorderAllLabels()
		})
	}

	/**
	 * 创建或更新标签
	 */
	protected createOrUpdateLabel(elementId: string): void {
		const element = this.canvas.elementManager.getElementInstance(elementId)
		if (!element) {
			this.removeLabel(elementId)
			return
		}

		// 检查元素是否需要显示标签
		if (!this.shouldShowLabel(elementId)) {
			this.removeLabel(elementId)
			return
		}

		const node = element.getNode()
		if (!node) {
			this.removeLabel(elementId)
			return
		}

		// 获取或创建标签
		let labelGroup = this.labelMap.get(elementId)
		if (!labelGroup) {
			labelGroup = this.createLabel(elementId)
			this.labelMap.set(elementId, labelGroup)
			this.canvas.overlayLayer.add(labelGroup)
			// 新创建的标签需要设置正确的层级顺序
			this.reorderAllLabels()
		}

		// 更新标签内容
		this.updateLabelText(labelGroup, this.getLabelText(elementId))

		// 更新标签位置（内部会调用 updateLabelVisibility）
		this.updateLabelPosition(elementId)

		// 通知其他 LabelManager 也更新该元素的可见性（单个更新，需要立即 batchDraw）
		this.notifyOtherManagersUpdateVisibility(elementId)
	}

	/**
	 * 创建标签节点
	 */
	protected createLabel(elementId: string): Konva.Group {
		const labelText = this.getLabelText(elementId)

		// 创建标签容器 Group
		const labelGroup = new Konva.Group({
			listening: false,
			visible: false, // 默认隐藏
			name: `label-${elementId}`,
		})

		// 创建文本节点
		const textNode = new Konva.Text({
			text: labelText,
			fontSize: this.labelConfig.fontSize,
			fontFamily: this.labelConfig.fontFamily,
			fill: this.labelConfig.textColor,
			listening: false,
		})

		labelGroup.add(textNode)

		return labelGroup
	}

	/**
	 * 更新标签文本
	 */
	protected updateLabelText(labelGroup: Konva.Group, text: string): void {
		const textNode = labelGroup.findOne("Text") as Konva.Text
		if (textNode) {
			textNode.text(text)
		}
	}

	/**
	 * 递归更新 Frame 子元素的标签位置
	 * @param children - 子元素列表
	 * @param skipBatchDraw - 是否跳过 batchDraw（用于递归调用时统一在最外层调用）
	 */
	protected updateLabelsForFrameChildren(children: LayerElement[], skipBatchDraw = false): void {
		children.forEach((child) => {
			// 更新当前子元素的标签位置（批量更新模式）
			this.updateLabelPosition(child.id, true)

			// 如果子元素也是 Frame 或 Group，递归更新其子元素（递归时跳过 batchDraw）
			if ("children" in child && child.children && child.children.length > 0) {
				this.updateLabelsForFrameChildren(child.children, true)
			}
		})
		// 只在最外层调用时执行 batchDraw
		if (!skipBatchDraw) {
			this.canvas.overlayLayer.batchDraw()
		}
	}

	/**
	 * 更新标签位置
	 * @param elementId - 元素 ID
	 * @param skipBatchDraw - 是否跳过 batchDraw（用于批量更新时统一调用）
	 */
	protected updateLabelPosition(elementId: string, skipBatchDraw = false): void {
		const labelGroup = this.labelMap.get(elementId)
		if (!labelGroup) {
			return
		}

		const element = this.canvas.elementManager.getElementInstance(elementId)
		if (!element) {
			return
		}

		// 更新标签文本（因为 transform 时文本内容可能变化，如尺寸标签）
		const newLabelText = this.getLabelText(elementId)
		this.updateLabelText(labelGroup, newLabelText)

		// 使用元素的 getBoundingRect 方法获取边界矩形
		const boundingRect = element.getBoundingRect()
		if (!boundingRect) {
			return
		}

		// 获取 viewport 缩放
		const viewportScale = this.canvas.stage.scaleX()

		// 计算反向缩放（使标签不受 viewport 缩放影响）
		const inverseScale = 1 / viewportScale

		// 应用反向缩放
		labelGroup.scale({ x: inverseScale, y: inverseScale })

		// 获取文本节点以计算标签尺寸
		const textNode = labelGroup.findOne("Text") as Konva.Text
		if (!textNode) {
			return
		}

		const labelSize = {
			width: textNode.width(),
			height: textNode.height(),
		}

		// 调用子类实现的位置计算方法
		const position = this.calculateLabelPosition(boundingRect, labelSize, inverseScale)

		labelGroup.position(position)

		// 位置更新后，立即更新可见性（因为位置变化可能影响可见性判断）
		this.updateLabelVisibility(elementId, skipBatchDraw)
	}

	/**
	 * 更新标签可见性
	 * @param elementId - 元素 ID
	 * @param skipBatchDraw - 是否跳过 batchDraw（用于批量更新时统一调用）
	 */
	protected updateLabelVisibility(elementId: string, skipBatchDraw = false): void {
		const labelGroup = this.labelMap.get(elementId)
		if (!labelGroup) {
			return
		}

		const element = this.canvas.elementManager.getElementInstance(elementId)
		if (!element) {
			labelGroup.visible(false)
			if (!skipBatchDraw) {
				this.canvas.overlayLayer.batchDraw()
			}
			return
		}

		const elementData = element.getData()
		const elementType = elementData.type

		let shouldShow = false

		// 检查是否为一直显示的类型
		if (this.visibilityConfig.alwaysVisibleTypes.has(elementType)) {
			shouldShow = true
		}
		// 检查是否为选中或 hover 时显示的类型
		else if (this.visibilityConfig.hoverOrSelectTypes.has(elementType)) {
			const isSelected = this.canvas.selectionManager.isSelected(elementId)
			const hoveredId = this.canvas.hoverManager.getHoveredElementId()
			const isHovered = hoveredId === elementId
			shouldShow = isHovered || isSelected
		}

		labelGroup.visible(shouldShow)

		// 触发重绘（批量更新时跳过，由调用方统一调用）
		if (!skipBatchDraw) {
			this.canvas.overlayLayer.batchDraw()
		}
	}

	/**
	 * 获取其他 LabelManager 的标签位置信息
	 */
	protected getOtherLabelBounds(
		elementId: string,
		excludeManager: BaseLabelManager,
	): Array<{ x: number; y: number; width: number; height: number }> {
		const bounds: Array<{ x: number; y: number; width: number; height: number }> = []

		for (const manager of BaseLabelManager.labelManagers) {
			if (manager === excludeManager) continue

			const labelGroup = manager.labelMap.get(elementId)
			if (labelGroup && labelGroup.visible()) {
				const textNode = labelGroup.findOne("Text") as Konva.Text
				if (textNode) {
					const scaleX = labelGroup.scaleX()
					const scaleY = labelGroup.scaleY()
					bounds.push({
						x: labelGroup.x(),
						y: labelGroup.y(),
						width: textNode.width() * scaleX,
						height: textNode.height() * scaleY,
					})
				}
			}
		}

		return bounds
	}

	/**
	 * 检测两个矩形是否重叠
	 */
	protected checkRectOverlap(
		rect1: { x: number; y: number; width: number; height: number },
		rect2: { x: number; y: number; width: number; height: number },
		padding: number = 2,
	): boolean {
		return (
			rect1.x < rect2.x + rect2.width + padding &&
			rect1.x + rect1.width + padding > rect2.x &&
			rect1.y < rect2.y + rect2.height + padding &&
			rect1.y + rect1.height + padding > rect2.y
		)
	}

	/**
	 * 检测标签是否超出元素宽度
	 */
	protected checkLabelExceedsElementWidth(
		labelBounds: { x: number; width: number },
		elementBounds: { x: number; width: number },
	): boolean {
		const labelRight = labelBounds.x + labelBounds.width
		const elementRight = elementBounds.x + elementBounds.width
		return labelRight > elementRight
	}

	/**
	 * 检查其他 LabelManager 的标签是否因为超出元素宽度而隐藏
	 */
	protected checkOtherLabelHiddenDueToWidth(
		elementId: string,
		excludeManager: BaseLabelManager,
		elementBounds: { x: number; width: number },
	): boolean {
		for (const manager of BaseLabelManager.labelManagers) {
			if (manager === excludeManager) continue

			const labelGroup = manager.labelMap.get(elementId)
			// 如果标签存在但不可见
			if (labelGroup && !labelGroup.visible()) {
				const textNode = labelGroup.findOne("Text") as Konva.Text
				if (textNode) {
					const scaleX = labelGroup.scaleX()
					const labelWidth = textNode.width() * scaleX
					const labelX = labelGroup.x()

					// 检查标签是否会超出元素宽度
					if (
						manager.checkLabelExceedsElementWidth(
							{ x: labelX, width: labelWidth },
							elementBounds,
						)
					) {
						return true
					}
				}
			}
		}
		return false
	}

	/**
	 * 更新所有标签的可见性
	 */
	protected updateAllLabelsVisibility(): void {
		for (const elementId of this.labelMap.keys()) {
			this.updateLabelVisibility(elementId, true)
		}
		// 批量更新后统一调用一次 batchDraw
		this.canvas.overlayLayer.batchDraw()
	}

	/**
	 * 更新所有标签（位置和可见性）
	 * updateLabelPosition 内部已调用 updateLabelVisibility，无需二次遍历
	 */
	protected updateAllLabels(): void {
		for (const elementId of this.labelMap.keys()) {
			this.updateLabelPosition(elementId, true)
		}

		// 通知其他 LabelManager 同步可见性（如 SizeLabel 需根据 NameLabel 重叠情况决定显隐）
		// 批量更新模式，跳过 batchDraw，由最后统一调用
		for (const elementId of this.labelMap.keys()) {
			this.notifyOtherManagersUpdateVisibility(elementId, true)
		}

		// 批量更新后统一调用一次 batchDraw
		this.canvas.overlayLayer.batchDraw()
	}

	/**
	 * 通知其他 LabelManager 更新指定元素的可见性
	 * @param elementId - 元素 ID
	 * @param skipBatchDraw - 是否跳过 batchDraw（用于批量更新时统一调用）
	 */
	private notifyOtherManagersUpdateVisibility(elementId: string, skipBatchDraw = false): void {
		for (const manager of BaseLabelManager.labelManagers) {
			if (manager !== this && manager.labelMap.has(elementId)) {
				manager.updateLabelVisibility(elementId, skipBatchDraw)
			}
		}
	}

	/**
	 * 移除标签
	 */
	protected removeLabel(elementId: string): void {
		const labelGroup = this.labelMap.get(elementId)
		if (labelGroup) {
			labelGroup.destroy()
			this.labelMap.delete(elementId)
		}
	}

	/**
	 * 判断元素是否需要显示标签
	 */
	protected shouldShowLabel(elementId: string): boolean {
		const element = this.canvas.elementManager.getElementInstance(elementId)
		if (!element) {
			return false
		}

		const elementType = element.getData().type

		// 检查元素类型是否在配置的类型集合中
		return this.visibilityConfig.elementTypes.has(elementType)
	}

	/**
	 * 重新排列所有标签的层级顺序
	 * 根据元素的 zIndex 来调整标签在 labelLayer 中的顺序
	 */
	protected reorderAllLabels(): void {
		// 获取所有有标签的元素，并按 zIndex 升序排序（zIndex 小的在底层）
		const elementIdsWithLabels = Array.from(this.labelMap.keys())
		const sortedElementIds = elementIdsWithLabels
			.map((id) => {
				const element = this.canvas.elementManager.getElementInstance(id)
				return {
					id,
					zIndex: element?.getData().zIndex ?? 0,
				}
			})
			.sort((a, b) => a.zIndex - b.zIndex)
			.map((item) => item.id)

		// 按照排序后的顺序，依次将标签移到顶部
		// 这样最终的顺序就是 zIndex 从小到大
		for (const elementId of sortedElementIds) {
			const labelGroup = this.labelMap.get(elementId)
			if (labelGroup) {
				labelGroup.moveToTop()
			}
		}

		this.canvas.overlayLayer.batchDraw()
	}

	/**
	 * 初始化所有现有元素的标签
	 */
	public initializeAllLabels(): void {
		const allElements = this.canvas.elementManager.getAllElements()
		for (const elementData of allElements) {
			this.createOrUpdateLabel(elementData.id)
		}
		// 初始化完成后，确保标签层级顺序正确
		this.reorderAllLabels()
	}

	/**
	 * 销毁管理器
	 */
	public destroy(): void {
		// 从静态列表中移除
		const index = BaseLabelManager.labelManagers.indexOf(this)
		if (index > -1) {
			BaseLabelManager.labelManagers.splice(index, 1)
		}

		// 清理所有标签
		for (const labelGroup of this.labelMap.values()) {
			labelGroup.destroy()
		}
		this.labelMap.clear()

		// 清理追踪的 hover 元素
		this.lastHoveredElementId = null

		// 销毁标签层
		this.canvas.overlayLayer.destroy()

		// 移除所有事件监听器
		this.canvas.eventEmitter.off("element:created")
		this.canvas.eventEmitter.off("element:deleted")
		this.canvas.eventEmitter.off("elements:transform:dragmove")
		this.canvas.eventEmitter.off("elements:transform:anchorDragmove")
		this.canvas.eventEmitter.off("element:updated")
		this.canvas.eventEmitter.off("element:select")
		this.canvas.eventEmitter.off("element:deselect")
		this.canvas.eventEmitter.off("element:hover")
		this.canvas.eventEmitter.off("viewport:scale")
	}
}
