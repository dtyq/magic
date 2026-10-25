import Konva from "konva"
import type { ToolOptions } from "./BaseTool"
import { BaseTool } from "./BaseTool"
import { ElementTypeEnum, type LayerElement } from "../../document/types"
import { getActiveImageContent } from "../../document/elementContent"
import { CropRenderer } from "../crop/CropRenderer"
import { ExtendRenderer } from "../extend/ExtendRenderer"
import {
	pickSelectedElementIdAtStagePointer,
	resolveManagedElementIdFromKonvaNode,
} from "../transform/elementNodeUtils"
import { getNameLabelElementIdFromNode } from "../labels/nameLabelNodeUtils"
import type {
	CanvasNativePointerEvent,
	CanvasPointerInput,
	CanvasPointerType,
} from "../input/index"
import { getClientPointFromNativeEvent } from "../input/index"
import { isMultiSelectEvent } from "../shortcuts/modifierUtils"
import { isConnectionNode } from "../connection/connectionNodeUtils"

const TOUCH_DIRECT_DRAG_DISTANCE = 8

type ExternalImageDragNativeEvent = MouseEvent | PointerEvent

/** 判断外部图片拖拽是否由 PointerEvent 启动，用于选择后续 window 监听类型 */
function isPointerNativeEvent(event: ExternalImageDragNativeEvent): event is PointerEvent {
	return "pointerId" in event
}

/**
 * 选择工具 - 提供框选功能
 */
export class SelectionTool extends BaseTool {
	// 框选状态
	private isSelecting = false
	private toolSelectionRect: Konva.Rect | null = null
	private startPoint: { x: number; y: number } | null = null
	private isMultiSelectMode = false // 记录是否是多选模式（按住 Cmd/Ctrl）
	private pendingDirectDrag: {
		mode: "single" | "multi-selection"
		elementId: string
		startClientX: number
		startClientY: number
		pointerId?: number
		pointerType?: CanvasPointerType
		useWindowListeners: boolean
	} | null = null
	/** Alt + 鼠标左键把画布图片拖到插件窗口时的临时状态 */
	private activeExternalImageDrag: {
		originElementId: string
		imageElementIds: string[]
		lastClientX: number
		lastClientY: number
		disabledNodes: Array<{ node: Konva.Node; draggable: boolean }>
		pointerId?: number
		pointerType?: CanvasPointerType
	} | null = null
	private isViewportGestureActive = false
	private inputUnsubscribers: Array<() => void> = []
	private readonly TOOL_SELECTION_FILL = "rgba(0, 112, 255, 0.05)"
	private readonly TOOL_SELECTION_STROKE = "#3B82F6"
	private readonly TOOL_SELECTION_STROKE_WIDTH = 1

	// 边缘滚动相关
	private edgeScrollAnimationFrame: number | null = null
	private readonly EDGE_SCROLL_THRESHOLD = 50 // 边缘触发滚动的距离（像素）
	private readonly EDGE_SCROLL_SPEED = 5 // 滚动速度（像素/帧）

	constructor(options: ToolOptions) {
		super(options)

		// 绑定事件处理函数
		this.handleMouseDown = this.handleMouseDown.bind(this)
		this.handleMouseMove = this.handleMouseMove.bind(this)
		this.handleMouseUp = this.handleMouseUp.bind(this)
		this.handlePointerDown = this.handlePointerDown.bind(this)
		this.handlePointerMove = this.handlePointerMove.bind(this)
		this.handlePointerUp = this.handlePointerUp.bind(this)
		this.handlePointerCancel = this.handlePointerCancel.bind(this)
		this.handleViewportGesture = this.handleViewportGesture.bind(this)
		this.handleWindowMouseUp = this.handleWindowMouseUp.bind(this)
		this.handleWindowMouseMove = this.handleWindowMouseMove.bind(this)
		this.handleElementsDragStart = this.handleElementsDragStart.bind(this)
		this.handleElementContextMenu = this.handleElementContextMenu.bind(this)
		this.handlePendingDirectDragMove = this.handlePendingDirectDragMove.bind(this)
		this.handlePendingDirectDragEnd = this.handlePendingDirectDragEnd.bind(this)
		this.handleExternalImageDragMove = this.handleExternalImageDragMove.bind(this)
		this.handleExternalImageDragEnd = this.handleExternalImageDragEnd.bind(this)
		this.handleExternalImageDragPointerMove = this.handleExternalImageDragPointerMove.bind(this)
		this.handleExternalImageDragPointerEnd = this.handleExternalImageDragPointerEnd.bind(this)
		this.handleExternalImageDragPointerCancel =
			this.handleExternalImageDragPointerCancel.bind(this)
		this.handleExternalImageDragKeyDown = this.handleExternalImageDragKeyDown.bind(this)
	}

	/**
	 * 激活工具
	 */
	public activate(): void {
		if (this.isActive) return
		this.isActive = true

		// 禁用 stage 的拖拽功能，避免与选择工具冲突
		this.canvas.stage.draggable(false)
		this.isViewportGestureActive = this.isViewportGestureInProgress()

		this.setupEventListeners()
	}

	/**
	 * 停用工具
	 */
	public deactivate(): void {
		if (!this.isActive) return
		this.isActive = false
		this.removeEventListeners()
		this.clearToolSelectionRect()
		this.stopEdgeScroll()
		this.clearPendingDirectDrag()
		// 工具被停用时要向插件侧发送取消结束，避免插件保留 hover/drop 状态。
		this.endExternalImageDrag(undefined, { cancelled: true })

		// 注意：不恢复 draggable，因为可能由其他工具控制
	}

	/**
	 * 设置事件监听器
	 */
	private setupEventListeners(): void {
		this.inputUnsubscribers = [
			this.canvas.inputManager.on("down", this.handlePointerDown),
			this.canvas.inputManager.on("move", this.handlePointerMove),
			this.canvas.inputManager.on("up", this.handlePointerUp),
			this.canvas.inputManager.on("cancel", this.handlePointerCancel),
		]
		// 监听元素拖动开始事件，当元素开始拖动时清除框选矩形
		this.canvas.eventEmitter.on("elements:transform:dragstart", this.handleElementsDragStart)
		this.canvas.eventEmitter.on("element:contextmenu", this.handleElementContextMenu)
		this.canvas.eventEmitter.on("viewport:gesture", this.handleViewportGesture)
	}

