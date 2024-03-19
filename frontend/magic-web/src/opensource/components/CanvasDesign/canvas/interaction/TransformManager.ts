import Konva from "konva"
import type { LayerElement } from "../types"
import type { Canvas } from "../Canvas"
import type { Box } from "konva/lib/shapes/Transformer"
import { getKeepRatioAspectRatio, isEdgeAnchor } from "./anchorUtils"

/**
 * Transformer 样式配置常量
 * 用于统一管理单选和多选时 Transformer 的线框和样式
 */
const TRANSFORMER_CONFIG = {
	/** Anchor 尺寸（像素） */
	ANCHOR_SIZE: 8,
	/** 边框描边颜色 */
	BORDER_STROKE: "#3B82F6",
	/** 边框描边宽度（像素） */
	BORDER_STROKE_WIDTH: 1.25,
	/** Anchor 描边颜色 */
	ANCHOR_STROKE: "#3B82F6",
	/** Anchor 填充颜色 */
	ANCHOR_FILL: "#FFFFFF",
	/** Anchor 描边宽度（像素） */
	ANCHOR_STROKE_WIDTH: 1.25,
	/** Anchor 透明度（0-1），用于中间位置的 anchor（top-center, bottom-center, middle-left, middle-right） */
	ANCHOR_OPACITY: 0,
	/** 是否忽略 stroke，避免边框影响边界计算 */
	IGNORE_STROKE: true,
} as const

/**
 * 变换行为类型
 * 定义元素在 Transformer 变换时的行为模式
 */
export type TransformBehavior = "USE_SCALE" | "APPLY_TO_SIZE" | "REALTIME_APPLY_TO_SIZE"

/**
 * 变换行为常量
 */
export const TransformBehavior = {
	/** 使用 scale 属性进行变换（默认行为，适用于 Shape 元素） */
	USE_SCALE: "USE_SCALE" as const,
	/** 在 transformend 时将 scale 应用到 width/height（适用于容器元素，如 Image） */
	APPLY_TO_SIZE: "APPLY_TO_SIZE" as const,
	/** 实时将 scale 应用到 width/height（适用于有子元素的容器，如 Frame） */
	REALTIME_APPLY_TO_SIZE: "REALTIME_APPLY_TO_SIZE" as const,
} as const

/**
 * 变换管理器 - 管理元素的变换（拖拽、缩放）
 * 职责：
 * 1. 管理 Transformer 的创建、显示、隐藏
 * 2. 监听 Transformer 的变换事件，同步数据到 ElementManager
 * 3. 处理元素的拖拽事件
 */
export class TransformManager {
	private canvas: Canvas

	// Transformer 管理
	private transformer: Konva.Transformer | null = null

	// 记录正在被 transform 的元素 ID
	private transformingElementIds: Set<string> = new Set()

	// 记录是否正在拖拽
	private isDragging: boolean = false

	// 记录 Shift 键是否按下（用于临时锁定宽高比）
	private shiftKeyPressed: boolean = false

	// 记录 Meta/Command 键是否按下（用于临时锁定宽高比）
	private metaKeyPressed: boolean = false

	// 记录 transform 开始时的初始宽高比（用于 Shift 或 Command 键锁定）
	private initialAspectRatio: number | null = null

	constructor(options: { canvas: Canvas }) {
		const { canvas } = options
		this.canvas = canvas

		this.setupEventListeners()
	}

