import type Konva from "konva"
import type { Canvas } from "../Canvas"
import { ElementTypeEnum, type ImageElement } from "../types"
import { isCanvasUIComponentNode } from "../utils/domGuards"
import { calculateNodesRect } from "../utils/utils"
import { EraserRenderer, type EraserPoint, type EraserStroke } from "./EraserRenderer"

export const MIN_RADIUS = 8
export const MAX_RADIUS = 120

function medianRadius(min: number, max: number): number {
	return Math.round((min + max) / 2)
}

/** 与进入橡皮会话时的默认半径一致，供无 Canvas 时的 UI 初值使用 */
export function getEraserRadiusDefault(): number {
	return medianRadius(MIN_RADIUS, MAX_RADIUS)
}

/**
 * 橡皮擦管理器
 * 负责橡皮擦会话状态、右侧面板同步、撤销栈和进入/退出生命周期。
 */
export class EraserManager {
	private canvas: Canvas

	private erasingElementId: string | null = null
	private radius = medianRadius(MIN_RADIUS, MAX_RADIUS)
	private strokes: EraserStroke[] = []
	private originalNodeIndex: number | undefined = undefined
	private eraserRenderer: EraserRenderer | null = null

	private escapeHandler?: () => void
	private elementSelectHandler?: (event: { data: { elementIds: string[] } }) => void
	private elementDeselectHandler?: () => void
	private viewportScaleHandler?: () => void
	private viewportPanHandler?: () => void
	private elementUpdatedHandler?: (event: { data: { elementId: string } }) => void
	private elementRerenderedHandler?: (event: { data: { elementId: string } }) => void
	private stageMouseMoveHandler?: () => void
	private stageMouseDownHandler?: (event: Konva.KonvaEventObject<MouseEvent>) => void
	private stageMouseUpHandler?: () => void
	private containerMouseEnterHandler?: (event: MouseEvent) => void
	private containerMouseLeaveHandler?: (event: MouseEvent) => void
	private documentPointerMoveHandler?: (event: PointerEvent) => void
	private windowBlurHandler?: () => void
	private isPointerDown = false
	private isCursorVisible = false

	constructor(options: { canvas: Canvas }) {
		this.canvas = options.canvas
		this.setupEventListeners()
	}

	private setupEventListeners(): void {
		this.escapeHandler = () => {
			if (this.erasingElementId) {
				this.cancelEraser()
			}
		}
		this.canvas.eventEmitter.on("keyboard:escape", this.escapeHandler)

		this.elementSelectHandler = () => {
			if (this.erasingElementId) {
				this.exitEraserMode(true)
			}
		}
		this.canvas.eventEmitter.on("element:select", this.elementSelectHandler)

		this.elementDeselectHandler = () => {
			if (this.erasingElementId) {
				this.exitEraserMode(true)
			}
		}
		this.canvas.eventEmitter.on("element:deselect", this.elementDeselectHandler)
	}

	private removeEventListeners(): void {
		if (this.escapeHandler) {
			this.canvas.eventEmitter.off("keyboard:escape", this.escapeHandler)
			this.escapeHandler = undefined
		}
		if (this.elementSelectHandler) {
			this.canvas.eventEmitter.off("element:select", this.elementSelectHandler)
			this.elementSelectHandler = undefined
		}
		if (this.elementDeselectHandler) {
			this.canvas.eventEmitter.off("element:deselect", this.elementDeselectHandler)
			this.elementDeselectHandler = undefined
		}
	}