	/**
	 * 移除事件监听器
	 */
	private removeEventListeners(): void {
		this.inputUnsubscribers.forEach((unsubscribe) => unsubscribe())
		this.inputUnsubscribers = []
		this.canvas.eventEmitter.off("elements:transform:dragstart", this.handleElementsDragStart)
		this.canvas.eventEmitter.off("element:contextmenu", this.handleElementContextMenu)
		this.canvas.eventEmitter.off("viewport:gesture", this.handleViewportGesture)
		// 移除 window 的监听器（如果存在）
		window.removeEventListener("mouseup", this.handleWindowMouseUp)
		window.removeEventListener("mousemove", this.handleWindowMouseMove)
		this.clearPendingDirectDrag()
		// 解除事件监听前统一收尾，保证 window 级拖拽监听不会泄漏。
		this.endExternalImageDrag(undefined, { cancelled: true })
	}

	private handlePointerDown(input: CanvasPointerInput): void {
		if (!this.isActive) return

		if (this.isViewportGestureInProgress()) {
			this.clearPendingDirectDrag()
			return
		}

		if (input.pointerType !== "mouse") {
			this.handleTouchDown(input)
			return
		}

		this.handleMouseDown(input.konvaEvent as Konva.KonvaEventObject<MouseEvent>)
	}

	private handlePointerMove(input: CanvasPointerInput): void {
		if (!this.isActive) return

		if (input.activePointerCount > 1 || this.isViewportGestureInProgress()) {
			this.clearPendingDirectDrag()
			// 多指/视口手势接管时，外部图片拖拽不再可信，按取消处理。
			this.endExternalImageDrag(input.nativeEvent, { cancelled: true })
			this.cancelSelectionInteraction()
			return
		}

		this.handlePendingDirectDragInput(input)

		if (input.pointerType !== "touch") {
			this.handleMouseMove()
		}
	}

	private handlePointerUp(input: CanvasPointerInput): void {
		if (!this.isActive) return

		if (input.pointerType === "touch") {
			this.clearPendingDirectDrag()
			return
		}

		this.handleMouseUp()
	}

	private handlePointerCancel(): void {
		if (!this.isActive) return
		this.clearPendingDirectDrag()
		// 浏览器或输入系统取消 pointer 时，同步通知插件侧退出拖拽态。
		this.endExternalImageDrag(undefined, { cancelled: true })
		this.cancelSelectionInteraction()
	}

	private handleTouchDown(input: CanvasPointerInput): void {
		if (this.isViewportGestureInProgress()) {
			this.clearPendingDirectDrag()
			return
		}

		if (this.canvas.eraserManager.getErasingElementId()) {
			return
		}

		if (input.activePointerCount !== 1) {
			this.clearPendingDirectDrag()
			return
		}

		const clickedNode = input.target

		if (isConnectionNode(clickedNode)) {
			return
		}

		if (getNameLabelElementIdFromNode(clickedNode)) {
			return
		}

		if (this.isDecoratorNode(clickedNode)) {
			return
		}

		const elementId = resolveManagedElementIdFromKonvaNode(clickedNode, this.canvas)
		const isMultiSelect = this.isMultiSelectInput(input)
		const isValidElement = this.isValidElementNode(clickedNode)
		const elementData = elementId
			? this.canvas.elementManager.getElementData(elementId)
			: undefined
		const allowModifierDeselect =
			isMultiSelect &&
			this.isElementHitTargetNode(clickedNode) &&
			elementId !== undefined &&
			this.canvas.selectionManager.isSelected(elementId) &&
			!this.canvas.permissionManager.canSelect(elementData)

		if (isValidElement || allowModifierDeselect) {
			if (elementId) {
				if (isMultiSelect) {
					this.canvas.selectionManager.toggle(elementId)
					this.clearPendingDirectDrag()
					return
				}

				this.canvas.connectionManager.deselectConnection()
				const wasSelected = this.canvas.selectionManager.isSelected(elementId)
				if (!wasSelected) {
					this.canvas.selectionManager.replaceSelection([elementId])
					this.armPendingDirectDrag(input.nativeEvent, elementId, {
						pointerId: input.pointerId,
						pointerType: input.pointerType,
					})
				} else if (this.canvas.selectionManager.getSelectionCount() > 1) {
					this.armPendingMultiSelectionDrag(input.nativeEvent, elementId, {
						pointerId: input.pointerId,
						pointerType: input.pointerType,
					})
				} else {
					this.armPendingDirectDrag(input.nativeEvent, elementId, {
						pointerId: input.pointerId,
						pointerType: input.pointerType,
					})
				}
			}
			return
		}

		if (this.isTransformerHit(clickedNode)) {
			return
		}

		if (clickedNode.name() === "multi-selection-proxy") {
			if (this.handleTouchMultiSelectionProxyDown(input, isMultiSelect)) {
				return
			}
		}

		if (
			CropRenderer.isCropOverlayNode(clickedNode) ||
			ExtendRenderer.isExtendOverlayNode(clickedNode)
		) {
			return
		}

		// 触屏空白拖动交给 ViewportController 平移，不进入 PC 框选流程。
		this.clearPendingDirectDrag()
		if (!isMultiSelect) {
			this.canvas.connectionManager.deselectConnection()
			this.canvas.selectionManager.deselectAll()
		}
	}

	private handleTouchMultiSelectionProxyDown(
		input: CanvasPointerInput,
		isMultiSelect: boolean,
	): boolean {
		const elementId = pickSelectedElementIdAtStagePointer(this.canvas, input.stage)
		if (elementId) {
			if (!isMultiSelect) {
				this.armPendingMultiSelectionDrag(input.nativeEvent, elementId, {
					pointerId: input.pointerId,
					pointerType: input.pointerType,
				})
			}
			return true
		}

		this.clearPendingDirectDrag()
		if (!isMultiSelect) {
			this.canvas.connectionManager.deselectConnection()
			this.canvas.selectionManager.deselectAll()
		}
		return true
	}

	/**
	 * 处理 window 的 mouseup 事件
	 * 确保即使鼠标移出浏览器窗口后松开也能捕获到，清理框选状态
	 */
	private handleWindowMouseUp(): void {
		if (this.isSelecting) {
			// 移除 window 监听器
			window.removeEventListener("mouseup", this.handleWindowMouseUp)
			window.removeEventListener("mousemove", this.handleWindowMouseMove)
			// 停止边缘滚动
			this.stopEdgeScroll()
			// 清理框选状态
			this.clearToolSelectionRect()
			this.isSelecting = false
			// 发出框选结束事件
			this.canvas.eventEmitter.emit({ type: "selection:end", data: undefined })
			this.startPoint = null
			this.isMultiSelectMode = false
		}
	}