	/**
	 * 设置事件监听
	 */
	private setupEventListeners(): void {
		// 监听只读状态变化
		this.canvas.eventEmitter.on("canvas:readonly", () => {
			// 如果切换到只读模式，隐藏 Transformer
			if (this.canvas.readonly) {
				this.hideTransformer()
			}
		})

		// 监听选中事件，显示 Transformer
		this.canvas.eventEmitter.on("element:select", ({ data }) => {
			const { elementIds } = data
			this.showTransformer(elementIds)
		})

		// 监听取消选中事件，隐藏 Transformer
		this.canvas.eventEmitter.on("element:deselect", () => {
			this.hideTransformer()
		})

		// 处理元素变化的共享逻辑
		const handleElementChange = ({ data }: { data: { elementId: string } }) => {
			const { elementId } = data
			// 如果更新的元素正在被 transform，需要更新 Transformer
			if (this.transformingElementIds.has(elementId)) {
				const elementIds = Array.from(this.transformingElementIds)
				this.updateTransformer(elementIds)
			}
		}

		// 监听元素数据更新事件
		this.canvas.eventEmitter.on("element:updated", handleElementChange)

		// 监听元素重新渲染事件
		this.canvas.eventEmitter.on("element:rerendered", handleElementChange)
	}

	/**
	 * 设置 Shift、Meta/Command 键的宽高比锁定状态
	 * @param locked - 是否锁定宽高比（true 表示强制锁定，false 表示恢复元素本身的逻辑）
	 */
	public setKeepRatio(locked: boolean): void {
		this.shiftKeyPressed = locked
		this.updateKeepRatio()
	}

	/**
	 * 获取 transform 开始时的初始宽高比（用于 keep ratio 场景）
	 */
	public getInitialAspectRatio(): number | null {
		return this.initialAspectRatio
	}

	/**
	 * 检查 Shift 键是否按下
	 * @returns Shift 键是否按下
	 */
	public isShiftPressed(): boolean {
		return this.shiftKeyPressed
	}

	/**
	 * 检查是否应该保持宽高比
	 * @param elementIds - 元素ID数组，如果不提供则使用当前正在变换的元素
	 * @returns 是否应该保持宽高比
	 */
	public shouldKeepRatio(elementIds?: string[]): boolean {
		// 如果 Shift 或 Meta/Command 键按下，强制锁定宽高比
		if (this.shiftKeyPressed || this.metaKeyPressed) {
			return true
		}

		// 否则，根据元素来决定是否锁定
		const ids = elementIds ?? Array.from(this.transformingElementIds)
		return ids.some((id) => {
			const element = this.canvas.elementManager.getElementInstance(id)
			return element?.shouldKeepRatio() ?? false
		})
	}

	/**
	 * 检查单个元素是否应该保持宽高比（供其他 Manager 使用）
	 * @param element - 元素实例
	 * @returns 是否应该保持宽高比
	 */
	public shouldKeepRatioForElement(
		element: ReturnType<Canvas["elementManager"]["getElementInstance"]>,
	): boolean {
		// 如果 Shift 或 Meta/Command 键按下，强制锁定宽高比
		if (this.shiftKeyPressed || this.metaKeyPressed) {
			return true
		}

		// 否则，根据元素本身的配置决定
		return element?.shouldKeepRatio() ?? false
	}

	/**
	 * 根据当前状态更新 Transformer 的宽高比锁定
	 * 如果 Shift 或 Meta/Command 键按下，强制锁定；否则使用元素本身的 shouldKeepRatio() 逻辑
	 */
	private updateKeepRatio(): void {
		if (!this.transformer) return
		this.transformer.keepRatio(this.shouldKeepRatio())
	}

