import Konva from "konva"
import type { LayerElement } from "../../document/types"
import type { Canvas } from "../../core/Canvas"
import type { Box } from "konva/lib/shapes/Transformer"
import { getKeepRatioAspectRatio, isEdgeAnchor, applyAspectRatioToBoundBox } from "./anchorUtils"
import { STANDARD_TRANSFORMER_STYLE } from "../frame/FrameEditorShared"
import type { Rect } from "../../shared/ids"
import { pickContentElementIdAtStagePointer } from "./elementNodeUtils"
import { isMultiSelectEvent } from "../shortcuts/modifierUtils"

type TransformElementInstance = NonNullable<
	ReturnType<Canvas["elementManager"]["getElementInstance"]>
>

interface TransformElementSessionState {
	element: TransformElementInstance
	shouldKeepRatio: boolean
	initialAspectRatio?: number
}

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

interface ProxyTransformNodeState {
	node: Konva.Node
	element: TransformElementInstance
	/** 节点原点在 contentLayer 坐标系中的位置。 */
	x: number
	y: number
	scaleX: number
	scaleY: number
	width?: number
	height?: number
	shouldKeepRatio: boolean
	initialAspectRatio?: number
}

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
	private isFinishingDrag = false

	// 记录 transform 开始时的初始宽高比（用于 Shift 或 Command 键锁定）
	private initialAspectRatio: number | null = null

	// 记录 transform 开始时每个元素各自的初始宽高比（用于多选保持各自比例）
	private initialElementAspectRatios: Map<string, number> = new Map()
	private proxyInitialBounds: Rect | null = null
	private proxyInitialNodeStates: Map<string, ProxyTransformNodeState> = new Map()
	private transformSessionElementStates: Map<string, TransformElementSessionState> = new Map()
	private isProxyInteractionActive = false
	private isAnchorTransformActive = false
	private isTransformIntentActive = false
	private pendingTransformerElementIds: string[] | null = null
	private pendingTransformerUpdateRafId: number | null = null

	private readonly handleMultiSelectionProxyModifierClick = (
		e: Konva.KonvaEventObject<MouseEvent>,
	): void => {
		if (!this.canvas.permissionManager.can("document.write") || !isMultiSelectEvent(e.evt)) {
			return
		}

		const pos = this.canvas.stage.getPointerPosition()
		if (!pos) {
			return
		}

		const elementId = pickContentElementIdAtStagePointer(this.canvas, pos)
		if (!elementId) {
			return
		}

		const elementData = this.canvas.elementManager.getElementData(elementId)
		const canToggle =
			this.canvas.selectionManager.isSelected(elementId) ||
			this.canvas.permissionManager.canSelect(elementData)
		if (!canToggle) {
			return
		}

		this.canvas.selectionManager.toggle(elementId)
	}

	constructor(options: { canvas: Canvas }) {
		const { canvas } = options
		this.canvas = canvas

		this.setupEventListeners()
	}

	private requestControlsDraw(reason: string): void {
		this.canvas.runtimeScheduler.requestLayerDraw("controls", {
			source: "TransformManager",
			reason,
			priority: "input",
		})
	}

	private requestContentDraw(reason: string): void {
		this.canvas.runtimeScheduler.requestLayerDraw("content", {
			source: "TransformManager",
			reason,
			priority: "input",
		})
	}

	/**
	 * 设置事件监听
	 */
	private setupEventListeners(): void {
		// 监听访问能力变化
		this.canvas.eventEmitter.on("permission:changed", () => {
			// 失去文档写能力时隐藏 Transformer
			if (!this.canvas.permissionManager.can("document.write")) {
				this.hideTransformer()
			}
		})

		// 监听选中事件，显示 Transformer
		this.canvas.eventEmitter.on("element:select", ({ data }) => {
			const { elementIds } = data
			if (this.isTransformInteractionActive()) {
				this.pendingTransformerElementIds = elementIds
				return
			}
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
				if (this.isTransformInteractionActive()) {
					this.pendingTransformerElementIds = Array.from(this.transformingElementIds)
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

	public isTransformInteractionActive(): boolean {
		return (
			this.isDragging ||
			this.isProxyInteractionActive ||
			this.isAnchorTransformActive ||
			this.isTransformIntentActive
		)
	}

	public beginTransformInteractionIntent(elementIds?: string[]): void {
		if (
			!this.canvas.permissionManager.can("document.write") ||
			this.isDragging ||
			this.isProxyInteractionActive
		)
			return
		this.isTransformIntentActive = true
		if (elementIds && elementIds.length > 0) {
			this.pendingTransformerElementIds = elementIds
		}
	}

	public clearTransformInteractionIntent(): void {
		if (!this.isTransformIntentActive) return

		this.isTransformIntentActive = false
		const elementIds = Array.from(this.transformingElementIds)
		this.canvas.eventEmitter.emit({
			type: "elements:transform:intentend",
			data: { elementIds },
		})
		this.schedulePendingTransformerUpdate()
	}

	public getMultiSelectionDragDistance(): number {
		return this.multiSelectionProxy?.dragDistance() ?? 3
	}

	/**
	 * 多选拖拽开始后，外部管理器可能为了跨容器显示把节点临时移动到 content layer。
	 * Proxy 的快路径保存的是节点父级局部坐标，因此必须在换容器后重建坐标基线，
	 * 否则下一次 dragmove 会把旧画框局部坐标当成 content 坐标，造成选区跳动。
	 */
	public rebaseActiveDragNodePositions(elementIds: readonly string[]): void {
		if (!this.multiSelectionProxy || !this.isProxyInteractionActive) return

		elementIds.forEach((elementId) => {
			const snapshot = this.proxyInitialNodeStates.get(elementId)
			if (!snapshot) return
			const contentPosition = this.getNodeContentPosition(snapshot.node)
			snapshot.x = contentPosition.x
			snapshot.y = contentPosition.y
		})
	}

	public startMultiSelectionProxyDrag(event: MouseEvent | PointerEvent | TouchEvent): boolean {
		if (
			!this.canvas.permissionManager.can("document.write") ||
			!this.multiSelectionProxy ||
			this.isDragging ||
			this.isProxyInteractionActive
		) {
			return false
		}

		const selectedIds = this.canvas.selectionManager.getSelectedIds()
		if (selectedIds.length <= 1 || !this.multiSelectionProxy.draggable()) {
			return false
		}

		this.multiSelectionProxy.startDrag({ evt: event })
		return true
	}

	public cancelActiveTransformDrag(): void {
		const transformer = this.transformer
		const proxy = this.multiSelectionProxy
		// 单选拖动由实际元素发起；只停止控制器会让元素继续拖动或漏掉结束通知。
		const nodes = Array.from(this.transformingElementIds)
			.map((id) => this.canvas.elementManager.getElementInstance(id)?.getNode())
			.filter((node): node is Konva.Node => Boolean(node))
		for (const node of nodes) {
			if (node.isDragging()) node.stopDrag()
		}
		if (proxy?.isDragging()) {
			proxy.stopDrag()
		}
		if (transformer?.isDragging()) {
			transformer.stopDrag()
		}
		// 控制器已销毁或 dragend 因权限变化被中断时，仍通过原结束入口释放状态。
		if (this.isDragging) this.handleTransformerDragend()
		this.clearTransformInteractionIntent()
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

	private captureTransformSessionState(elementIds: string[]): void {
		this.transformSessionElementStates.clear()
		elementIds.forEach((elementId) => {
			const element = this.canvas.elementManager.getElementInstance(elementId)
			if (!element) return
			this.transformSessionElementStates.set(elementId, {
				element,
				shouldKeepRatio: element.shouldKeepRatio(),
				initialAspectRatio:
					this.initialElementAspectRatios.get(elementId) ??
					this.initialAspectRatio ??
					undefined,
			})
		})
	}

	private getTransformSessionState(elementId: string): TransformElementSessionState | undefined {
		const cachedState = this.transformSessionElementStates.get(elementId)
		if (cachedState) return cachedState

		const element = this.canvas.elementManager.getElementInstance(elementId)
		if (!element) return undefined
		const state: TransformElementSessionState = {
			element,
			shouldKeepRatio: element.shouldKeepRatio(),
			initialAspectRatio:
				this.initialElementAspectRatios.get(elementId) ??
				this.initialAspectRatio ??
				undefined,
		}
		this.transformSessionElementStates.set(elementId, state)
		return state
	}

	private shouldKeepRatioForSession(
		state: Pick<TransformElementSessionState, "shouldKeepRatio">,
	): boolean {
		return this.canvas.isKeepRatioModifierPressed() || state.shouldKeepRatio
	}

	/** 将节点原点转换到 contentLayer 坐标系。 */
	private getNodeContentPosition(node: Konva.Node): { x: number; y: number } {
		if (!this.canvas?.contentLayer || typeof node.getAbsoluteTransform !== "function") {
			return { x: node.x(), y: node.y() }
		}
		const stagePosition = node.getAbsoluteTransform().copy().point({ x: 0, y: 0 })
		return this.canvas.contentLayer.getAbsoluteTransform().copy().invert().point(stagePosition)
	}

	/** 将 contentLayer 坐标转换为节点父容器的局部坐标。 */
	private getNodeParentPosition(
		node: Konva.Node,
		contentPosition: { x: number; y: number },
	): {
		x: number
		y: number
	} {
		if (!this.canvas?.contentLayer || typeof node.getAbsoluteTransform !== "function") {
			return contentPosition
		}
		const stagePosition = this.canvas.contentLayer
			.getAbsoluteTransform()
			.copy()
			.point(contentPosition)
		const parent = node.getParent() ?? this.canvas.contentLayer
		return parent.getAbsoluteTransform().copy().invert().point(stagePosition)
	}

	private applyNodeParentPosition(node: Konva.Node, position: { x: number; y: number }): void {
		if (typeof node.position === "function") {
			node.position(position)
			return
		}
		node.x(position.x)
		node.y(position.y)
	}

	private clearTransformSessionState(): void {
		this.transformSessionElementStates.clear()
	}

	private createMultiSelectionProxy(bounds: Rect): Konva.Rect {
		return new Konva.Rect({
			x: bounds.x,
			y: bounds.y,
			width: bounds.width,
			height: bounds.height,
			draggable: this.canvas.permissionManager.can("document.write"),
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
			const sessionState = this.getTransformSessionState(node.id())
			if (!sessionState) return
			this.proxyInitialNodeStates.set(node.id(), {
				node,
				element: sessionState.element,
				...this.getNodeContentPosition(node),
				scaleX: node.scaleX(),
				scaleY: node.scaleY(),
				width: node instanceof Konva.Group ? node.width() : undefined,
				height: node instanceof Konva.Group ? node.height() : undefined,
				shouldKeepRatio: sessionState.shouldKeepRatio,
				initialAspectRatio: sessionState.initialAspectRatio,
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

		if (isRealtime && !isScaling) {
			this.syncSelectionProxyTranslationToNodes(currentBounds)
			return
		}

		this.proxyInitialNodeStates.forEach((snapshot, elementId) => {
			const contentPosition = {
				x: currentBounds.x + (snapshot.x - initialBounds.x) * selectionScaleX,
				y: currentBounds.y + (snapshot.y - initialBounds.y) * selectionScaleY,
			}
			const parentPosition = this.getNodeParentPosition(snapshot.node, contentPosition)
			const rawUpdates: Partial<LayerElement> = {
				x: parentPosition.x,
				y: parentPosition.y,
				scaleX: snapshot.scaleX * selectionScaleX,
				scaleY: snapshot.scaleY * selectionScaleY,
				width: snapshot.width,
				height: snapshot.height,
			}

			const appliedUpdates = snapshot.element.applyTransform(rawUpdates, {
				isRealtime,
				isScaling,
				shouldKeepRatio: this.shouldKeepRatioForSession(snapshot),
				initialAspectRatio: snapshot.initialAspectRatio,
			})

			this.canvas.elementManager.update(elementId, appliedUpdates, {
				mode: "node-only",
				forceRerender: false,
				skipGeometryInvalidate: !isRealtime,
				skipImageCropResizeSync,
			})

			// 大多数元素在实时阶段只需更新 node；文本等需要重建内部渲染结构的元素，
			// 还必须同步 data，才能让新的排版尺寸实时反映到 Konva 子节点和几何边界。
			if (isRealtime && !snapshot.element.shouldSyncTransformDataInRealtime()) return

			this.canvas.elementManager.update(elementId, appliedUpdates, {
				mode: "data-only",
				silent: true,
				skipImageCropResizeSync,
			})
		})
	}

	private syncSelectionProxyTranslationToNodes(currentBounds: Rect): void {
		if (!this.proxyInitialBounds) return

		const deltaX = currentBounds.x - this.proxyInitialBounds.x
		const deltaY = currentBounds.y - this.proxyInitialBounds.y

		this.proxyInitialNodeStates.forEach((snapshot) => {
			const parentPosition = this.getNodeParentPosition(snapshot.node, {
				x: snapshot.x + deltaX,
				y: snapshot.y + deltaY,
			})
			this.applyNodeParentPosition(snapshot.node, parentPosition)
		})
		this.requestContentDraw("selection-proxy-translation")
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
		this.requestControlsDraw("selection-proxy-drag")
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
			const sessionState = this.getTransformSessionState(elementId)

			if (!elementId || !sessionState) return

			const rawUpdates: Partial<LayerElement> = {
				x: node.x(),
				y: node.y(),
				width: node instanceof Konva.Group ? node.width() : undefined,
				height: node instanceof Konva.Group ? node.height() : undefined,
				scaleX: node.scaleX(),
				scaleY: node.scaleY(),
			}

			const appliedUpdates = sessionState.element.applyTransform(rawUpdates, {
				isRealtime,
				isScaling,
				shouldKeepRatio: this.shouldKeepRatioForSession(sessionState),
				initialAspectRatio: sessionState.initialAspectRatio,
			})

			this.canvas.elementManager.update(elementId, appliedUpdates, {
				mode: "node-only",
				forceRerender: false,
				skipGeometryInvalidate: true,
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
		if (!this.canvas.permissionManager.can("document.write")) return

		this.isTransformIntentActive = false
		this.isDragging = true
		const elementIds = Array.from(this.transformingElementIds)
		this.captureTransformSessionState(elementIds)
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
			this.requestControlsDraw("transformer-hide-on-drag-start")
		}
	}

	/**
	 * Transformer dragmove 事件处理：拖动 Transformer 移动选区过程中持续触发
	 */
	private handleTransformerDragmove(): void {
		if (!this.canvas.permissionManager.can("document.write")) return

		const elementIds = Array.from(this.transformingElementIds)
		const isUsingSelectionProxy = this.isUsingSelectionProxy()
		if (isUsingSelectionProxy) {
			this.syncSelectionProxyToElements({ isRealtime: true, isScaling: false })
		} else {
			this.syncTransformerNodesToElements({ isRealtime: true, isScaling: false })
		}
		const boundingRect = isUsingSelectionProxy
			? this.getProxyBounds()
			: this.getSelectionBounds(elementIds)

		this.canvas.eventEmitter.emit({
			type: "elements:transform:dragmove",
			data: {
				elementIds,
				boundingRect,
			},
		})

		if (isUsingSelectionProxy) return

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
		if (!this.isDragging || this.isFinishingDrag) return
		this.isFinishingDrag = true
		const elementIds = Array.from(this.transformingElementIds)
		const canWrite =
			this.canvas.permissionManager.can("document.write") && elementIds.length > 0
		const historyManager = this.canvas.historyManager
		let synchronized = false
		if (canWrite) historyManager?.disable()

		try {
			if (canWrite) {
				if (this.isUsingSelectionProxy()) {
					this.syncSelectionProxyToElements({ isRealtime: false, isScaling: false })
					this.syncSelectionProxyFromElements(elementIds)
				} else {
					this.syncTransformerNodesToElements({ isRealtime: false, isScaling: false })
				}
				synchronized = true
			}
		} finally {
			// 正常释放、控制器销毁、权限丢失或同步失败，都必须先结束运行态再通知 UI。
			// 否则结束订阅中更新的选中状态会再次被当作「仍在拖动」而无限延期。
			this.isDragging = false
			this.isFinishingDrag = false
			this.isProxyInteractionActive = false
			this.initialAspectRatio = null
			this.clearTransformSessionState()
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

			historyManager?.enable()
			if (synchronized && historyManager) {
				historyManager.recordHistoryImmediate()
			}

			if (synchronized) {
				this.canvas.eventEmitter.emit({
					type: "element:change",
					data: { elementIds, phase: "commit" },
				})
			}

			if (this.transformer && !this.transformer.visible()) {
				this.transformer.show()
				this.transformer.forceUpdate()
				this.requestControlsDraw("transformer-show-on-drag-end")
			}
			this.schedulePendingTransformerUpdate()
		}
	}

	/**
	 * Transformer transformstart 事件处理：拖动 Anchor 缩放时触发（在 transform 之前）
	 */
	private handleTransformerTransformstart(): void {
		if (!this.canvas.permissionManager.can("document.write")) return

		const elementIds = Array.from(this.transformingElementIds)
		this.captureInitialAspectRatios(elementIds)
		this.captureTransformSessionState(elementIds)
		if (this.isUsingSelectionProxy()) {
			this.isProxyInteractionActive = true
			this.captureProxyState(elementIds)
		}
		const activeAnchor = this.transformer?.getActiveAnchor()
		if (activeAnchor) {
			this.isTransformIntentActive = false
			this.isAnchorTransformActive = true
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
		if (!this.canvas.permissionManager.can("document.write")) return

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
		if (!this.canvas.permissionManager.can("document.write")) {
			this.isAnchorTransformActive = false
			this.isProxyInteractionActive = false
			this.schedulePendingTransformerUpdate()
			return
		}

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
				data: elementIds.length > 0 ? { elementIds, phase: "commit" } : undefined,
			})

			this.initialAspectRatio = null
			this.initialElementAspectRatios.clear()
			this.clearTransformSessionState()
			this.isAnchorTransformActive = false
			this.isProxyInteractionActive = false
			this.schedulePendingTransformerUpdate()
		} finally {
			this.canvas.historyManager?.enable()
			this.isAnchorTransformActive = false
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
			this.multiSelectionProxy.on("mousedown", () => {
				this.beginTransformInteractionIntent(transformableElementIds)
			})
			this.multiSelectionProxy.on("mouseup", () => {
				this.clearTransformInteractionIntent()
			})
			this.multiSelectionProxy.on("click", this.handleMultiSelectionProxyModifierClick)
			this.multiSelectionProxy.on("dragstart", () => this.handleTransformerDragstart())
			this.multiSelectionProxy.on("dragmove", () => this.handleTransformerDragmove())
			this.multiSelectionProxy.on("dragend", () => this.handleTransformerDragend())
			this.canvas.controlsLayer.add(this.multiSelectionProxy)
			nodes = [this.multiSelectionProxy]
		}

		// 创建新的 Transformer
		const anchorSize = STANDARD_TRANSFORMER_STYLE.ANCHOR_SIZE
		const singleElement =
			transformableElementIds.length === 1
				? this.canvas.elementManager.getElementInstance(transformableElementIds[0])
				: undefined
		const singleElementConstraints = singleElement?.getTransformConstraints()
		const multiSelectionContainsResizeRestrictedElement =
			transformableElementIds.length > 1 &&
			transformableElementIds.some((elementId) => {
				const constraints = this.canvas.elementManager
					.getElementInstance(elementId)
					?.getTransformConstraints()
				return constraints?.enabledAnchors !== undefined
			})
		let enabledAnchors: string[] = []
		if (this.canvas.permissionManager.can("document.write")) {
			enabledAnchors = multiSelectionContainsResizeRestrictedElement
				? []
				: (singleElementConstraints?.enabledAnchors ?? [
						"top-left",
						"top-right",
						"bottom-left",
						"bottom-right",
						"top-center",
						"bottom-center",
						"middle-left",
						"middle-right",
					])
		}
		// 限制最小尺寸并防止翻转
		const boundBoxFunc = (oldBox: Box, newBox: Box): Box => {
			// 使用 PermissionManager 统一判断：只读模式下禁止变换
			if (!this.canvas.permissionManager.can("document.write")) {
				return oldBox
			}
			// 防止翻转：确保宽度和高度始终为正数
			if (newBox.width < 0 || newBox.height < 0) {
				return oldBox
			}
			let resultBox: Box = newBox
			const activeAnchor = this.transformer?.getActiveAnchor()
			const applySingleElementConstraints = (box: Box): Box | null => {
				if (!singleElementConstraints) return box

				const elementWidth = singleElement?.getSize().width ?? oldBox.width
				const elementHeight = singleElement?.getSize().height ?? oldBox.height
				const widthScale = elementWidth > 0 ? oldBox.width / elementWidth : 1
				const heightScale = elementHeight > 0 ? oldBox.height / elementHeight : 1
				const minWidth = (singleElementConstraints.minWidth ?? 0) * widthScale
				const minHeight = (singleElementConstraints.minHeight ?? 0) * heightScale
				const constrainedBox =
					singleElementConstraints.fixedHeight !== undefined
						? {
								...box,
								y: oldBox.y,
								height: singleElementConstraints.fixedHeight * heightScale,
							}
						: box
				if (minWidth > 0 && constrainedBox.width < minWidth) {
					return null
				}
				if (minHeight > 0 && constrainedBox.height < minHeight) {
					return null
				}
				return constrainedBox
			}

			const initiallyConstrainedBox = applySingleElementConstraints(resultBox)
			if (!initiallyConstrainedBox) return oldBox
			resultBox = initiallyConstrainedBox

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

			// 缩放吸附必须在 boundBoxFunc 内完成，保证 Konva Transformer 是唯一实时尺寸来源。
			// 单选/多选都走同一入口，避免 anchorDragmove 后置写 node/data 造成下一帧尺寸回跳。
			if (activeAnchor && transformableElementIds.length > 0) {
				const aspectRatio = getKeepRatioAspectRatio(this.initialAspectRatio, oldBox)
				resultBox = this.canvas.snapGuideManager.getSnappedBox(
					oldBox,
					resultBox,
					activeAnchor,
					transformableElementIds,
					{ keepRatio: currentShouldKeepRatio, aspectRatio },
				)
			}
			return applySingleElementConstraints(resultBox) ?? oldBox
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
		this.requestControlsDraw("show-transformer")

		// 更新正在 transform 的元素集合（只包含可变换的元素）
		this.transformingElementIds.clear()
		transformableElementIds.forEach((id) => this.transformingElementIds.add(id))
	}

	/**
	 * 隐藏 Transformer
	 */
	public hideTransformer(): void {
		// 移除结束监听之前完成活动拖动，否则控制器消失而 isDragging 永远不会复位。
		if (this.isDragging) this.cancelActiveTransformDrag()
		this.cancelPendingTransformerUpdate()
		this.pendingTransformerElementIds = null

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
			this.requestControlsDraw("hide-transformer")
		}

		if (this.multiSelectionProxy) {
			this.multiSelectionProxy.off("dragstart")
			this.multiSelectionProxy.off("dragmove")
			this.multiSelectionProxy.off("dragend")
			this.multiSelectionProxy.off("mousedown")
			this.multiSelectionProxy.off("mouseup")
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
		this.clearTransformSessionState()
		this.isProxyInteractionActive = false
		this.isAnchorTransformActive = false
		this.isTransformIntentActive = false
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
			this.requestControlsDraw("update-transformer-proxy")

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
		this.requestControlsDraw("update-transformer")

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
	 * 检查元素是否处于正在进行的 transform 交互中。
	 * 注意：isTransforming 表示元素已绑定到 Transformer，普通选中态也会为 true。
	 */
	public isElementInActiveTransformInteraction(elementId: string): boolean {
		return this.transformingElementIds.has(elementId) && this.isTransformInteractionActive()
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
		this.cancelPendingTransformerUpdate()
		this.hideTransformer()
		// 移除事件监听器
		this.canvas.eventEmitter.off("element:select")
		this.canvas.eventEmitter.off("element:deselect")
		this.canvas.eventEmitter.off("element:updated")
	}

	private schedulePendingTransformerUpdate(): void {
		if (this.pendingTransformerUpdateRafId !== null) return
		const schedule =
			typeof requestAnimationFrame === "function"
				? requestAnimationFrame
				: (callback: FrameRequestCallback) => window.setTimeout(callback, 16)
		this.pendingTransformerUpdateRafId = schedule(() => {
			this.pendingTransformerUpdateRafId = null
			const elementIds = this.pendingTransformerElementIds
			this.pendingTransformerElementIds = null
			if (!elementIds || elementIds.length === 0 || this.isTransformInteractionActive()) {
				return
			}
			this.updateTransformer(elementIds)
		})
	}

	private cancelPendingTransformerUpdate(): void {
		if (this.pendingTransformerUpdateRafId === null) return
		const cancel =
			typeof cancelAnimationFrame === "function"
				? cancelAnimationFrame
				: (id: number) => window.clearTimeout(id)
		cancel(this.pendingTransformerUpdateRafId)
		this.pendingTransformerUpdateRafId = null
	}
}