	/**
	 * 处理 window 的 mousemove 事件
	 * 确保即使鼠标移动到其他悬浮元素上也能继续检测边缘和更新框选矩形
	 */
	private handleWindowMouseMove(e: MouseEvent): void {
		if (!this.isSelecting || !this.startPoint || !this.toolSelectionRect) {
			return
		}

		// 获取 stage 容器的位置
		const container = this.canvas.stage.container()
		const rect = container.getBoundingClientRect()

		// 将屏幕坐标转换为相对于 stage 容器的坐标
		const stageX = e.clientX - rect.left
		const stageY = e.clientY - rect.top

		// 创建虚拟的指针位置对象
		const pos = { x: stageX, y: stageY }

		// 检测边缘并触发滚动
		this.handleEdgeScroll(pos)

		// startPoint 已经是 layer 坐标系，直接使用
		// 将当前鼠标位置转换为 layer 本地坐标
		const layerTransform = this.canvas.contentLayer.getAbsoluteTransform().copy().invert()
		const currentLayerPos = layerTransform.point(pos)

		// 更新框选矩形（使用 layer 坐标系）
		const x = Math.min(this.startPoint.x, currentLayerPos.x)
		const y = Math.min(this.startPoint.y, currentLayerPos.y)
		const width = Math.abs(currentLayerPos.x - this.startPoint.x)
		const height = Math.abs(currentLayerPos.y - this.startPoint.y)

		this.toolSelectionRect.setAttrs({
			x,
			y,
			width,
			height,
		})

		// 实时更新框选区域内的元素选中状态
		const box = { x, y, width, height }
		this.updateSelectionFromBox(box)

		this.toolLayer.batchDraw()
	}

	/**
	 * 处理元素拖动开始事件
	 * 当元素开始拖动时，清除框选矩形，避免框选矩形干扰拖动
	 */
	private handleElementsDragStart(): void {
		if (this.isSelecting) {
			// 移除 window 监听器
			window.removeEventListener("mouseup", this.handleWindowMouseUp)
			window.removeEventListener("mousemove", this.handleWindowMouseMove)
			// 停止边缘滚动
			this.stopEdgeScroll()
			this.clearToolSelectionRect()
			this.isSelecting = false
			// 发出框选结束事件
			this.canvas.eventEmitter.emit({ type: "selection:end", data: undefined })
			this.startPoint = null
			this.isMultiSelectMode = false
		}
	}

	private handleElementContextMenu(): void {
		this.clearPendingDirectDrag()
	}

	private handleViewportGesture(event: { data: { active: boolean } }): void {
		this.isViewportGestureActive = event.data.active
		if (!event.data.active) {
			return
		}

		this.clearPendingDirectDrag()
		this.cancelSelectionInteraction()
		this.stopSelectedElementDrag()
		this.canvas.transformManager.cancelActiveTransformDrag()
	}

	private isViewportGestureInProgress(): boolean {
		return (
			this.isViewportGestureActive ||
			this.canvas.viewportController?.isViewportGestureActive?.() === true
		)
	}

	private stopSelectedElementDrag(): void {
		this.canvas.selectionManager.getSelectedIds().forEach((elementId) => {
			const node = this.canvas.elementManager.getElementInstance(elementId)?.getNode()
			if (node?.isDragging()) {
				node.stopDrag()
			}
		})
	}

	private cancelSelectionInteraction(): void {
		if (!this.isSelecting) {
			return
		}

		window.removeEventListener("mouseup", this.handleWindowMouseUp)
		window.removeEventListener("mousemove", this.handleWindowMouseMove)
		this.stopEdgeScroll()
		this.clearToolSelectionRect()
		this.isSelecting = false
		this.canvas.eventEmitter.emit({ type: "selection:end", data: undefined })
		this.startPoint = null
		this.isMultiSelectMode = false
	}

	private isDecoratorNode(node: Konva.Node): boolean {
		let currentNode: Konva.Node | null = node
		while (currentNode) {
			if (currentNode.name().startsWith("decorator-")) {
				return true
			}
			currentNode = currentNode.getParent()
		}
		return false
	}

	private isTransformerHit(node: Konva.Node): boolean {
		return (
			node.getClassName() === "Transformer" ||
			node.getParent()?.getClassName() === "Transformer"
		)
	}

	private isPointerInsideSelectedElementArea(pointerPos: { x: number; y: number }): boolean {
		const layerTransform = this.canvas.contentLayer.getAbsoluteTransform().copy().invert()
		const layerPos = layerTransform.point(pointerPos)
		const adapter = this.canvas.elementManager.getNodeAdapter()
		const selectedIds = this.canvas.selectionManager.getSelectedIds()

		return selectedIds.some((elementId) => {
			const bounds = adapter.getElementBounds(elementId)
			if (!bounds) {
				return false
			}

			return (
				layerPos.x >= bounds.x &&
				layerPos.x <= bounds.x + bounds.width &&
				layerPos.y >= bounds.y &&
				layerPos.y <= bounds.y + bounds.height
			)
		})
	}