	/**
	 * 将 Transformer 绑定节点的状态同步到 ElementManager
	 */
	private syncTransformerNodesToElements(options: {
		isRealtime: boolean
		isScaling: boolean
	}): void {
		const { isRealtime, isScaling } = options
		const transformerNodes = this.transformer?.nodes() || []

		transformerNodes.forEach((node) => {
			const elementId = node.id()
			const element = this.canvas.elementManager.getElementInstance(elementId)

			if (!elementId || !element) return

			const rawUpdates: Partial<LayerElement> = {
				x: node.x(),
				y: node.y(),
				width: node instanceof Konva.Group ? node.width() : undefined,
				height: node instanceof Konva.Group ? node.height() : undefined,
				scaleX: node.scaleX(),
				scaleY: node.scaleY(),
			}

			const appliedUpdates = element.applyTransform(rawUpdates, {
				isRealtime,
				isScaling,
				shouldKeepRatio: this.shouldKeepRatio([elementId]),
				initialAspectRatio: this.initialAspectRatio ?? undefined,
			})

			this.canvas.elementManager.update(elementId, appliedUpdates, {
				mode: "node-only",
				forceRerender: false,
			})

			if (appliedUpdates.width !== undefined || appliedUpdates.height !== undefined) {
				this.transformer?.forceUpdate()
			}

			this.canvas.elementManager.update(elementId, appliedUpdates, {
				mode: "data-only",
				silent: true,
			})
		})
	}

	/**
	 * Transformer dragstart 事件处理：拖动 Transformer 移动选区时触发
	 */
	private handleTransformerDragstart(): void {
		if (this.canvas.readonly) return

		this.isDragging = true
		const elementIds = Array.from(this.transformingElementIds)

		elementIds.forEach((elementId) => {
			this.canvas.eventEmitter.emit({
				type: "element:dragstart",
				data: { elementId },
			})
		})

		this.canvas.eventEmitter.emit({
			type: "elements:transform:dragstart",
			data: { elementIds },
		})

		if (this.transformer) {
			this.transformer.hide()
			this.canvas.controlsLayer.batchDraw()
		}
	}

	/**
	 * Transformer dragmove 事件处理：拖动 Transformer 移动选区过程中持续触发
	 */
	private handleTransformerDragmove(): void {
		if (this.canvas.readonly) return

		const elementIds = Array.from(this.transformingElementIds)
		this.syncTransformerNodesToElements({ isRealtime: true, isScaling: false })

		this.canvas.eventEmitter.emit({
			type: "elements:transform:dragmove",
			data: { elementIds },
		})

		elementIds.forEach((elementId) => {
			this.canvas.eventEmitter.emit({
				type: "element:dragmove",
				data: { elementId },
			})
		})
	}

	/**
	 * Transformer dragend 事件处理：拖动 Transformer 移动选区结束时触发
	 */
	private handleTransformerDragend(): void {
		if (this.canvas.readonly) return

		const historyManager = this.canvas.historyManager
		historyManager?.disable()

		try {
			const elementIds = Array.from(this.transformingElementIds)

			this.syncTransformerNodesToElements({ isRealtime: false, isScaling: false })

			this.canvas.eventEmitter.emit({
				type: "elements:transform:dragend",
				data: { elementIds },
			})

			elementIds.forEach((elementId) => {
				this.canvas.eventEmitter.emit({
					type: "element:dragend",
					data: { elementId },
				})
			})

			if (historyManager) {
				historyManager.enable()
				historyManager.recordHistoryImmediate()
			}

			this.canvas.eventEmitter.emit({ type: "element:change", data: undefined })

			this.isDragging = false
			this.initialAspectRatio = null

			if (this.transformer && !this.transformer.visible()) {
				this.transformer.show()
				this.transformer.forceUpdate()
				this.canvas.controlsLayer.batchDraw()
			}
		} finally {
			this.canvas.historyManager?.enable()
		}
	}

	/**
	 * Transformer transformstart 事件处理：拖动 Anchor 缩放时触发（在 transform 之前）
	 */
	private handleTransformerTransformstart(): void {
		if (this.canvas.readonly) return

		const transformerNodes = this.transformer?.nodes() || []
		if (transformerNodes.length > 0) {
			const firstNode = transformerNodes[0]
			if (firstNode instanceof Konva.Group) {
				const width = firstNode.width() * firstNode.scaleX()
				const height = firstNode.height() * firstNode.scaleY()
				this.initialAspectRatio = width / height
			}
		}

		const elementIds = Array.from(this.transformingElementIds)
		const activeAnchor = this.transformer?.getActiveAnchor()
		if (activeAnchor) {
			this.canvas.eventEmitter.emit({
				type: "elements:transform:anchorDragStart",
				data: { elementIds, activeAnchor },
			})
		}
	}