	private setupPositionListeners(): void {
		this.viewportScaleHandler = () => this.syncPresentation()
		this.viewportPanHandler = () => this.syncPresentation()
		this.elementUpdatedHandler = ({ data }) => {
			if (data.elementId === this.erasingElementId) {
				this.syncPresentation()
			}
		}
		this.elementRerenderedHandler = ({ data }) => {
			if (data.elementId === this.erasingElementId) {
				this.syncPresentation()
			}
		}
		this.stageMouseMoveHandler = () => {
			if (!this.erasingElementId) return
			if (!this.isCursorVisible) return
			this.canvas.cursorManager.updateEraserCursorFromStagePointer()
			this.syncStrokeWithPointer()
		}
		this.stageMouseDownHandler = (event) => {
			if (!this.erasingElementId || event.evt.button !== 0 || !this.isCursorVisible) return
			this.isPointerDown = true
			this.canvas.cursorManager.updateEraserCursorFromStagePointer()
			this.syncStrokeWithPointer()
		}
		this.stageMouseUpHandler = () => {
			if (!this.erasingElementId) return
			this.isPointerDown = false
			this.eraserRenderer?.finishStroke()
		}
		this.containerMouseEnterHandler = (event) => {
			if (!this.erasingElementId || !this.isInteractiveCanvasPointerTarget(event.target))
				return
			this.showCursorForNativePointerEvent(event)
			this.syncStrokeWithPointer()
		}
		this.containerMouseLeaveHandler = (event: MouseEvent) => {
			this.hideCursorAndResetInteraction(event)
		}
		this.documentPointerMoveHandler = (event) => {
			if (!this.erasingElementId) return
			if (!this.isInteractiveCanvasPointerTarget(event.target)) {
				this.hideCursorAndResetInteraction(event)
				return
			}
			this.showCursorForNativePointerEvent(event)
			this.syncStrokeWithPointer()
		}
		this.windowBlurHandler = () => {
			this.hideCursorAndResetInteraction()
		}

		this.canvas.eventEmitter.on("viewport:scale", this.viewportScaleHandler)
		this.canvas.eventEmitter.on("viewport:pan", this.viewportPanHandler)
		this.canvas.eventEmitter.on("element:updated", this.elementUpdatedHandler)
		this.canvas.eventEmitter.on("element:rerendered", this.elementRerenderedHandler)
		this.canvas.stage.on("mousemove", this.stageMouseMoveHandler)
		this.canvas.stage.on("mousedown", this.stageMouseDownHandler)
		this.canvas.stage.on("mouseup", this.stageMouseUpHandler)
		this.canvas.container.addEventListener("mouseenter", this.containerMouseEnterHandler)
		this.canvas.container.addEventListener("mouseleave", this.containerMouseLeaveHandler)
		document.addEventListener("pointermove", this.documentPointerMoveHandler, true)
		window.addEventListener("blur", this.windowBlurHandler)
	}

	private removePositionListeners(): void {
		if (this.viewportScaleHandler) {
			this.canvas.eventEmitter.off("viewport:scale", this.viewportScaleHandler)
			this.viewportScaleHandler = undefined
		}
		if (this.viewportPanHandler) {
			this.canvas.eventEmitter.off("viewport:pan", this.viewportPanHandler)
			this.viewportPanHandler = undefined
		}
		if (this.elementUpdatedHandler) {
			this.canvas.eventEmitter.off("element:updated", this.elementUpdatedHandler)
			this.elementUpdatedHandler = undefined
		}
		if (this.elementRerenderedHandler) {
			this.canvas.eventEmitter.off("element:rerendered", this.elementRerenderedHandler)
			this.elementRerenderedHandler = undefined
		}
		if (this.stageMouseMoveHandler) {
			this.canvas.stage.off("mousemove", this.stageMouseMoveHandler)
			this.stageMouseMoveHandler = undefined
		}
		if (this.stageMouseDownHandler) {
			this.canvas.stage.off("mousedown", this.stageMouseDownHandler)
			this.stageMouseDownHandler = undefined
		}
		if (this.stageMouseUpHandler) {
			this.canvas.stage.off("mouseup", this.stageMouseUpHandler)
			this.stageMouseUpHandler = undefined
		}
		if (this.containerMouseEnterHandler) {
			this.canvas.container.removeEventListener("mouseenter", this.containerMouseEnterHandler)
			this.containerMouseEnterHandler = undefined
		}
		if (this.containerMouseLeaveHandler) {
			this.canvas.container.removeEventListener("mouseleave", this.containerMouseLeaveHandler)
			this.containerMouseLeaveHandler = undefined
		}
		if (this.documentPointerMoveHandler) {
			document.removeEventListener("pointermove", this.documentPointerMoveHandler, true)
			this.documentPointerMoveHandler = undefined
		}
		if (this.windowBlurHandler) {
			window.removeEventListener("blur", this.windowBlurHandler)
			this.windowBlurHandler = undefined
		}
	}