	/**
	 * 处理鼠标按下事件
	 */
	private handleMouseDown(e: Konva.KonvaEventObject<MouseEvent>): void {
		if (this.canvas.eraserManager.getErasingElementId()) {
			return
		}

		// 右键点击时不触发框选
		if (e.evt.button === 2) {
			return
		}

		const clickedNode = e.target

		if (isConnectionNode(clickedNode)) {
			return
		}

		if (getNameLabelElementIdFromNode(clickedNode)) {
			return
		}

		// 检查是否点击了装饰性元素（包括按钮本身或其父节点）
		let decoratorNodeName: string | undefined
		let currentNode: Konva.Node | null = clickedNode
		while (currentNode) {
			if (currentNode.name().startsWith("decorator-")) {
				decoratorNodeName = currentNode.name()
				break
			}
			currentNode = currentNode.getParent()
		}

		const elementId = resolveManagedElementIdFromKonvaNode(clickedNode, this.canvas)
		const isMultiSelect = isMultiSelectEvent(e.evt)
		const isValidElement = this.isValidElementNode(clickedNode)
		const elementData = elementId
			? this.canvas.elementManager.getElementData(elementId)
			: undefined
		// 多选：若元素因权限等原因不可被「新选中」，仍应允许对已选中项 toggle 取消选中
		const allowModifierDeselect =
			isMultiSelect &&
			this.isElementHitTargetNode(clickedNode) &&
			elementId !== undefined &&
			this.canvas.selectionManager.isSelected(elementId) &&
			!this.canvas.permissionManager.canSelect(elementData)

		const isTransformerHit =
			clickedNode.getClassName() === "Transformer" ||
			clickedNode.getParent()?.getClassName() === "Transformer"
		const isCropOverlayHit = CropRenderer.isCropOverlayNode(clickedNode)
		const isExtendOverlayHit = ExtendRenderer.isExtendOverlayNode(clickedNode)

		if (decoratorNodeName) {
			return
		}

		// 检查是否点击了图片元素，检查是否向外拖拽图片元素
		if (
			elementId &&
			this.tryStartExternalImageDrag(e.evt, elementId, {
				cancelBubble: () => {
					e.cancelBubble = true
				},
			})
		) {
			return
		}

		if (isValidElement || allowModifierDeselect) {
			if (elementId) {
				if (isMultiSelect) {
					// 多选模式：切换选中状态
					this.canvas.selectionManager.toggle(elementId)
				} else {
					this.canvas.connectionManager.deselectConnection()
					// 单选模式：如果点击的不是已选中的元素，选中它
					// 如果点击的是已选中的元素，保持选中（允许拖拽）
					const wasSelected = this.canvas.selectionManager.isSelected(elementId)
					if (!wasSelected) {
						this.canvas.selectionManager.replaceSelection([elementId])
						this.armPendingDirectDrag(e.evt, elementId)
					} else if (this.canvas.selectionManager.getSelectionCount() > 1) {
						this.armPendingMultiSelectionDrag(e.evt, elementId)
					}
				}
			}
			return
		}

		// 检查是否点击了 Transformer 或其子元素（如 anchor）
		// 如果是，则不做任何处理，让 Transformer 处理事件
		if (isTransformerHit) {
			return
		}

		// 命中多选代理矩形时，区分“元素区域拖拽”和“框内空白取消选中”
		if (clickedNode.name() === "multi-selection-proxy") {
			const pos = this.canvas.stage.getPointerPosition()
			// 代理矩形自身不对应元素，需要按指针位置反查真正命中的已选元素。
			const selectedElementId = pos
				? pickSelectedElementIdAtStagePointer(this.canvas, pos)
				: undefined
			if (
				selectedElementId &&
				this.tryStartExternalImageDrag(e.evt, selectedElementId, {
					cancelBubble: () => {
						e.cancelBubble = true
					},
				})
			) {
				return
			}
			if (pos && this.isPointerInsideSelectedElementArea(pos)) {
				return
			}

			if (!isMultiSelect) {
				this.canvas.connectionManager.deselectConnection()
				this.canvas.selectionManager.deselectAll()
			}
			return
		}

		// 检查是否点击了裁剪 overlay，若是则不做任何处理，避免触发选中/取消选中导致退出裁剪模式
		if (isCropOverlayHit) {
			return
		}

		if (isExtendOverlayHit) {
			return
		}

		// 点击空白区域，开始框选
		const pos = this.canvas.stage.getPointerPosition()
		if (!pos) return

		// 清空选中（如果没有按住 Cmd/Ctrl）
		this.isMultiSelectMode = isMultiSelect // 记录多选模式
		if (!isMultiSelect) {
			this.canvas.connectionManager.deselectConnection()
			this.canvas.selectionManager.deselectAll()
		}
		this.clearPendingDirectDrag()

		this.isSelecting = true
		// 发出框选开始事件
		this.canvas.eventEmitter.emit({ type: "selection:start", data: undefined })
		// 转换为 layer 本地坐标，存储相对于画布的起点
		const layerTransform = this.toolLayer.getAbsoluteTransform().copy().invert()
		const layerPos = layerTransform.point(pos)
		// 存储 layer 坐标系中的起点，这样即使视口移动，起点在画布上的位置也不会改变
		this.startPoint = { x: layerPos.x, y: layerPos.y }

		this.toolSelectionRect = new Konva.Rect({
			x: layerPos.x,
			y: layerPos.y,
			width: 0,
			height: 0,
			fill: this.TOOL_SELECTION_FILL,
			stroke: this.TOOL_SELECTION_STROKE,
			strokeWidth: this.TOOL_SELECTION_STROKE_WIDTH / this.canvas.stage.scaleX(), // 调整描边宽度，使其在任何缩放下都保持一致
			listening: false,
			name: "selection-tool-rect",
		})

		this.toolLayer.add(this.toolSelectionRect)
		this.toolSelectionRect.moveToTop()

		// 监听 window 的 mouseup 和 mousemove 事件
		// 确保即使鼠标移出浏览器窗口或移动到其他元素上也能捕获到
		window.addEventListener("mouseup", this.handleWindowMouseUp)
		window.addEventListener("mousemove", this.handleWindowMouseMove)
	}

	/**
	 * 处理鼠标移动事件
	 */
	private handleMouseMove(): void {
		if (this.canvas.eraserManager.getErasingElementId()) {
			return
		}

		if (!this.isSelecting || !this.startPoint || !this.toolSelectionRect) {
			return
		}

		const pos = this.canvas.stage.getPointerPosition()
		if (!pos) return

		// 检测边缘并触发滚动
		this.handleEdgeScroll(pos)

		// startPoint 已经是 layer 坐标系，直接使用
		// 将当前鼠标位置转换为 layer 本地坐标
		const layerTransform = this.toolLayer.getAbsoluteTransform().copy().invert()
		const currentLayerPos = layerTransform.point(pos)

		// 更新框选矩形（使用 layer 坐标系）
		const x = Math.min(this.startPoint.x, currentLayerPos.x)
		const y = Math.min(this.startPoint.y, currentLayerPos.y)
		const width = Math.abs(currentLayerPos.x - this.startPoint.x)
		const height = Math.abs(currentLayerPos.y - this.startPoint.y)

		this.toolSelectionRect.setAttrs({
			x,
			y,
			width,
			height,
		})

		// 实时更新框选区域内的元素选中状态
		const box = { x, y, width, height }
		this.updateSelectionFromBox(box)

		this.toolLayer.batchDraw()
	}

	/**
	 * 处理鼠标释放事件
	 */
	private handleMouseUp(): void {
		this.clearPendingDirectDrag()
		// 移除 window 监听器
		window.removeEventListener("mouseup", this.handleWindowMouseUp)
		window.removeEventListener("mousemove", this.handleWindowMouseMove)
		// 停止边缘滚动
		this.stopEdgeScroll()

		if (this.canvas.eraserManager.getErasingElementId()) {
			return
		}

		if (!this.isSelecting || !this.startPoint || !this.toolSelectionRect) {
			return
		}

		// 清理
		this.clearToolSelectionRect()
		this.isSelecting = false
		// 发出框选结束事件
		this.canvas.eventEmitter.emit({ type: "selection:end", data: undefined })
		this.startPoint = null
		this.isMultiSelectMode = false
	}