	/**
	 * Transformer transform 事件处理：拖动 Anchor 缩放过程中持续触发
	 */
	private handleTransformerTransform(): void {
		if (this.canvas.readonly) return

		const activeAnchor = this.transformer?.getActiveAnchor()
		const elementIds = Array.from(this.transformingElementIds)

		this.syncTransformerNodesToElements({ isRealtime: true, isScaling: true })

		if (activeAnchor) {
			this.canvas.eventEmitter.emit({
				type: "elements:transform:anchorDragmove",
				data: { elementIds, activeAnchor },
			})
		}
	}

	/**
	 * Transformer transformend 事件处理：拖动 Anchor 缩放结束时触发
	 */
	private handleTransformerTransformend(): void {
		if (this.canvas.readonly) return

		const historyManager = this.canvas.historyManager
		historyManager?.disable()

		try {
			const elementIds = Array.from(this.transformingElementIds)
			const activeAnchor = this.transformer?.getActiveAnchor()

			this.syncTransformerNodesToElements({ isRealtime: false, isScaling: false })

			if (activeAnchor) {
				this.canvas.eventEmitter.emit({
					type: "elements:transform:anchorDragend",
					data: { elementIds, activeAnchor },
				})
			}

			if (historyManager) {
				historyManager.enable()
				historyManager.recordHistoryImmediate()
			}

			this.canvas.eventEmitter.emit({ type: "element:change", data: undefined })

			this.initialAspectRatio = null
		} finally {
			this.canvas.historyManager?.enable()
		}
	}