	private emitEraserPosition(): void {
		if (!this.erasingElementId) return

		const adapter = this.canvas.elementManager.getNodeAdapter()
		const nodes = adapter.getNodesForTransform([this.erasingElementId])

		if (nodes.length === 0) {
			this.canvas.eventEmitter.emit({
				type: "eraser:position",
				data: { elementId: this.erasingElementId, boundingRect: null },
			})
			return
		}

		const boundingRect = calculateNodesRect(
			nodes,
			this.canvas.stage,
			this.canvas.elementManager,
		)

		this.canvas.eventEmitter.emit({
			type: "eraser:position",
			data: { elementId: this.erasingElementId, boundingRect },
		})
	}

	private emitSessionUpdate(): void {
		if (!this.erasingElementId) return

		this.canvas.eventEmitter.emit({
			type: "eraser:sessionUpdate",
			data: {
				elementId: this.erasingElementId,
				radius: this.radius,
				strokeCount: this.strokes.length,
				canUndo: this.canUndo(),
			},
		})
	}

	private syncPresentation(): void {
		this.emitEraserPosition()
		this.eraserRenderer?.syncTransform()
		this.canvas.cursorManager.syncEraserCursorTransform()
		if (this.isCursorVisible) {
			this.canvas.cursorManager.updateEraserCursorFromStagePointer()
		}
	}

	private isInteractiveCanvasPointerTarget(target: EventTarget | null): boolean {
		if (!(target instanceof Node)) return false
		if (!this.canvas.container.contains(target)) return false
		return !isCanvasUIComponentNode(target, { stopAt: this.canvas.container })
	}

	private showCursorForNativePointerEvent(event: MouseEvent | PointerEvent): void {
		if (!this.erasingElementId) return
		this.syncPointerDownFromNativeEvent(event)
		this.canvas.stage.setPointersPositions(event)
		this.canvas.cursorManager.showEraserCursor()
		this.canvas.cursorManager.updateEraserCursorFromStagePointer()
		this.isCursorVisible = true
	}

	private syncPointerDownFromNativeEvent(event: MouseEvent | PointerEvent): void {
		this.isPointerDown = (event.buttons & 1) === 1
	}

	private hideCursorAndResetInteraction(event?: MouseEvent | PointerEvent): void {
		if (!this.erasingElementId) return
		this.canvas.cursorManager.hideEraserCursor()
		const stillPrimaryDown = event ? (event.buttons & 1) === 1 : false
		if (stillPrimaryDown) {
			this.eraserRenderer?.pauseStroke()
		} else {
			this.eraserRenderer?.finishStroke()
			this.isPointerDown = false
		}
		this.isCursorVisible = false
	}

	private getCurrentLocalPointerPoint(): EraserPoint | null {
		const pointer = this.canvas.stage.getPointerPosition()
		if (!pointer) return null
		return this.eraserRenderer?.getLocalPointFromStagePointer(pointer) ?? null
	}

	private syncStrokeWithPointer(): void {
		if (!this.isPointerDown || !this.eraserRenderer) return

		const pointer = this.getCurrentLocalPointerPoint()
		if (!pointer || !this.eraserRenderer.isPointInsideBounds(pointer)) {
			this.eraserRenderer.pauseStroke()
			return
		}

		if (this.eraserRenderer.isDrawingActive()) {
			this.eraserRenderer.extendStroke(pointer)
			return
		}

		if (this.eraserRenderer.hasPendingStroke()) {
			this.eraserRenderer.resumeStroke()
			this.eraserRenderer.extendStroke(pointer)
			return
		}

		this.eraserRenderer.beginStroke(pointer)
	}

	public enterEraserMode(elementId: string): void {
		if (this.canvas.cropManager.getCroppingElementId()) {
			this.canvas.cropManager.cancelCrop()
		}

		if (this.erasingElementId && this.erasingElementId !== elementId) {
			this.exitEraserMode(true)
		}

		const elementData = this.canvas.elementManager.getElementData(elementId)
		if (!elementData || elementData.type !== ElementTypeEnum.Image) {
			return
		}

		const imageElement = elementData as ImageElement
		if ((imageElement.width ?? 0) <= 0 || (imageElement.height ?? 0) <= 0) {
			return
		}

		this.canvas.selectionManager.deselectAll()

		this.erasingElementId = elementId
		this.strokes = []
		this.isPointerDown = false
		this.isCursorVisible = false

		const { min, max } = this.getRadiusRange()
		this.radius = medianRadius(min, max)

		const elementInstance = this.canvas.elementManager.getElementInstance(elementId)
		const node = elementInstance?.getNode()
		if (node) {
			const parent = node.getParent()
			if (parent) {
				this.originalNodeIndex = parent.children?.indexOf(node) ?? -1
				node.moveToTop()
			}
		}

		this.eraserRenderer = new EraserRenderer({
			canvas: this.canvas,
			elementId,
			manager: this,
		})
		this.eraserRenderer.render()
		this.canvas.cursorManager.enterEraserMode({
			elementId,
			radius: this.radius,
		})

		this.setupPositionListeners()

		this.canvas.eventEmitter.emit({
			type: "eraser:enter",
			data: { elementId },
		})

		this.canvas.viewportController.focusOnElements([elementId], {
			animated: true,
			padding: {
				top: "5%",
				right: "5%",
				bottom: "5%",
				left: "5%",
				minRight: 325,
				minLeft: 325,
				minTop: 100,
				minBottom: 100,
			},
			selectElement: false,
			ensureFullyVisible: false,
		})

		this.canvas.container.focus()

		this.hideCursorAndResetInteraction()
		this.syncPresentation()
		this.emitSessionUpdate()
	}