	/**
	 * 尝试开始外部图片拖拽
	 *
	 * 入口只接受 Alt + 鼠标左键，避免和画布内正常移动/多选快捷键互相抢事件。
	 * @param event - 鼠标/指针事件
	 * @param originElementId - 拖拽起始元素 ID
	 * @param options - 选项
	 * @returns 是否成功开始拖拽
	 */
	private tryStartExternalImageDrag(
		event: ExternalImageDragNativeEvent,
		originElementId: string,
		options?: { cancelBubble?: () => void },
	): boolean {
		if (
			!event.altKey ||
			event.button !== 0 ||
			!this.canvas.permissionManager.can("sideEffect.copy")
		) {
			return false
		}

		const originElement = this.canvas.elementManager.getElementData(originElementId)
		if (
			originElement?.type !== ElementTypeEnum.Image ||
			!this.getEffectiveImageContent(originElement).src
		) {
			return false
		}

		const imageElementIds = this.getExternalImageDragElementIds(originElementId)
		if (imageElementIds.length === 0) {
			return false
		}

		// 从未选中的图片发起拖拽时，同步选中它，让画布状态和拖拽对象一致。
		if (!this.canvas.selectionManager.isSelected(originElementId)) {
			this.canvas.selectionManager.replaceSelection([originElementId])
		}

		this.startExternalImageDrag(event, {
			originElementId,
			imageElementIds,
		})
		event.preventDefault()
		options?.cancelBubble?.()
		return true
	}

	/**
	 * 获取外部图片拖拽目标元素 ID 列表
	 *
	 * 若拖拽起始元素在当前多选选区内，则尝试把选区内所有可导出的图片一起拖出；
	 * 否则只导出拖拽起始元素。最终会过滤掉非图片、无 src 的图片和重复 ID。
	 * @param originElementId - 拖拽起始元素 ID
	 * @returns 可用于外部拖拽导出的图片元素 ID 列表
	 */
	private getExternalImageDragElementIds(originElementId: string): string[] {
		const selectedIds = this.canvas.selectionManager.getSelectedIds()
		const candidateIds =
			selectedIds.length > 1 && selectedIds.includes(originElementId)
				? selectedIds
				: [originElementId]

		const imageElementIds: string[] = []
		const seen = new Set<string>()
		for (const elementId of candidateIds) {
			if (seen.has(elementId)) continue
			const element = this.canvas.elementManager.getElementData(elementId)
			if (
				element?.type !== ElementTypeEnum.Image ||
				!this.getEffectiveImageContent(element).src
			)
				continue
			seen.add(elementId)
			imageElementIds.push(elementId)
		}
		return imageElementIds
	}

	private getEffectiveImageContent(
		element: LayerElement & { type: typeof ElementTypeEnum.Image },
	) {
		return (
			(this.canvas.getEffectiveContent?.(element.id) as
				ReturnType<typeof getActiveImageContent> | undefined) ??
			getActiveImageContent(element)
		)
	}

	/**
	 * 开始外部图片拖拽
	 *
	 * 这里不直接把文件传给插件，只广播 start/move/end 事件。
	 * PluginPanel 会负责判断是否进入 iframe、生成拖拽预览和最终解析图片文件。
	 * @param event - 鼠标/指针事件
	 * @param options - 选项
	 * @param options.originElementId - 拖拽起始元素 ID
	 * @param options.imageElementIds - 可用于外部拖拽导出的图片元素 ID 列表
	 */
	private startExternalImageDrag(
		event: ExternalImageDragNativeEvent,
		options: { originElementId: string; imageElementIds: string[] },
	): void {
		this.endExternalImageDrag(undefined, { cancelled: true })
		this.clearPendingDirectDrag()
		this.cancelSelectionInteraction()

		this.activeExternalImageDrag = {
			originElementId: options.originElementId,
			imageElementIds: options.imageElementIds,
			lastClientX: event.clientX,
			lastClientY: event.clientY,
			// 外部拖拽期间禁用 Konva 自身拖拽，避免同一次鼠标动作同时移动画布元素。
			disabledNodes: this.disableExternalImageDragNodes(options.imageElementIds),
			pointerId: isPointerNativeEvent(event) ? event.pointerId : undefined,
			pointerType: isPointerNativeEvent(event)
				? event.pointerType === "pen" || event.pointerType === "touch"
					? event.pointerType
					: "mouse"
				: "mouse",
		}

		const payload = this.getExternalImageDragPayload(event, false)
		if (!payload) {
			this.activeExternalImageDrag = null
			return
		}

		this.canvas.eventEmitter.emit({
			type: "image:external-drag:start",
			data: payload,
		})
		this.addExternalImageDragWindowListeners(event)
	}

	/**
	 * 注册外部图片拖拽期间的 window 监听。
	 *
	 * PointerEvent 启动时继续监听 pointer 系列事件，避免 pointerdown preventDefault 后
	 * 浏览器不再派发兼容 mousemove/mouseup，导致插件面板收不到拖拽移动和释放。
	 */
	private addExternalImageDragWindowListeners(event: ExternalImageDragNativeEvent): void {
		if (isPointerNativeEvent(event)) {
			window.addEventListener("pointermove", this.handleExternalImageDragPointerMove)
			window.addEventListener("pointerup", this.handleExternalImageDragPointerEnd)
			window.addEventListener("pointercancel", this.handleExternalImageDragPointerCancel)
		} else {
			window.addEventListener("mousemove", this.handleExternalImageDragMove)
			window.addEventListener("mouseup", this.handleExternalImageDragEnd)
		}
		window.addEventListener("keydown", this.handleExternalImageDragKeyDown)
	}

	/** 跟踪窗口级 mousemove/pointermove，并把当前指针位置同步给插件面板 */
	private handleExternalImageDragMove(event: ExternalImageDragNativeEvent): void {
		if (!this.activeExternalImageDrag) return
		if (event.buttons === 0) {
			this.endExternalImageDrag(event)
			return
		}

		const payload = this.getExternalImageDragPayload(event, false)
		if (!payload) return
		event.preventDefault()
		this.canvas.eventEmitter.emit({
			type: "image:external-drag:move",
			data: payload,
		})
	}