	/**
	 * 显示 Transformer
	 * @param elementIds - 选中的元素ID数组
	 */
	public showTransformer(elementIds: string[]): void {
		// 清除旧的 Transformer
		this.hideTransformer()

		if (elementIds.length === 0) return

		// 使用 PermissionManager 过滤可以变换的元素
		const transformableElementIds = elementIds.filter((id) => {
			const elementData = this.canvas.elementManager.getElementData(id)
			return this.canvas.permissionManager.canTransform(elementData)
		})

		// 如果所有元素都不可变换，不显示 Transformer
		if (transformableElementIds.length === 0) return

		// 使用 NodeAdapter 获取节点，并过滤掉宽高为0的节点
		const adapter = this.canvas.elementManager.getNodeAdapter()
		const nodes = adapter
			.getNodesForTransform(transformableElementIds)
			.filter((node): node is Konva.Node => {
				if (!node) return false
				const elementData = this.canvas.elementManager.getElementData(node.id())
				// 过滤掉宽高都为0的节点
				if (elementData && elementData.width === 0 && elementData.height === 0) {
					return false
				}
				return true
			})

		if (nodes.length === 0) return

		// 创建新的 Transformer
		const anchorSize = TRANSFORMER_CONFIG.ANCHOR_SIZE
		let enabledAnchors: string[] = []
		if (!this.canvas.readonly) {
			enabledAnchors = [
				"top-left",
				"top-right",
				"bottom-left",
				"bottom-right",
				"top-center",
				"bottom-center",
				"middle-left",
				"middle-right",
			]
		}
		// 限制最小尺寸并防止翻转
		const boundBoxFunc = (oldBox: Box, newBox: Box): Box => {
			// 使用 PermissionManager 统一判断：只读模式下禁止变换
			if (this.canvas.readonly) {
				return oldBox
			}
			// 防止翻转：确保宽度和高度始终为正数
			if (newBox.width < 0 || newBox.height < 0) {
				return oldBox
			}
			let resultBox: Box = newBox
			const activeAnchor = this.transformer?.getActiveAnchor()

			// 动态检查当前是否需要保持宽高比（支持运行时按下 Shift 键）
			const currentShouldKeepRatio = this.shouldKeepRatio(transformableElementIds)
			if (
				currentShouldKeepRatio &&
				this.transformer &&
				activeAnchor &&
				isEdgeAnchor(activeAnchor)
			) {
				const ratio = getKeepRatioAspectRatio(this.initialAspectRatio, oldBox)
				if (activeAnchor === "middle-left") {
					const newHeight = resultBox.width / ratio
					const heightDiff = newHeight - oldBox.height
					resultBox = {
						...resultBox,
						height: newHeight,
						y: resultBox.y - heightDiff,
					}
				} else if (activeAnchor === "middle-right") {
					const newHeight = resultBox.width / ratio
					resultBox = { ...resultBox, height: newHeight }
				} else if (activeAnchor === "top-center") {
					const newWidth = resultBox.height * ratio
					const widthDiff = newWidth - oldBox.width
					resultBox = {
						...resultBox,
						width: newWidth,
						x: resultBox.x - widthDiff,
					}
				} else if (activeAnchor === "bottom-center") {
					const newWidth = resultBox.height * ratio
					resultBox = { ...resultBox, width: newWidth }
				}
			}

			// 仅多选时通过 boundBoxFunc 注入吸附（单选用 processSnap 的 applySnapOffset，坐标系一致）
			const selectedIds = this.canvas.selectionManager.getSelectedIds()
			if (activeAnchor && selectedIds.length > 1) {
				const aspectRatio = getKeepRatioAspectRatio(this.initialAspectRatio, oldBox)
				resultBox = this.canvas.snapGuideManager.getSnappedBox(
					oldBox,
					resultBox,
					activeAnchor,
					{
						keepRatio: currentShouldKeepRatio && !!activeAnchor,
						aspectRatio,
					},
				)
			}
			return resultBox
		}

		// 自定义 anchor 形状：中间位置的 anchor 显示为长方形
		const anchorStyleFunc = (anchor: Konva.Rect) => {
			const name = anchor.name()
			const parent = anchor.getParent()
			const parentSize = parent?.getSize()
			const horizontal = name.startsWith("top-center") || name.startsWith("bottom-center")
			const vertical = name.startsWith("middle-left") || name.startsWith("middle-right")
			if (!horizontal && !vertical) return
			const size =
				((horizontal ? parentSize?.width : parentSize?.height) || 0) - anchorSize * 2
			switch (name) {
				case "top-center _anchor":
					if (parentSize) {
						anchor.width(size)
						anchor.position({
							x: (parentSize.width - size) / 2 + anchorSize / 2,
							y: 0,
						})
					} else {
						anchor.width(anchorSize * 2)
					}
					anchor.height(anchorSize)
					break
				case "bottom-center _anchor":
					if (parentSize) {
						anchor.width(size)
						anchor.position({
							x: (parentSize.width - size) / 2 + anchorSize / 2,
							y: parentSize.height,
						})
					} else {
						anchor.width(anchorSize * 2)
					}
					anchor.height(anchorSize)
					break
				case "middle-left _anchor":
					if (parentSize) {
						anchor.height(size)
						anchor.position({
							x: 0,
							y: (parentSize.height - size) / 2 + anchorSize / 2,
						})
					} else {
						anchor.height(anchorSize * 2)
					}
					anchor.width(anchorSize)
					break
				case "middle-right _anchor":
					if (parentSize) {
						anchor.height(size)
						anchor.position({
							x: parentSize.width,
							y: (parentSize.height - size) / 2 + anchorSize / 2,
						})
					} else {
						anchor.height(anchorSize * 2)
					}
					anchor.width(anchorSize)
					break
				default:
					break
			}
			anchor.opacity(TRANSFORMER_CONFIG.ANCHOR_OPACITY)
		}

		this.transformer = new Konva.Transformer({
			canvas: this.canvas,
			nodes: nodes,
			keepRatio: this.shouldKeepRatio(transformableElementIds), // 根据元素需求设置是否锁定宽高比
			enabledAnchors,
			anchorSize,
			rotateEnabled: false,
			borderStroke: TRANSFORMER_CONFIG.BORDER_STROKE,
			borderStrokeWidth: TRANSFORMER_CONFIG.BORDER_STROKE_WIDTH,
			anchorStroke: TRANSFORMER_CONFIG.ANCHOR_STROKE,
			anchorFill: TRANSFORMER_CONFIG.ANCHOR_FILL,
			anchorStrokeWidth: TRANSFORMER_CONFIG.ANCHOR_STROKE_WIDTH,
			ignoreStroke: TRANSFORMER_CONFIG.IGNORE_STROKE, // 忽略 stroke，避免边框影响边界计算
			boundBoxFunc,
			anchorStyleFunc,
		})

		this.transformer.on("dragstart", () => this.handleTransformerDragstart())
		this.transformer.on("dragmove", () => this.handleTransformerDragmove())
		this.transformer.on("dragend", () => this.handleTransformerDragend())
		this.transformer.on("transformstart", () => this.handleTransformerTransformstart())
		this.transformer.on("transform", () => this.handleTransformerTransform())
		this.transformer.on("transformend", () => this.handleTransformerTransformend())

		// 添加到图层
		this.canvas.controlsLayer.add(this.transformer)
		this.transformer.moveToTop()
		this.canvas.controlsLayer.batchDraw()

		// 更新正在 transform 的元素集合（只包含可变换的元素）
		this.transformingElementIds.clear()
		transformableElementIds.forEach((id) => this.transformingElementIds.add(id))
	}

