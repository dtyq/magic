import Konva from "konva"
import type { LayerElement } from "../types"
import type { Canvas } from "../Canvas"
import type { Box } from "konva/lib/shapes/Transformer"
import { getKeepRatioAspectRatio, isEdgeAnchor, applyAspectRatioToBoundBox } from "./anchorUtils"
import { STANDARD_TRANSFORMER_STYLE } from "./FrameEditorShared"
import type { Rect } from "../utils/utils"
import { pickSelectedElementIdAtStagePointer } from "./elementNodeUtils"
import { isMultiSelectEvent } from "./shortcuts/modifierUtils"

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
	private multiSelectionProxy: Konva.Rect | null = null

	// 记录正在被 transform 的元素 ID
	private transformingElementIds: Set<string> = new Set()

	// 记录是否正在拖拽
	private isDragging: boolean = false

	// 记录 transform 开始时的初始宽高比（用于 Shift 或 Command 键锁定）
	private initialAspectRatio: number | null = null

	// 记录 transform 开始时每个元素各自的初始宽高比（用于多选保持各自比例）
	private initialElementAspectRatios: Map<string, number> = new Map()
	private proxyInitialBounds: Rect | null = null
	private proxyInitialNodeStates: Map<
		string,
		{
			x: number
			y: number
			scaleX: number
			scaleY: number
			width?: number
			height?: number
		}
	> = new Map()
	private isProxyInteractionActive = false

	private readonly handleMultiSelectionProxyModifierClick = (
		e: Konva.KonvaEventObject<MouseEvent>,
	): void => {
		if (this.canvas.readonly || !isMultiSelectEvent(e.evt)) {
			return
		}

		const pos = this.canvas.stage.getPointerPosition()
		if (!pos) {
			return
		}

		const elementId = pickSelectedElementIdAtStagePointer(this.canvas, pos)
		if (!elementId) {
			return
		}

		this.canvas.selectionManager.toggle(elementId)
	}

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
				if (this.isUsingSelectionProxy() && this.isProxyInteractionActive) {
					return
				}
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
	 * 同步 Transformer 的宽高比锁定状态
	 * 修饰键状态由 Canvas 在键盘事件中统一设置，此处仅根据当前状态更新 Transformer
	 */
	public setKeepRatio(): void {
		this.updateKeepRatio()
	}

	/**
	 * 获取 transform 开始时的初始宽高比（用于 keep ratio 场景）
	 */
	public getInitialAspectRatio(): number | null {
		return this.initialAspectRatio
	}

	/**
	 * 检查 Shift/Meta 键是否按下（宽高比锁定修饰键）
	 * @returns 是否按下
	 */
	public isKeepRatioModifierPressed(): boolean {
		return this.canvas.isKeepRatioModifierPressed()
	}

	/**
	 * 检查是否应该保持宽高比
	 * @param elementIds - 元素ID数组，如果不提供则使用当前正在变换的元素
	 * @returns 是否应该保持宽高比
	 */
	public shouldKeepRatio(elementIds?: string[]): boolean {
		// 如果 Shift 或 Meta/Command 键按下，强制锁定宽高比
		if (this.canvas.isKeepRatioModifierPressed()) {
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
		if (this.canvas.isKeepRatioModifierPressed()) {
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

	private isUsingSelectionProxy(): boolean {
		return !!this.multiSelectionProxy
	}

	private getTransformableElementIds(elementIds: string[]): string[] {
		return elementIds.filter((id) => {
			const elementData = this.canvas.elementManager.getElementData(id)
			return this.canvas.permissionManager.canTransform(elementData)
		})
	}

	private getValidTransformNodes(elementIds: string[]): Konva.Node[] {
		const adapter = this.canvas.elementManager.getNodeAdapter()
		return adapter.getNodesForTransform(elementIds).filter((node): node is Konva.Node => {
			if (!node) return false
			const elementData = this.canvas.elementManager.getElementData(node.id())
			if (elementData && elementData.width === 0 && elementData.height === 0) {
				return false
			}
			return true
		})
	}

	private getSelectionBounds(elementIds: string[]): Rect | null {
		const adapter = this.canvas.elementManager.getNodeAdapter()
		return adapter.getElementsBounds(elementIds)
	}

	private createMultiSelectionProxy(bounds: Rect): Konva.Rect {
		return new Konva.Rect({
			x: bounds.x,
			y: bounds.y,
			width: bounds.width,
			height: bounds.height,
			draggable: !this.canvas.readonly,
			fill: "rgba(0, 0, 0, 0.001)",
			strokeWidth: 0,
			listening: true,
			name: "multi-selection-proxy",
		})
	}

	private bindMultiSelectionContextMenu(proxy: Konva.Rect): void {
		proxy.on("contextmenu", (e: Konva.KonvaEventObject<MouseEvent>) => {
			e.evt.preventDefault()
			e.cancelBubble = true

			const [elementId] = this.canvas.selectionManager.getSelectedIds()
			if (!elementId) {
				return
			}

			this.canvas.eventEmitter.emit({
				type: "element:contextmenu",
				data: {
					elementId,
					x: e.evt.clientX,
					y: e.evt.clientY,
				},
			})
		})
	}

	private getProxyBounds(): Rect | null {
		if (!this.multiSelectionProxy) {
			return null
		}

		return {
			x: this.multiSelectionProxy.x(),
			y: this.multiSelectionProxy.y(),
			width: this.multiSelectionProxy.width() * this.multiSelectionProxy.scaleX(),
			height: this.multiSelectionProxy.height() * this.multiSelectionProxy.scaleY(),
		}
	}

	private captureProxyState(elementIds: string[]): void {
		this.proxyInitialBounds = this.getSelectionBounds(elementIds)
		this.proxyInitialNodeStates.clear()

		const nodes = this.getValidTransformNodes(elementIds)
		nodes.forEach((node) => {
			this.proxyInitialNodeStates.set(node.id(), {
				x: node.x(),
				y: node.y(),
				scaleX: node.scaleX(),
				scaleY: node.scaleY(),
				width: node instanceof Konva.Group ? node.width() : undefined,
				height: node instanceof Konva.Group ? node.height() : undefined,
			})
		})
	}

	private syncSelectionProxyToElements(options: {
		isRealtime: boolean
		isScaling: boolean
	}): void {
		if (!this.multiSelectionProxy || !this.proxyInitialBounds) {
			return
		}

		const { isRealtime, isScaling } = options
		const currentBounds = this.getProxyBounds()
		if (!currentBounds) {
			return
		}

		const initialBounds = this.proxyInitialBounds
		const initialWidth = initialBounds.width || 1
		const initialHeight = initialBounds.height || 1
		const selectionScaleX = currentBounds.width / initialWidth
		const selectionScaleY = currentBounds.height / initialHeight
		const skipImageCropResizeSync = isRealtime && isScaling

		for (const [elementId, snapshot] of this.proxyInitialNodeStates) {
			const element = this.canvas.elementManager.getElementInstance(elementId)
			if (!element) continue

			const rawUpdates: Partial<LayerElement> = {
				x: currentBounds.x + (snapshot.x - initialBounds.x) * selectionScaleX,
				y: currentBounds.y + (snapshot.y - initialBounds.y) * selectionScaleY,
				scaleX: snapshot.scaleX * selectionScaleX,
				scaleY: snapshot.scaleY * selectionScaleY,
				width: snapshot.width,
				height: snapshot.height,
			}

			const appliedUpdates = element.applyTransform(rawUpdates, {
				isRealtime,
				isScaling,
				shouldKeepRatio: this.shouldKeepRatio([elementId]),
				initialAspectRatio:
					this.initialElementAspectRatios.get(elementId) ??
					this.initialAspectRatio ??
					undefined,
			})

			this.canvas.elementManager.update(elementId, appliedUpdates, {
				mode: "node-only",
				forceRerender: false,
				skipImageCropResizeSync,
			})

			this.canvas.elementManager.update(elementId, appliedUpdates, {
				mode: "data-only",
				silent: true,
				skipImageCropResizeSync,
			})
		}
	}

	private syncSelectionProxyFromElements(elementIds: string[]): void {
		if (!this.multiSelectionProxy) {
			return
		}

		const bounds = this.getSelectionBounds(elementIds)
		if (!bounds) {
			this.hideTransformer()
			return
		}

		this.multiSelectionProxy.position({ x: bounds.x, y: bounds.y })
		this.multiSelectionProxy.size({ width: bounds.width, height: bounds.height })
		this.multiSelectionProxy.scale({ x: 1, y: 1 })
	}

	public applySelectionProxyDragOffset(snapOffsetX: number, snapOffsetY: number): boolean {
		if (!this.multiSelectionProxy || !this.isProxyInteractionActive) {
			return false
		}

		this.multiSelectionProxy.position({
			x: this.multiSelectionProxy.x() + snapOffsetX,
			y: this.multiSelectionProxy.y() + snapOffsetY,
		})
		this.syncSelectionProxyToElements({ isRealtime: true, isScaling: false })
		this.canvas.controlsLayer.batchDraw()
		return true
	}

	/**
	 * 将 Transformer 绑定节点的状态同步到 ElementManager
	 */
	private syncTransformerNodesToElements(options: {
		isRealtime: boolean
		isScaling: boolean
	}): void {
		const { isRealtime, isScaling } = options
		const skipImageCropResizeSync = isRealtime && isScaling
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
				initialAspectRatio:
					this.initialElementAspectRatios.get(elementId) ??
					this.initialAspectRatio ??
					undefined,
			})

			this.canvas.elementManager.update(elementId, appliedUpdates, {
				mode: "node-only",
				forceRerender: false,
				skipImageCropResizeSync,
			})

			if (appliedUpdates.width !== undefined || appliedUpdates.height !== undefined) {
				this.transformer?.forceUpdate()
			}

			this.canvas.elementManager.update(elementId, appliedUpdates, {
				mode: "data-only",
				silent: true,
				skipImageCropResizeSync,
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
		if (this.isUsingSelectionProxy()) {
			this.isProxyInteractionActive = true
			this.captureProxyState(elementIds)
		}

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
		if (this.isUsingSelectionProxy()) {
			this.syncSelectionProxyToElements({ isRealtime: true, isScaling: false })
		} else {
			this.syncTransformerNodesToElements({ isRealtime: true, isScaling: false })
		}

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

			if (this.isUsingSelectionProxy()) {
				this.syncSelectionProxyToElements({ isRealtime: false, isScaling: false })
				this.syncSelectionProxyFromElements(elementIds)
			} else {
				this.syncTransformerNodesToElements({ isRealtime: false, isScaling: false })
			}

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

			this.canvas.eventEmitter.emit({
				type: "element:change",
				data: elementIds.length > 0 ? { elementIds } : undefined,
			})

			this.isDragging = false
			this.isProxyInteractionActive = false
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

		const elementIds = Array.from(this.transformingElementIds)
		this.captureInitialAspectRatios(elementIds)
		if (this.isUsingSelectionProxy()) {
			this.isProxyInteractionActive = true
			this.captureProxyState(elementIds)
		}
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

		if (this.isUsingSelectionProxy()) {
			this.syncSelectionProxyToElements({ isRealtime: true, isScaling: true })
		} else {
			this.syncTransformerNodesToElements({ isRealtime: true, isScaling: true })
		}

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

			if (this.isUsingSelectionProxy()) {
				this.syncSelectionProxyToElements({ isRealtime: false, isScaling: false })
				this.syncSelectionProxyFromElements(elementIds)
			} else {
				this.syncTransformerNodesToElements({ isRealtime: false, isScaling: false })
			}

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

			this.canvas.eventEmitter.emit({
				type: "element:change",
				data: elementIds.length > 0 ? { elementIds } : undefined,
			})

			this.initialAspectRatio = null
			this.initialElementAspectRatios.clear()
			this.isProxyInteractionActive = false
		} finally {
			this.canvas.historyManager?.enable()
		}
	}

	/**
	 * 记录 transform 开始时的整体/单元素初始宽高比
	 */
	private captureInitialAspectRatios(elementIds: string[]): void {
		const adapter = this.canvas.elementManager.getNodeAdapter()
		const selectionBounds = adapter.getElementsBounds(elementIds)
		if (selectionBounds && selectionBounds.width > 0 && selectionBounds.height > 0) {
			this.initialAspectRatio = selectionBounds.width / selectionBounds.height
		} else {
			this.initialAspectRatio = null
		}

		this.initialElementAspectRatios.clear()
		elementIds.forEach((elementId) => {
			const elementBounds = adapter.getElementBounds(elementId)
			if (!elementBounds || elementBounds.width <= 0 || elementBounds.height <= 0) return
			this.initialElementAspectRatios.set(
				elementId,
				elementBounds.width / elementBounds.height,
			)
		})
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
		const transformableElementIds = this.getTransformableElementIds(elementIds)

		// 如果所有元素都不可变换，不显示 Transformer
		if (transformableElementIds.length === 0) return

		let nodes: Konva.Node[] = []
		if (transformableElementIds.length === 1) {
			nodes = this.getValidTransformNodes(transformableElementIds)
			if (nodes.length === 0) return
		} else {
			const selectionBounds = this.getSelectionBounds(transformableElementIds)
			if (!selectionBounds) return
			this.multiSelectionProxy = this.createMultiSelectionProxy(selectionBounds)
			this.bindMultiSelectionContextMenu(this.multiSelectionProxy)
			this.multiSelectionProxy.on("click", this.handleMultiSelectionProxyModifierClick)
			this.multiSelectionProxy.on("dragstart", () => this.handleTransformerDragstart())
			this.multiSelectionProxy.on("dragmove", () => this.handleTransformerDragmove())
			this.multiSelectionProxy.on("dragend", () => this.handleTransformerDragend())
			this.canvas.controlsLayer.add(this.multiSelectionProxy)
			nodes = [this.multiSelectionProxy]
		}

		// 创建新的 Transformer
		const anchorSize = STANDARD_TRANSFORMER_STYLE.ANCHOR_SIZE
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
				resultBox = applyAspectRatioToBoundBox(
					oldBox,
					resultBox,
					activeAnchor,
					this.initialAspectRatio,
				)
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
			anchor.opacity(STANDARD_TRANSFORMER_STYLE.ANCHOR_OPACITY)
		}

		this.transformer = new Konva.Transformer({
			canvas: this.canvas,
			nodes: nodes,
			keepRatio: this.shouldKeepRatio(transformableElementIds), // 根据元素需求设置是否锁定宽高比
			enabledAnchors,
			anchorSize,
			rotateEnabled: false,
			borderStroke: STANDARD_TRANSFORMER_STYLE.BORDER_STROKE,
			borderStrokeWidth: STANDARD_TRANSFORMER_STYLE.BORDER_STROKE_WIDTH,
			anchorStroke: STANDARD_TRANSFORMER_STYLE.ANCHOR_STROKE,
			anchorFill: STANDARD_TRANSFORMER_STYLE.ANCHOR_FILL,
			anchorStrokeWidth: STANDARD_TRANSFORMER_STYLE.ANCHOR_STROKE_WIDTH,
			ignoreStroke: STANDARD_TRANSFORMER_STYLE.IGNORE_STROKE, // 忽略 stroke，避免边框影响边界计算
			boundBoxFunc,
			anchorStyleFunc,
		})

		if (!this.isUsingSelectionProxy()) {
			this.transformer.on("dragstart", () => this.handleTransformerDragstart())
			this.transformer.on("dragmove", () => this.handleTransformerDragmove())
			this.transformer.on("dragend", () => this.handleTransformerDragend())
		}
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

		if (this.multiSelectionProxy) {
			this.multiSelectionProxy.off("dragstart")
			this.multiSelectionProxy.off("dragmove")
			this.multiSelectionProxy.off("dragend")
			this.multiSelectionProxy.off("click", this.handleMultiSelectionProxyModifierClick)
			this.multiSelectionProxy.off("contextmenu")
			this.multiSelectionProxy.destroy()
			this.multiSelectionProxy = null
		}

		// 清空正在 transform 的元素集合
		this.transformingElementIds.clear()
		// 清除初始宽高比记录
		this.initialAspectRatio = null
		this.initialElementAspectRatios.clear()
		this.proxyInitialBounds = null
		this.proxyInitialNodeStates.clear()
		this.isProxyInteractionActive = false
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

		const transformableElementIds = this.getTransformableElementIds(elementIds)
		if (transformableElementIds.length === 0) {
			this.hideTransformer()
			return
		}

		if (transformableElementIds.length > 1) {
			if (!this.isUsingSelectionProxy()) {
				this.showTransformer(transformableElementIds)
				return
			}

			this.syncSelectionProxyFromElements(transformableElementIds)
			this.transformer.nodes(this.multiSelectionProxy ? [this.multiSelectionProxy] : [])
			this.transformer.keepRatio(this.shouldKeepRatio(transformableElementIds))
			this.transformer.forceUpdate()
			this.canvas.controlsLayer.batchDraw()

			this.transformingElementIds.clear()
			transformableElementIds.forEach((id) => this.transformingElementIds.add(id))
			return
		}

		if (this.isUsingSelectionProxy()) {
			this.showTransformer(transformableElementIds)
			return
		}

		const nodes = this.getValidTransformNodes(transformableElementIds)

		if (nodes.length === 0) {
			this.hideTransformer()
			return
		}

		// 更新 Transformer 的节点和 keepRatio
		this.transformer.nodes(nodes)
		this.transformer.keepRatio(this.shouldKeepRatio(transformableElementIds))
		this.transformer.forceUpdate()
		this.canvas.controlsLayer.batchDraw()

		// 更新正在 transform 的元素集合
		this.transformingElementIds.clear()
		transformableElementIds.forEach((id) => this.transformingElementIds.add(id))
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