	/** 鼠标释放时结束外部图片拖拽 */
	private handleExternalImageDragEnd(event: MouseEvent): void {
		this.endExternalImageDrag(event)
	}

	/** 校验当前 pointer 事件是否属于正在进行的外部图片拖拽 */
	private isActiveExternalImagePointer(event: PointerEvent): boolean {
		const pointerId = this.activeExternalImageDrag?.pointerId
		return pointerId === undefined || pointerId === event.pointerId
	}

	/** PointerEvent 模式下跟踪窗口级 pointermove，避免 preventDefault 后丢失 mousemove。 */
	private handleExternalImageDragPointerMove(event: PointerEvent): void {
		if (!this.isActiveExternalImagePointer(event)) return
		this.handleExternalImageDragMove(event)
	}

	/** PointerEvent 模式下结束外部图片拖拽 */
	private handleExternalImageDragPointerEnd(event: PointerEvent): void {
		if (!this.isActiveExternalImagePointer(event)) return
		this.endExternalImageDrag(event)
	}

	/** PointerEvent 被浏览器取消时，按取消拖拽收尾 */
	private handleExternalImageDragPointerCancel(event: PointerEvent): void {
		if (!this.isActiveExternalImagePointer(event)) return
		this.endExternalImageDrag(event, { cancelled: true })
	}

	/** Escape 取消外部图片拖拽，插件侧会收到 cancelled=true */
	private handleExternalImageDragKeyDown(event: KeyboardEvent): void {
		if (event.key !== "Escape") return
		this.endExternalImageDrag(undefined, { cancelled: true })
	}

	/**
	 * 结束外部图片拖拽
	 *
	 * 无论正常 drop 还是取消，都先恢复被临时禁用的 Konva draggable，
	 * 再移除 window 监听，最后把 end 事件发给 PluginPanel 做落点判定。
	 * @param event - 鼠标/指针事件
	 * @param options - 选项
	 * @param options.cancelled - 是否取消拖拽
	 */
	private endExternalImageDrag(
		event?: ExternalImageDragNativeEvent | CanvasNativePointerEvent,
		options?: { cancelled?: boolean },
	): void {
		if (!this.activeExternalImageDrag) return
		const payload = this.getExternalImageDragPayload(event, Boolean(options?.cancelled))
		this.restoreExternalImageDragNodes()
		this.activeExternalImageDrag = null
		window.removeEventListener("mousemove", this.handleExternalImageDragMove)
		window.removeEventListener("mouseup", this.handleExternalImageDragEnd)
		window.removeEventListener("pointermove", this.handleExternalImageDragPointerMove)
		window.removeEventListener("pointerup", this.handleExternalImageDragPointerEnd)
		window.removeEventListener("pointercancel", this.handleExternalImageDragPointerCancel)
		window.removeEventListener("keydown", this.handleExternalImageDragKeyDown)
		if (!payload) return
		this.canvas.eventEmitter.emit({
			type: "image:external-drag:end",
			data: payload,
		})
	}

	/**
	 * 临时禁用参与外部拖拽的图片节点拖拽能力。
	 *
	 * 返回原始 draggable 状态，便于结束时精确恢复，而不是简单全部设回 true。
	 */
	private disableExternalImageDragNodes(
		elementIds: string[],
	): Array<{ node: Konva.Node; draggable: boolean }> {
		return elementIds
			.map((elementId) => this.canvas.elementManager.getElementInstance(elementId)?.getNode())
			.filter((node): node is Konva.Node => Boolean(node))
			.map((node) => {
				const draggable = node.draggable()
				node.draggable(false)
				return { node, draggable }
			})
	}

	/** 恢复外部拖拽开始前记录的 Konva draggable 状态 */
	private restoreExternalImageDragNodes(): void {
		const disabledNodes = this.activeExternalImageDrag?.disabledNodes ?? []
		disabledNodes.forEach(({ node, draggable }) => {
			node.draggable(draggable)
		})
	}

	/**
	 * 生成外部图片拖拽事件载荷（当前拖拽状态 + 事件坐标）。
	 *
	 * cancelled=true 且没有事件对象时，会沿用最后一次记录的窗口坐标，
	 * 让插件侧仍能用一致的数据完成收尾。
	 */
	private getExternalImageDragPayload(
		event: ExternalImageDragNativeEvent | CanvasNativePointerEvent | undefined,
		cancelled: boolean,
	) {
		const active = this.activeExternalImageDrag
		if (!active) return null

		const client = event ? getClientPointFromNativeEvent(event) : null
		if (client) {
			active.lastClientX = client.x
			active.lastClientY = client.y
		}
		return {
			originElementId: active.originElementId,
			imageElementIds: active.imageElementIds,
			clientX: client?.x ?? active.lastClientX,
			clientY: client?.y ?? active.lastClientY,
			cancelled,
		}
	}

	private armPendingDirectDrag(
		event: CanvasNativePointerEvent,
		elementId: string,
		options?: { pointerId?: number; pointerType?: CanvasPointerType },
	): void {
		this.clearPendingDirectDrag()

		const node = this.canvas.elementManager.getElementInstance(elementId)?.getNode()
		if (!node || !node.draggable() || node.isDragging()) {
			return
		}

		const client = getClientPointFromNativeEvent(event)
		if (!client) return

		const pointerType = options?.pointerType ?? this.getPointerTypeFromNativeEvent(event)
		const pointerId = options?.pointerId ?? this.getPointerIdFromNativeEvent(event)
		const useWindowListeners = pointerType === "mouse"

		this.cancelLongPressForDrag(pointerType)

		this.pendingDirectDrag = {
			mode: "single",
			elementId,
			startClientX: client.x,
			startClientY: client.y,
			pointerId,
			pointerType,
			useWindowListeners,
		}
		if (useWindowListeners) {
			window.addEventListener("mousemove", this.handlePendingDirectDragMove)
			window.addEventListener("mouseup", this.handlePendingDirectDragEnd)
		}
	}