	public exitEraserMode(shouldRestore: boolean): void {
		if (!this.erasingElementId) {
			return
		}

		const elementId = this.erasingElementId

		this.removePositionListeners()
		this.isPointerDown = false
		this.isCursorVisible = false

		if (this.eraserRenderer) {
			this.eraserRenderer.destroy()
			this.eraserRenderer = null
		}
		this.canvas.cursorManager.exitEraserMode()

		if (this.originalNodeIndex !== undefined) {
			const parentId = this.canvas.elementManager.findParentIdForElement(elementId)
			if (parentId) {
				this.canvas.elementManager.reorderChildrenInParentPublic(parentId)
			} else {
				this.canvas.elementManager.reorderTopLevelElementsPublic()
			}
			this.originalNodeIndex = undefined
		}

		this.erasingElementId = null
		this.strokes = []
		this.canvas.selectionManager.select(elementId, false)

		this.canvas.eventEmitter.emit({
			type: "eraser:exit",
			data: { elementId, restored: shouldRestore },
		})
	}

	public setRadius(radius: number): void {
		const nextRadius = Math.min(Math.max(Math.round(radius), MIN_RADIUS), MAX_RADIUS)
		if (nextRadius === this.radius) return
		this.radius = nextRadius
		this.canvas.cursorManager.updateEraserCursorRadius(nextRadius)
		this.emitSessionUpdate()
	}

	public getRadius(): number {
		return this.radius
	}

	public getRadiusRange(): { min: number; max: number } {
		return {
			min: MIN_RADIUS,
			max: MAX_RADIUS,
		}
	}

	public pushStroke(stroke: EraserStroke): void {
		if (!this.erasingElementId || stroke.points.length === 0) return
		this.strokes = [...this.strokes, stroke]
		this.emitSessionUpdate()
	}

	public undoLastStroke(): void {
		if (!this.erasingElementId || this.strokes.length === 0) return
		this.strokes = this.strokes.slice(0, -1)
		this.emitSessionUpdate()
	}

	public canUndo(): boolean {
		return this.strokes.length > 0
	}

	public getStrokes(): EraserStroke[] {
		return this.strokes.map((stroke) => ({
			...stroke,
			points: stroke.points.map((point) => ({ ...point })),
		}))
	}

	/**
	 * 会话内笔划引用，供 EraserRenderer 热路径单次遍历；请勿修改笔划或其 points。
	 * 外传、提交任务请使用 getStrokes() 深拷贝。
	 */
	public getStrokesForRender(): readonly EraserStroke[] {
		return this.strokes
	}

	public getSessionSnapshot() {
		return {
			elementId: this.erasingElementId,
			radius: this.radius,
			strokes: this.getStrokes(),
		}
	}

	public confirmEraser(): void {
		if (!this.erasingElementId) {
			return
		}

		// TODO: 后续在这里接入真正的擦除结果提交逻辑。
		console.log(
			`[ImageEraserTODO] ${JSON.stringify({
				elementId: this.erasingElementId,
				radius: this.radius,
				strokes: this.getStrokes(),
			})}`,
		)

		this.exitEraserMode(false)
	}

	public cancelEraser(): void {
		this.exitEraserMode(true)
	}

	public getErasingElementId(): string | null {
		return this.erasingElementId
	}

	public destroy(): void {
		this.removeEventListeners()
		if (this.erasingElementId) {
			this.exitEraserMode(true)
		}
	}
}
