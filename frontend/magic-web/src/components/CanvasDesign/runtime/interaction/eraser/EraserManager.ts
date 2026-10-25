import type { Canvas } from "../../core/Canvas"
import { ElementTypeEnum, type ImageElement } from "../../document/types"
import {
	getActiveContent,
	getActiveImageContentId,
	getContentById,
} from "../../document/elementContent"
import { isCanvasUIComponentNode } from "../../shared/dom/domGuards"
import { calculateNodesRect } from "../../shared/ids"
import {
	EraserRenderer,
	type EraserPoint,
	type EraserStroke,
	type EraserStrokeMode,
} from "./EraserRenderer"
import type { CanvasPointerInput } from "../input/index"
import { ImageEditingSession } from "../image-editing/ImageEditingSession"

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
	private erasingContentId: string | null = null
	private radius = medianRadius(MIN_RADIUS, MAX_RADIUS)
	private mode: EraserStrokeMode = "erase"
	private strokes: EraserStroke[] = []
	private redoStrokes: EraserStroke[] = []
	private eraserRenderer: EraserRenderer | null = null
	private editingSession: ImageEditingSession | null = null

	private escapeHandler?: () => void
	private elementSelectHandler?: (event: { data: { elementIds: string[] } }) => void
	private elementDeselectHandler?: () => void
	private viewportScaleHandler?: () => void
	private viewportPanHandler?: () => void
	private elementUpdatedHandler?: (event: { data: { elementId: string } }) => void
	private elementRerenderedHandler?: (event: { data: { elementId: string } }) => void
	private inputUnsubscribers: Array<() => void> = []
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
		this.canvas.eventEmitter.on("keyboard:alt:down", this.handleAltDown)
		this.canvas.eventEmitter.on("keyboard:alt:up", this.handleAltUp)
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
		this.canvas.eventEmitter.off("keyboard:alt:down", this.handleAltDown)
		this.canvas.eventEmitter.off("keyboard:alt:up", this.handleAltUp)
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

	private readonly handleAltDown = (): void => this.setMode("restore")
	private readonly handleAltUp = (): void => this.setMode("erase")

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
		this.inputUnsubscribers = [
			this.canvas.inputManager.on("down", this.handleInputPointerDown),
			this.canvas.inputManager.on("move", this.handleInputPointerMove),
			this.canvas.inputManager.on("up", this.handleInputPointerUp),
			this.canvas.inputManager.on("cancel", this.handleInputPointerCancel),
		]
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
			if (event.pointerType !== "mouse") return
			if (!this.isInteractiveCanvasPointerTarget(event.target)) {
				this.hideCursorAndResetInteraction(event)
			}
		}
		this.windowBlurHandler = () => {
			this.hideCursorAndResetInteraction()
		}

		this.canvas.eventEmitter.on("viewport:scale", this.viewportScaleHandler)
		this.canvas.eventEmitter.on("viewport:pan", this.viewportPanHandler)
		this.canvas.eventEmitter.on("element:updated", this.elementUpdatedHandler)
		this.canvas.eventEmitter.on("element:rerendered", this.elementRerenderedHandler)
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
		this.inputUnsubscribers.forEach((unsubscribe) => unsubscribe())
		this.inputUnsubscribers = []
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
		const sessionBounds = this.editingSession?.getContentBounds()
		if (sessionBounds) {
			this.canvas.eventEmitter.emit({
				type: "eraser:position",
				data: { elementId: this.erasingElementId, boundingRect: sessionBounds },
			})
			return
		}

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
				contentId: this.erasingContentId ?? undefined,
				radius: this.radius,
				strokeCount: this.strokes.length,
				canUndo: this.canUndo(),
				canRedo: this.canRedo(),
				mode: this.mode,
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

	private handleInputPointerDown = (input: CanvasPointerInput): void => {
		if (!this.erasingElementId || input.button !== 0) return

		if (input.activePointerCount > 1) {
			this.finishStrokeAndHideCursor()
			return
		}

		this.showCursorForCanvasInput(input)
		this.isPointerDown = true
		this.syncStrokeWithPointer()
	}

	private handleInputPointerMove = (input: CanvasPointerInput): void => {
		if (!this.erasingElementId) return

		if (input.activePointerCount > 1) {
			this.finishStrokeAndHideCursor()
			return
		}

		this.showCursorForCanvasInput(input)
		this.syncStrokeWithPointer()
	}

	private handleInputPointerUp = (input: CanvasPointerInput): void => {
		if (!this.erasingElementId) return

		this.showCursorForCanvasInput(input)
		this.isPointerDown = false
		this.eraserRenderer?.finishStroke()

		if (input.pointerType !== "mouse") {
			this.canvas.cursorManager.hideEraserCursor()
			this.isCursorVisible = false
		}
	}

	private handleInputPointerCancel = (): void => {
		if (!this.erasingElementId) return
		this.finishStrokeAndHideCursor()
	}

	private showCursorForCanvasInput(input: CanvasPointerInput): void {
		if (!this.erasingElementId) return
		if (input.pointerType !== "mouse" && input.nativeEvent.cancelable) {
			input.nativeEvent.preventDefault()
		}

		this.isPointerDown = (input.buttons & 1) === 1
		this.canvas.stage.setPointersPositions(input.nativeEvent)
		this.canvas.cursorManager.showEraserCursor()
		this.canvas.cursorManager.updateEraserCursorFromStagePointer()
		this.isCursorVisible = true
	}

	private finishStrokeAndHideCursor(): void {
		this.eraserRenderer?.finishStroke()
		this.isPointerDown = false
		this.canvas.cursorManager.hideEraserCursor()
		this.isCursorVisible = false
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

	public enterEraserMode(elementId: string, contentId?: string): void {
		if (
			!this.canvas.permissionManager.can("document.write") ||
			!this.canvas.permissionManager.can("sideEffect.generate")
		)
			return
		if (this.erasingElementId === elementId) return

		const elementData = this.canvas.elementManager.getElementData(elementId)
		if (!elementData || elementData.type !== ElementTypeEnum.Image) {
			return
		}

		const imageElement = elementData as ImageElement
		if (contentId && getActiveImageContentId(imageElement) !== contentId) return
		if ((imageElement.width ?? 0) <= 0 || (imageElement.height ?? 0) <= 0) {
			return
		}

		this.canvas.imageEditingCoordinator.activate({
			mode: "eraser",
			elementId,
			cancel: () => this.cancelEraser(),
		})

		this.canvas.selectionManager.deselectAll()

		this.erasingElementId = elementId
		this.erasingContentId = contentId ?? getActiveContent(imageElement)?.contentId ?? null
		this.strokes = []
		this.redoStrokes = []
		this.mode = "erase"
		this.isPointerDown = false
		this.isCursorVisible = false

		const { min, max } = this.getRadiusRange()
		this.radius = medianRadius(min, max)

		this.editingSession = new ImageEditingSession({ canvas: this.canvas, elementId })
		if (!this.editingSession.mount()) {
			this.editingSession = null
			this.exitEraserMode(true)
			return
		}

		try {
			this.eraserRenderer = new EraserRenderer({
				canvas: this.canvas,
				elementId,
				manager: this,
			})
			if (!this.eraserRenderer.render()) {
				this.exitEraserMode(true)
				return
			}
		} catch (error) {
			this.exitEraserMode(true)
			throw error
		}
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
			this.strokes = []
			this.redoStrokes = []
			this.mode = "erase"
			return
		}

		const elementId = this.erasingElementId
		const contentId = this.erasingContentId

		this.removePositionListeners()
		this.isPointerDown = false
		this.isCursorVisible = false

		if (this.eraserRenderer) {
			this.eraserRenderer.destroy()
			this.eraserRenderer = null
		}
		this.canvas.cursorManager.exitEraserMode()

		this.erasingElementId = null
		this.erasingContentId = null
		this.strokes = []
		this.redoStrokes = []
		this.mode = "erase"
		this.editingSession?.destroy()
		this.editingSession = null
		this.canvas.imageEditingCoordinator.deactivate("eraser", elementId)
		this.canvas.selectionManager.select(elementId, false)

		this.canvas.eventEmitter.emit({
			type: "eraser:exit",
			data: {
				elementId,
				contentId: contentId ?? undefined,
				restored: shouldRestore,
			},
		})
	}

	public setRadius(radius: number): void {
		const nextRadius = Math.min(Math.max(Math.round(radius), MIN_RADIUS), MAX_RADIUS)
		if (nextRadius === this.radius) return
		this.radius = nextRadius
		this.canvas.cursorManager.updateEraserCursorRadius(nextRadius)
		this.emitSessionUpdate()
	}

	public setMode(mode: EraserStrokeMode): void {
		if (this.mode === mode) return
		this.mode = mode
		this.emitSessionUpdate()
	}

	public getMode(): EraserStrokeMode {
		return this.mode
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
		this.redoStrokes = []
		this.emitSessionUpdate()
	}

	public undoLastStroke(): void {
		if (!this.erasingElementId || this.strokes.length === 0) return
		const lastStroke = this.strokes[this.strokes.length - 1]
		this.strokes = this.strokes.slice(0, -1)
		this.redoStrokes = [...this.redoStrokes, lastStroke]
		this.emitSessionUpdate()
	}

	public redoLastStroke(): void {
		if (!this.erasingElementId || this.redoStrokes.length === 0) return
		const lastStroke = this.redoStrokes[this.redoStrokes.length - 1]
		this.redoStrokes = this.redoStrokes.slice(0, -1)
		this.strokes = [...this.strokes, lastStroke]
		this.emitSessionUpdate()
	}

	public canUndo(): boolean {
		return this.strokes.length > 0
	}

	public canRedo(): boolean {
		return this.redoStrokes.length > 0
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
			contentId: this.erasingContentId ?? undefined,
			radius: this.radius,
			mode: this.mode,
			strokes: this.getStrokes(),
		}
	}

	public confirmEraser(): void {
		if (!this.erasingElementId) {
			return
		}
		if (
			!this.canvas.permissionManager.can("document.write") ||
			!this.canvas.permissionManager.can("sideEffect.generate")
		) {
			this.cancelEraser()
			return
		}
		const element = this.canvas.elementManager.getElementData(this.erasingElementId)
		if (
			!element ||
			element.type !== ElementTypeEnum.Image ||
			!this.erasingContentId ||
			getActiveImageContentId(element as ImageElement) !== this.erasingContentId ||
			!getContentById(element, this.erasingContentId)
		) {
			this.cancelEraser()
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
			return
		}
		this.strokes = []
		this.redoStrokes = []
		this.mode = "erase"
	}
}