	private armPendingMultiSelectionDrag(
		event: CanvasNativePointerEvent,
		elementId: string,
		options?: { pointerId?: number; pointerType?: CanvasPointerType },
	): void {
		this.clearPendingDirectDrag()

		const selectedIds = this.canvas.selectionManager.getSelectedIds()
		if (selectedIds.length <= 1 || !selectedIds.includes(elementId)) {
			return
		}

		const client = getClientPointFromNativeEvent(event)
		if (!client) return

		const pointerType = options?.pointerType ?? this.getPointerTypeFromNativeEvent(event)
		const pointerId = options?.pointerId ?? this.getPointerIdFromNativeEvent(event)
		const useWindowListeners = pointerType === "mouse"

		this.cancelLongPressForDrag(pointerType)

		this.canvas.transformManager.beginTransformInteractionIntent(selectedIds)
		this.pendingDirectDrag = {
			mode: "multi-selection",
			elementId,
			startClientX: client.x,
			startClientY: client.y,
			pointerId,
			pointerType,
			useWindowListeners,
		}
		if (useWindowListeners) {
			window.addEventListener("mousemove", this.handlePendingDirectDragMove)
			window.addEventListener("mouseup", this.handlePendingDirectDragEnd)
		}
	}

	private handlePendingDirectDragMove(event: MouseEvent): void {
		this.processPendingDirectDrag(event, { x: event.clientX, y: event.clientY }, event.buttons)
	}

	private handlePendingDirectDragInput(input: CanvasPointerInput): void {
		const pending = this.pendingDirectDrag
		if (!pending || pending.useWindowListeners) return
		if (pending.pointerId !== undefined && pending.pointerId !== input.pointerId) return

		if (input.activePointerCount > 1 || input.type === "cancel") {
			this.clearPendingDirectDrag()
			return
		}

		this.processPendingDirectDrag(input.nativeEvent, input.client, input.buttons)
	}

	private processPendingDirectDrag(
		event: CanvasNativePointerEvent,
		client: { x: number; y: number },
		buttons: number,
	): void {
		const pending = this.pendingDirectDrag
		if (!pending) return

		if (buttons === 0) {
			this.clearPendingDirectDrag()
			return
		}

		const distance = Math.max(
			Math.abs(client.x - pending.startClientX),
			Math.abs(client.y - pending.startClientY),
		)

		if (pending.mode === "multi-selection") {
			const dragDistance = this.getDragActivationDistance(
				this.canvas.transformManager.getMultiSelectionDragDistance(),
				pending.pointerType,
			)
			if (distance < dragDistance) {
				return
			}

			const started = this.canvas.transformManager.startMultiSelectionProxyDrag(event)
			if (started) {
				this.clearPendingDirectDrag({ keepTransformIntent: true })
			} else {
				this.clearPendingDirectDrag()
			}
			return
		}

		const node = this.canvas.elementManager.getElementInstance(pending.elementId)?.getNode()
		if (!node || !node.draggable()) {
			this.clearPendingDirectDrag()
			return
		}

		if (node.isDragging()) {
			this.clearPendingDirectDrag()
			return
		}

		const dragDistance = this.getDragActivationDistance(
			node.dragDistance(),
			pending.pointerType,
		)
		if (distance < dragDistance) {
			return
		}

		node.startDrag({ evt: event })
		this.clearPendingDirectDrag()
	}

	private handlePendingDirectDragEnd(): void {
		this.clearPendingDirectDrag()
	}

	private clearPendingDirectDrag(options?: { keepTransformIntent?: boolean }): void {
		if (!this.pendingDirectDrag) return
		const pending = this.pendingDirectDrag
		this.pendingDirectDrag = null
		if (pending.useWindowListeners) {
			window.removeEventListener("mousemove", this.handlePendingDirectDragMove)
			window.removeEventListener("mouseup", this.handlePendingDirectDragEnd)
		}
		if (pending.mode === "multi-selection" && !options?.keepTransformIntent) {
			this.canvas.transformManager.clearTransformInteractionIntent()
		}
	}

	private getDragActivationDistance(distance: number, pointerType?: CanvasPointerType): number {
		return pointerType === "touch" ? Math.max(distance, TOUCH_DIRECT_DRAG_DISTANCE) : distance
	}

	private isMultiSelectInput(input: CanvasPointerInput): boolean {
		return isMultiSelectEvent({
			metaKey: input.modifiers.meta,
			ctrlKey: input.modifiers.ctrl,
			shiftKey: input.modifiers.shift,
		})
	}

	private cancelLongPressForDrag(pointerType?: CanvasPointerType): void {
		if (pointerType === "mouse") return
		this.canvas.inputManager.cancelLongPress()
	}

	private getPointerTypeFromNativeEvent(event: CanvasNativePointerEvent): CanvasPointerType {
		if ("pointerType" in event) {
			if (event.pointerType === "touch" || event.pointerType === "pen") {
				return event.pointerType
			}
		}
		if ("touches" in event) return "touch"
		return "mouse"
	}

	private getPointerIdFromNativeEvent(event: CanvasNativePointerEvent): number | undefined {
		if ("pointerId" in event) return event.pointerId
		if ("changedTouches" in event) {
			return event.changedTouches[0]?.identifier ?? event.touches[0]?.identifier
		}
		return undefined
	}

	/**
	 * 查找框选范围内的元素
	 * @param box 框选矩形
	 */
	private findElementsInBox(box: {
		x: number
		y: number
		width: number
		height: number
	}): string[] {
		const candidateIds = this.canvas.geometryCacheManager.queryElementIdsByExpandedRect(box, 0)
		const selectedIds: string[] = []

		for (const elementId of candidateIds) {
			if (this.canvas.elementManager.findParentIdForElement(elementId)) {
				continue
			}

			const element = this.canvas.elementManager.getElementData(elementId)
			if (!element) {
				continue
			}

			if (this.isElementInBox(element, box)) {
				selectedIds.push(element.id)
			}
		}

		return selectedIds
	}

	private updateSelectionFromBox(box: {
		x: number
		y: number
		width: number
		height: number
	}): void {
		const selectedElementIds = this.findElementsInBox(box)
		const selectedConnectionIds = this.canvas.connectionManager.findConnectionsInBox(box)

		// 实时更新选中状态，让 Layers UI 可以看到变化
		if (selectedElementIds.length > 0) {
			this.canvas.selectionManager.selectMultiple(selectedElementIds, this.isMultiSelectMode)
		} else if (!this.isMultiSelectMode) {
			// 如果没有框选到元素且不是多选模式，清空选中
			this.canvas.selectionManager.deselectAll()
		}

		if (selectedConnectionIds.length > 0) {
			this.canvas.connectionManager.selectConnections(selectedConnectionIds, {
				append: this.isMultiSelectMode,
				autoFocus: false,
			})
		} else if (!this.isMultiSelectMode) {
			this.canvas.connectionManager.deselectConnection()
		}
	}