	/**
	 * 隐藏 Transformer
	 */
	public hideTransformer(): void {
		if (this.transformer) {
			// 移除事件监听
			this.transformer.off("dragstart")
			this.transformer.off("dragmove")
			this.transformer.off("dragend")
			this.transformer.off("transformstart")
			this.transformer.off("transform")
			this.transformer.off("transformend")
			// 销毁 Transformer
			this.transformer.destroy()
			this.transformer = null
			this.canvas.controlsLayer.batchDraw()
		}

		// 清空正在 transform 的元素集合
		this.transformingElementIds.clear()
		// 清除初始宽高比记录
		this.initialAspectRatio = null
	}

	/**
	 * 更新 Transformer（当选中的元素发生变化时）
	 * @param elementIds - 选中的元素ID数组
	 */
	public updateTransformer(elementIds: string[]): void {
		if (!this.transformer || elementIds.length === 0) {
			this.hideTransformer()
			return
		}
		// 使用 NodeAdapter 获取选中的节点
		const adapter = this.canvas.elementManager.getNodeAdapter()
		const nodes = adapter.getNodesForTransform(elementIds)

		if (nodes.length === 0) {
			this.hideTransformer()
			return
		}

		// 更新 Transformer 的节点和 keepRatio
		this.transformer.nodes(nodes)
		this.transformer.keepRatio(this.shouldKeepRatio(elementIds))
		this.transformer.forceUpdate()
		this.canvas.controlsLayer.batchDraw()

		// 更新正在 transform 的元素集合
		this.transformingElementIds.clear()
		elementIds.forEach((id) => this.transformingElementIds.add(id))
	}

	/**
	 * 检查元素是否正在被 transform
	 */
	public isTransforming(elementId: string): boolean {
		return this.transformingElementIds.has(elementId)
	}

	/**
	 * 检查是否正在拖拽元素
	 */
	public isDraggingElement(): boolean {
		return this.isDragging
	}

	/**
	 * 销毁管理器
	 */
	public destroy(): void {
		this.hideTransformer()
		// 移除事件监听器
		this.canvas.eventEmitter.off("element:select")
		this.canvas.eventEmitter.off("element:deselect")
		this.canvas.eventEmitter.off("element:updated")
	}
}