	/**
	 * 检查元素是否在框选范围内
	 * @param element 元素
	 * @param box 框选矩形
	 */
	private isElementInBox(
		element: LayerElement,
		box: { x: number; y: number; width: number; height: number },
	): boolean {
		const { x, y, width, height } = element

		if (x === undefined || y === undefined || width === undefined || height === undefined) {
			return false
		}

		// 使用 PermissionManager 统一判断元素是否可以被选中
		if (!this.canvas.permissionManager.canSelect(element)) {
			return false
		}

		// 检查元素是否与框选矩形相交
		const elementRight = x + width
		const elementBottom = y + height
		const boxRight = box.x + box.width
		const boxBottom = box.y + box.height

		return !(elementRight < box.x || x > boxRight || elementBottom < box.y || y > boxBottom)
	}

	/**
	 * 命中目标是否落在「可解析为画布元素」的 Konva 节点上（不含权限与是否已注册为元素的判定）
	 */
	private isElementHitTargetNode(node: Konva.Node): boolean {
		if (node === this.canvas.stage) {
			return false
		}

		if (node.getClassName() === "Layer") {
			return false
		}

		if (
			node.getClassName() === "Transformer" ||
			node.getParent()?.getClassName() === "Transformer"
		) {
			return false
		}

		if (node.name() === "selection-tool-rect") {
			return false
		}

		return true
	}

	/**
	 * 判断节点是否是有效的可选中元素
	 * @param node - Konva 节点
	 * @returns 是否是有效元素
	 */
	private isValidElementNode(node: Konva.Node): boolean {
		if (!this.isElementHitTargetNode(node)) {
			return false
		}

		const elementId = resolveManagedElementIdFromKonvaNode(node, this.canvas)

		if (!elementId) {
			return false
		}

		// 使用 PermissionManager 统一判断元素是否可以被选中
		const elementData = this.canvas.elementManager.getElementData(elementId)
		if (!this.canvas.permissionManager.canSelect(elementData)) {
			return false
		}

		return true
	}

	/**
	 * 处理边缘滚动
	 * 当鼠标接近画布边缘时，自动滚动视口
	 */
	private handleEdgeScroll(pos: { x: number; y: number }): void {
		const stageWidth = this.canvas.stage.width()
		const stageHeight = this.canvas.stage.height()
		const threshold = this.EDGE_SCROLL_THRESHOLD

		// 计算距离边缘的距离
		const distToLeft = pos.x
		const distToRight = stageWidth - pos.x
		const distToTop = pos.y
		const distToBottom = stageHeight - pos.y

		// 计算滚动方向（-1: 向左/上, 0: 不滚动, 1: 向右/下）
		// 注意：在 Konva 中，stage 向右移动（x 增大）时，视口向左移动（显示右边的内容）
		// 所以当鼠标在左边缘时，我们希望显示右边的内容，stage 应该向右移动（x 增大）
		let scrollX = 0
		let scrollY = 0

		if (distToLeft < threshold) {
			scrollX = 1 // 鼠标在左边缘，stage 向右移动（显示右边的内容）
		} else if (distToRight < threshold) {
			scrollX = -1 // 鼠标在右边缘，stage 向左移动（显示左边的内容）
		}

		if (distToTop < threshold) {
			scrollY = 1 // 鼠标在上边缘，stage 向下移动（显示下边的内容）
		} else if (distToBottom < threshold) {
			scrollY = -1 // 鼠标在下边缘，stage 向上移动（显示上边的内容）
		}

		// 如果需要在边缘滚动，启动滚动动画
		if (scrollX !== 0 || scrollY !== 0) {
			this.startEdgeScroll(scrollX, scrollY)
		} else {
			// 不在边缘，停止滚动
			this.stopEdgeScroll()
		}
	}

	/**
	 * 开始边缘滚动
	 */
	private startEdgeScroll(scrollX: number, scrollY: number): void {
		// 如果已经在滚动且方向相同，不需要重新启动
		if (this.edgeScrollAnimationFrame !== null) {
			return
		}

		const scroll = (): void => {
			if (!this.isSelecting) {
				this.stopEdgeScroll()
				return
			}

			const currentPos = this.canvas.stage.position()
			const speed = this.EDGE_SCROLL_SPEED

			const newPos = {
				x: currentPos.x + scrollX * speed,
				y: currentPos.y + scrollY * speed,
			}

			// 更新视口位置
			this.canvas.viewportController.setPosition(newPos)

			// 更新框选矩形（因为视口移动了，需要重新计算框选矩形）
			// startPoint 已经是 layer 坐标系，不需要调整，但需要重新计算框选矩形
			if (this.startPoint && this.toolSelectionRect) {
				const pos = this.canvas.stage.getPointerPosition()
				if (pos) {
					// startPoint 已经是 layer 坐标系，直接使用
					// 将当前鼠标位置转换为 layer 本地坐标
					const layerTransform = this.toolLayer.getAbsoluteTransform().copy().invert()
					const currentLayerPos = layerTransform.point(pos)

					// 更新框选矩形
					const x = Math.min(this.startPoint.x, currentLayerPos.x)
					const y = Math.min(this.startPoint.y, currentLayerPos.y)
					const width = Math.abs(currentLayerPos.x - this.startPoint.x)
					const height = Math.abs(currentLayerPos.y - this.startPoint.y)

					this.toolSelectionRect.setAttrs({
						x,
						y,
						width,
						height,
					})
					this.updateSelectionFromBox({ x, y, width, height })

					this.toolLayer.batchDraw()
				}
			}

			// 继续滚动
			this.edgeScrollAnimationFrame = requestAnimationFrame(scroll)
		}

		// 开始滚动
		this.edgeScrollAnimationFrame = requestAnimationFrame(scroll)
	}

	/**
	 * 停止边缘滚动
	 */
	private stopEdgeScroll(): void {
		if (this.edgeScrollAnimationFrame !== null) {
			cancelAnimationFrame(this.edgeScrollAnimationFrame)
			this.edgeScrollAnimationFrame = null
		}
	}

	/**
	 * 清除框选矩形
	 */
	private clearToolSelectionRect(): void {
		if (this.toolSelectionRect) {
			this.toolSelectionRect.destroy()
			this.toolSelectionRect = null
			this.toolLayer.batchDraw()
		}
	}

	/**
	 * 获取工具元数据
	 */
	public getMetadata() {
		return {
			name: "Selection Tool",
			cursor: "default" as const,
			isTemporary: false,
		}
	}

	/**
	 * 销毁工具
	 */
	public destroy(): void {
		this.deactivate()
		this.clearToolSelectionRect()
		this.stopEdgeScroll()
	}
}
