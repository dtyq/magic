import Konva from "konva"
import type { Canvas } from "../../core/Canvas"
import { ElementTypeEnum } from "../../document/types"
import {
	areConnectionOriginsEqual,
	cloneConnectionOrigin,
	type ConnectionOrigin,
} from "../../shared/connectionOrigin"
import type { Rect } from "../../shared/ids"
import { getClientPointFromNativeEvent } from "../input"
import type {
	CanvasInputPoint,
	CanvasNativePointerEvent,
	CanvasPointerInput,
	CanvasPointerType,
} from "../input"
import { resolveManagedElementIdFromKonvaNode } from "../transform/elementNodeUtils"
import { createSelectionRevision } from "../selection/selectionContentCollector"
import { canSelectionRootConnect } from "../selection/selectionConnectionGuards"
import {
	ConnectionDragRenderer,
	type ConnectionDragPreviewState,
	type ConnectionDragPreviewValidationReason,
} from "./ConnectionDragRenderer"

interface ActiveConnectionDrag {
	origin: ConnectionOrigin
	pointerId: number
	pointerType: CanvasPointerType
	startClient: CanvasInputPoint
	startCanvas: CanvasInputPoint
	phase: "pending" | "dragging" | "menu-open"
	targetElementId: string | null
}

interface ConnectionTargetResolution {
	state: ConnectionDragPreviewState
	elementId: string | null
	targetFeedbackRect: Rect | null
	validationReason: ConnectionDragPreviewValidationReason | null
	sourceElementId?: string
	targetElementId?: string
	sourceRect?: Rect | null
	targetRect?: Rect | null
}

export interface StartConnectionDragFromHandleOptions {
	origin: ConnectionOrigin
	event?: Konva.KonvaEventObject<Event>
	client?: CanvasInputPoint
	canvasPoint?: CanvasInputPoint
	pointerId?: number
	pointerType?: CanvasPointerType
}

const DRAG_START_DISTANCE_PX = 5

function getPointerType(event: CanvasNativePointerEvent | null): CanvasPointerType {
	if (!event) return "mouse"
	if ("pointerType" in event) {
		if (event.pointerType === "touch") return "touch"
		if (event.pointerType === "pen") return "pen"
	}
	if ("changedTouches" in event) return "touch"
	return "mouse"
}

function getPointerId(event: CanvasNativePointerEvent | null, fallbackPointerId?: number): number {
	if (!event) return fallbackPointerId ?? 1
	if ("pointerId" in event) return event.pointerId
	if ("changedTouches" in event) {
		return event.changedTouches[0]?.identifier ?? event.touches[0]?.identifier ?? 1
	}
	return fallbackPointerId ?? 1
}

function getDistance(a: CanvasInputPoint, b: CanvasInputPoint): number {
	const dx = a.x - b.x
	const dy = a.y - b.y
	return Math.sqrt(dx * dx + dy * dy)
}

function isValidRect(rect: Rect | null | undefined): rect is Rect {
	return (
		!!rect &&
		Number.isFinite(rect.x) &&
		Number.isFinite(rect.y) &&
		Number.isFinite(rect.width) &&
		Number.isFinite(rect.height) &&
		rect.width > 0 &&
		rect.height > 0
	)
}

export class ConnectionDragManager {
	private readonly canvas: Canvas
	private readonly renderer: ConnectionDragRenderer
	private activeDrag: ActiveConnectionDrag | null = null
	private inputUnsubscribers: Array<() => void> = []
	private eventUnsubscribers: Array<() => void> = []

	constructor(options: { canvas: Canvas; renderer?: ConnectionDragRenderer }) {
		this.canvas = options.canvas
		this.renderer = options.renderer ?? new ConnectionDragRenderer({ canvas: this.canvas })
		this.setupInputListeners()
		this.setupEventListeners()
	}

	public startFromHandle(options: StartConnectionDragFromHandleOptions): boolean {
		const origin = options.origin
		if (!this.canStartFromHandle(origin)) return false
		if (
			this.activeDrag?.phase === "pending" &&
			areConnectionOriginsEqual(this.activeDrag.origin, origin)
		) {
			return true
		}
		if (this.activeDrag?.phase === "dragging") return false

		const nativeEvent = (options.event?.evt ?? null) as CanvasNativePointerEvent | null
		const client =
			options.client ?? (nativeEvent ? getClientPointFromNativeEvent(nativeEvent) : null)
		if (!client) return false

		const canvasPoint = options.canvasPoint ?? this.toCanvasPoint(client)
		if (!canvasPoint) return false

		this.cancelActiveDrag()
		this.activeDrag = {
			origin: cloneConnectionOrigin(origin),
			pointerId: options.pointerId ?? getPointerId(nativeEvent),
			pointerType: options.pointerType ?? getPointerType(nativeEvent),
			startClient: client,
			startCanvas: canvasPoint,
			phase: "pending",
			targetElementId: null,
		}
		return true
	}

	public releasePendingHandleInteraction(): void {
		if (!this.activeDrag || this.activeDrag.phase !== "pending") return
		this.openMenuFromPendingHandleClick(this.activeDrag)
		this.clearActiveDrag({ restoreCursor: false, refreshHandleOverlay: false })
	}

	public isDraggingConnection(): boolean {
		return this.activeDrag?.phase === "dragging" || this.activeDrag?.phase === "menu-open"
	}

	public cancelActiveDrag(): void {
		this.clearActiveDrag({
			restoreCursor: this.activeDrag?.phase === "dragging",
			refreshHandleOverlay:
				this.activeDrag?.phase === "dragging" || this.activeDrag?.phase === "menu-open",
		})
	}

	public destroy(): void {
		this.cancelActiveDrag()
		this.inputUnsubscribers.forEach((unsubscribe) => unsubscribe())
		this.inputUnsubscribers = []
		this.eventUnsubscribers.forEach((unsubscribe) => unsubscribe())
		this.eventUnsubscribers = []
		this.renderer.destroy()
	}

	private setupInputListeners(): void {
		this.inputUnsubscribers = [
			this.canvas.inputManager.on("move", (input) => this.handlePointerMove(input)),
			this.canvas.inputManager.on("up", (input) => this.handlePointerUp(input)),
			this.canvas.inputManager.on("cancel", (input) => this.handlePointerCancel(input)),
		]
	}

	private setupEventListeners(): void {
		this.eventUnsubscribers = [
			this.canvas.eventEmitter.on("keyboard:escape", () => this.cancelActiveDrag()),
			this.canvas.eventEmitter.on("canvas:clear", () => this.cancelActiveDrag()),
			this.canvas.eventEmitter.on("permission:changed", () => {
				if (!this.canvas.permissionManager.can("document.write")) this.cancelActiveDrag()
			}),
			this.canvas.eventEmitter.on("tool:change", () => this.cancelActiveDrag()),
			this.canvas.eventEmitter.on("crop:enter", () => this.cancelActiveDrag()),
			this.canvas.eventEmitter.on("extend:enter", () => this.cancelActiveDrag()),
			this.canvas.eventEmitter.on("eraser:enter", () => this.cancelActiveDrag()),
			this.canvas.eventEmitter.on("connection:menu:close", ({ data }) => {
				if (data.source === "drag-empty") {
					this.clearMenuOpenDrag(data.origin)
				}
			}),
			this.canvas.eventEmitter.on("elements:transform:dragstart", () =>
				this.cancelActiveDrag(),
			),
			this.canvas.eventEmitter.on("elements:transform:anchorDragStart", () =>
				this.cancelActiveDrag(),
			),
			this.canvas.eventEmitter.on("viewport:gesture", ({ data }) => {
				if (data.active) this.cancelActiveDrag()
			}),
			this.canvas.eventEmitter.on("element:deleted", ({ data }) => {
				if (
					this.activeDrag &&
					this.getOriginElementIds(this.activeDrag.origin).includes(data.elementId)
				) {
					this.cancelActiveDrag()
				}
			}),
			this.canvas.eventEmitter.on("element:batchdeleted", ({ data }) => {
				if (
					this.activeDrag &&
					this.getOriginElementIds(this.activeDrag.origin).some((id) =>
						data.elementIds.includes(id),
					)
				) {
					this.cancelActiveDrag()
				}
			}),
			this.canvas.eventEmitter.on("element:select", () =>
				this.cancelIfSelectionRevisionChanged(),
			),
			this.canvas.eventEmitter.on("element:deselect", () =>
				this.cancelIfSelectionRevisionChanged(),
			),
			this.canvas.eventEmitter.on("selection:position", () =>
				this.cancelIfSelectionRevisionChanged(),
			),
		]
	}

	private handlePointerMove(input: CanvasPointerInput): void {
		const activeDrag = this.activeDrag
		if (!activeDrag || !this.isActivePointer(input, activeDrag)) return
		if (activeDrag.phase === "menu-open") return

		this.stopInputEvent(input)
		if (input.activePointerCount > 1 || !this.canContinueDrag(activeDrag.origin)) {
			this.cancelActiveDrag()
			return
		}

		if (activeDrag.phase === "pending") {
			if (getDistance(input.client, activeDrag.startClient) < DRAG_START_DISTANCE_PX) {
				return
			}
			this.beginDrag(activeDrag)
		}

		this.renderPreview(input)
	}

	private handlePointerUp(input: CanvasPointerInput): void {
		const activeDrag = this.activeDrag
		if (!activeDrag || !this.isActivePointer(input, activeDrag)) return
		if (activeDrag.phase === "menu-open") return

		this.stopInputEvent(input)
		if (activeDrag.phase === "pending") {
			this.openMenuFromPendingHandleClick(activeDrag)
			this.clearActiveDrag({ restoreCursor: false, refreshHandleOverlay: false })
			return
		}

		const target = this.resolveConnectionTarget(input, activeDrag)
		if (target.state === "valid" && target.sourceElementId && target.targetElementId) {
			const edges = this.resolveConnectionEdges(activeDrag.origin, target.elementId)
			if (edges.length > 1) {
				this.canvas.connectionManager.connectElementsBatch({ edges })
			} else {
				this.canvas.connectionManager.connectElements({
					sourceElementId: target.sourceElementId,
					targetElementId: target.targetElementId,
				})
			}
			this.clearActiveDrag({ restoreCursor: true, refreshHandleOverlay: true })
			return
		}
		if (target.state === "free") {
			if (this.renderResolvedPreview(input, activeDrag, target)) {
				this.openMenuFromDragEmptyRelease(activeDrag, input)
			}
			return
		}
		this.clearActiveDrag({ restoreCursor: true, refreshHandleOverlay: true })
	}

	private handlePointerCancel(input: CanvasPointerInput): void {
		const activeDrag = this.activeDrag
		if (!activeDrag || !this.isActivePointer(input, activeDrag)) return

		this.stopInputEvent(input)
		this.clearActiveDrag({
			restoreCursor: activeDrag.phase === "dragging",
			refreshHandleOverlay:
				activeDrag.phase === "dragging" || activeDrag.phase === "menu-open",
		})
	}

	private beginDrag(activeDrag: ActiveConnectionDrag): void {
		activeDrag.phase = "dragging"
		this.canvas.hoverManager?.manualSetHover?.(null)
		if (activeDrag.origin.kind === "element") {
			this.canvas.selectionManager.deselectAll()
		}
		this.canvas.connectionHandleOverlayManager?.clear({ animated: false })
		this.canvas.cursorManager.setTemporary("crosshair")
	}

	private renderPreview(input: CanvasPointerInput): void {
		const activeDrag = this.activeDrag
		if (!activeDrag) return
		const target = this.resolveConnectionTarget(input, activeDrag)
		this.renderResolvedPreview(input, activeDrag, target)
	}

	private renderResolvedPreview(
		input: CanvasPointerInput,
		activeDrag: ActiveConnectionDrag,
		target: ConnectionTargetResolution,
	): boolean {
		const originRect = this.getOriginRect(activeDrag.origin)
		if (!isValidRect(originRect)) {
			this.cancelActiveDrag()
			return false
		}

		activeDrag.targetElementId = target.state === "valid" ? target.elementId : null
		this.updateDragCursor(target.state)

		if (target.state === "free") {
			this.renderer.render({
				originRect,
				originSide: activeDrag.origin.side,
				pointerCanvasPoint: input.canvas,
				state: "free",
			})
			return true
		}

		this.renderer.render({
			originRect,
			originSide: activeDrag.origin.side,
			pointerCanvasPoint: input.canvas,
			state: target.state,
			sourceRect: target.sourceRect,
			targetRect: target.targetRect,
			targetFeedbackRect: target.targetFeedbackRect,
			targetElementId: target.elementId,
			validationReason: target.validationReason,
		})
		return true
	}

	private clearActiveDrag(options: {
		restoreCursor: boolean
		refreshHandleOverlay: boolean
	}): void {
		const hadActiveDrag = !!this.activeDrag
		this.activeDrag = null
		this.renderer.clear()
		if (options.restoreCursor) {
			this.canvas.cursorManager.restoreToolCursor()
		}
		if (hadActiveDrag && options.refreshHandleOverlay) {
			this.canvas.connectionHandleOverlayManager?.refresh()
		}
	}

	private resolveConnectionTarget(
		input: CanvasPointerInput,
		activeDrag: ActiveConnectionDrag,
	): ConnectionTargetResolution {
		const candidateElementId = this.resolveTargetCandidateElementId(input)
		if (!candidateElementId) {
			return this.createFreeTargetResolution()
		}

		const targetFeedbackRect =
			this.canvas.geometryCacheManager.getElementBounds(candidateElementId)
		const validation = this.validateTargetElement(candidateElementId, activeDrag)
		if (!validation.ok) {
			return {
				state: "invalid",
				elementId: candidateElementId,
				targetFeedbackRect: isValidRect(targetFeedbackRect) ? targetFeedbackRect : null,
				validationReason: validation.reason,
			}
		}

		const edges = this.resolveConnectionEdges(activeDrag.origin, candidateElementId)
		const invalidReason = this.validateConnectionEdges(edges)
		if (invalidReason) {
			return {
				state: "invalid",
				elementId: candidateElementId,
				targetFeedbackRect: isValidRect(targetFeedbackRect) ? targetFeedbackRect : null,
				validationReason: invalidReason,
			}
		}
		const originRect = this.getOriginRect(activeDrag.origin)
		const candidateRect = this.canvas.geometryCacheManager.getElementBounds(candidateElementId)
		if (!isValidRect(originRect) || !isValidRect(candidateRect)) {
			return {
				state: "invalid",
				elementId: candidateElementId,
				targetFeedbackRect: isValidRect(targetFeedbackRect) ? targetFeedbackRect : null,
				validationReason: "missing-element",
			}
		}
		const sourceRect = activeDrag.origin.side === "right" ? originRect : candidateRect
		const targetRect = activeDrag.origin.side === "right" ? candidateRect : originRect

		return {
			state: "valid",
			elementId: candidateElementId,
			targetFeedbackRect: isValidRect(targetFeedbackRect) ? targetFeedbackRect : targetRect,
			validationReason: null,
			sourceElementId: edges[0]?.sourceElementId,
			targetElementId: edges[0]?.targetElementId,
			sourceRect,
			targetRect,
		}
	}

	private createFreeTargetResolution(): ConnectionTargetResolution {
		return {
			state: "free",
			elementId: null,
			targetFeedbackRect: null,
			validationReason: null,
		}
	}

	private resolveTargetCandidateElementId(input: CanvasPointerInput): string | null {
		const nodeTarget = resolveManagedElementIdFromKonvaNode(input.target, this.canvas)
		if (
			nodeTarget &&
			this.canvas.elementManager.hasElement(nodeTarget) &&
			this.isConnectionTargetCandidate(nodeTarget)
		) {
			return nodeTarget
		}
		return this.getTopCandidateElementIdAtCanvasPoint(input.canvas)
	}

	private getTopCandidateElementIdAtCanvasPoint(point: CanvasInputPoint): string | null {
		const activeDrag = this.activeDrag
		if (!activeDrag) return null

		const candidateIds = this.canvas.geometryCacheManager.queryElementIdsByExpandedRect(
			{ x: point.x, y: point.y, width: 0, height: 0 },
			0,
		)

		let topElementId: string | null = null
		let topAbsoluteZIndex = Number.NEGATIVE_INFINITY
		candidateIds.forEach((elementId) => {
			if (!this.isConnectionTargetCandidate(elementId)) return

			const bounds = this.canvas.geometryCacheManager.getElementBounds(elementId)
			if (
				!bounds ||
				point.x < bounds.x ||
				point.x > bounds.x + bounds.width ||
				point.y < bounds.y ||
				point.y > bounds.y + bounds.height
			) {
				return
			}

			const node = this.canvas.elementManager.getElementInstance(elementId)?.getNode()
			const absoluteZIndex = node?.getAbsoluteZIndex() ?? 0
			if (absoluteZIndex >= topAbsoluteZIndex) {
				topAbsoluteZIndex = absoluteZIndex
				topElementId = elementId
			}
		})

		return topElementId
	}

	private isConnectionTargetCandidate(elementId: string): boolean {
		if (!this.canvas.elementManager.hasElement(elementId)) return false
		if (this.isNonConnectableContainerElement(elementId)) return false
		return this.canvas.elementManager.isElementVisibleInDataTree(elementId)
	}

	private isNonConnectableContainerElement(elementId: string): boolean {
		const elementData = this.canvas.elementManager.getElementData(elementId)
		return elementData?.type === ElementTypeEnum.Group
	}

	private validateTargetElement(
		elementId: string,
		activeDrag: ActiveConnectionDrag,
	):
		| { ok: true }
		| {
				ok: false
				reason: ConnectionDragPreviewValidationReason
		  } {
		if (this.getOriginElementIds(activeDrag.origin).includes(elementId)) {
			return { ok: false, reason: "self" }
		}
		if (!this.canvas.elementManager.hasElement(elementId)) {
			return { ok: false, reason: "missing-element" }
		}
		if (!this.canvas.elementManager.isElementVisibleInDataTree(elementId)) {
			return { ok: false, reason: "invisible" }
		}
		const elementData = this.canvas.elementManager.getElementData(elementId)
		if (!this.canvas.permissionManager.canConnect(elementData)) {
			return { ok: false, reason: "cannot-connect" }
		}
		if (this.canvas.transformManager.isElementInActiveTransformInteraction?.(elementId)) {
			return { ok: false, reason: "transforming" }
		}

		return { ok: true }
	}

	private resolveConnectionEdges(
		origin: ConnectionOrigin,
		targetElementId: string | null,
	): Array<{ sourceElementId: string; targetElementId: string }> {
		if (!targetElementId) return []
		const originIds = this.getOriginElementIds(origin)
		return origin.side === "right"
			? originIds.map((sourceElementId) => ({ sourceElementId, targetElementId }))
			: originIds.map((selectedElementId) => ({
					sourceElementId: targetElementId,
					targetElementId: selectedElementId,
				}))
	}

	private validateConnectionEdges(
		edges: Array<{ sourceElementId: string; targetElementId: string }>,
	): ConnectionDragPreviewValidationReason | null {
		if (edges.length === 0) return "missing-element"
		const planned = new Set<string>()
		for (const edge of edges) {
			if (edge.sourceElementId === edge.targetElementId) return "self"
			const pair = `${edge.sourceElementId}\u0000${edge.targetElementId}`
			const reverse = `${edge.targetElementId}\u0000${edge.sourceElementId}`
			if (planned.has(pair)) return "already-connected"
			if (planned.has(reverse)) return "reverse-existing"
			if (
				this.canvas.connectionManager.hasConnection(
					edge.sourceElementId,
					edge.targetElementId,
				)
			) {
				return "already-connected"
			}
			if (
				this.canvas.connectionManager.hasReverseConnection(
					edge.sourceElementId,
					edge.targetElementId,
				)
			) {
				return "reverse-existing"
			}
			planned.add(pair)
		}
		return null
	}

	private canStartFromHandle(origin: ConnectionOrigin): boolean {
		if (!this.canUseConnectionDrag()) return false
		if (origin.kind === "selection") {
			return (
				origin.elementIds.length > 1 &&
				origin.elementIds.every((elementId) =>
					canSelectionRootConnect(this.canvas, elementId),
				)
			)
		}
		const elementData = this.canvas.elementManager.getElementData(origin.elementId)
		return (
			this.canvas.elementManager.hasElement(origin.elementId) &&
			this.canvas.elementManager.isElementVisibleInDataTree(origin.elementId) &&
			this.canvas.permissionManager.canConnect(elementData)
		)
	}

	private canContinueDrag(origin: ConnectionOrigin): boolean {
		return this.canStartFromHandle(origin)
	}

	private canUseConnectionDrag(): boolean {
		if (!this.canvas.permissionManager.can("document.write")) return false
		if (!this.canvas.permissionManager.canUseSelectionToolAffordance()) return false
		if (this.canvas.transformManager.isTransformInteractionActive()) return false
		if (this.canvas.transformManager.isDraggingElement()) return false
		if (this.canvas.cropManager?.getCroppingElementId?.()) return false
		if (this.canvas.extendManager?.getExtendingElementId?.()) return false
		if (this.canvas.eraserManager?.getErasingElementId?.()) return false
		return true
	}

	private updateDragCursor(state: ConnectionDragPreviewState): void {
		this.canvas.cursorManager.setTemporary(state === "invalid" ? "not-allowed" : "crosshair")
	}

	private isActivePointer(input: CanvasPointerInput, activeDrag: ActiveConnectionDrag): boolean {
		if (
			input.pointerId === activeDrag.pointerId &&
			input.pointerType === activeDrag.pointerType
		) {
			return true
		}
		return (
			activeDrag.pointerType === "touch" &&
			input.pointerType === "touch" &&
			input.activePointerCount <= 1
		)
	}

	private toCanvasPoint(client: CanvasInputPoint): CanvasInputPoint | null {
		const container = this.canvas.stage.container()
		if (!container) return null
		const rect = container.getBoundingClientRect()
		const stagePoint = {
			x: client.x - rect.left,
			y: client.y - rect.top,
		}
		const transform = this.canvas.stage.getAbsoluteTransform().copy().invert()
		return transform.point(stagePoint)
	}

	private stopInputEvent(input: CanvasPointerInput): void {
		input.konvaEvent.cancelBubble = true
		input.nativeEvent.preventDefault()
		input.nativeEvent.stopPropagation()
	}

	private openMenuFromPendingHandleClick(activeDrag: ActiveConnectionDrag): void {
		if (!this.canOpenMenuFromOrigin(activeDrag.origin)) return
		this.canvas.eventEmitter.emit({
			type: "connection:menu:open",
			data: {
				origin: cloneConnectionOrigin(activeDrag.origin),
				x: activeDrag.startClient.x,
				y: activeDrag.startClient.y,
				canvasX: activeDrag.startCanvas.x,
				canvasY: activeDrag.startCanvas.y,
				source: "handle",
			},
		})
	}

	private openMenuFromDragEmptyRelease(
		activeDrag: ActiveConnectionDrag,
		input: CanvasPointerInput,
	): void {
		if (!this.canOpenMenuFromOrigin(activeDrag.origin)) {
			this.clearActiveDrag({ restoreCursor: true, refreshHandleOverlay: true })
			return
		}
		activeDrag.phase = "menu-open"
		activeDrag.targetElementId = null
		this.canvas.cursorManager.restoreToolCursor()
		this.canvas.eventEmitter.emit({
			type: "connection:menu:open",
			data: {
				origin: cloneConnectionOrigin(activeDrag.origin),
				x: input.client.x,
				y: input.client.y,
				canvasX: input.canvas.x,
				canvasY: input.canvas.y,
				source: "drag-empty",
			},
		})
	}

	private clearMenuOpenDrag(origin: ConnectionOrigin): void {
		if (!this.activeDrag || this.activeDrag.phase !== "menu-open") return
		if (!areConnectionOriginsEqual(this.activeDrag.origin, origin)) return
		this.clearActiveDrag({ restoreCursor: false, refreshHandleOverlay: true })
	}

	private getOriginElementIds(origin: ConnectionOrigin): string[] {
		return origin.kind === "element" ? [origin.elementId] : origin.elementIds
	}

	private getOriginRect(origin: ConnectionOrigin): Rect | null {
		if (origin.kind === "selection") return origin.boundingRect
		return this.canvas.geometryCacheManager.getElementBounds(origin.elementId)
	}

	private canOpenMenuFromOrigin(origin: ConnectionOrigin): boolean {
		if (origin.kind === "element") return true
		return (
			createSelectionRevision(this.canvas.selectionManager.getSelectedIds()) ===
				origin.selectionRevision &&
			origin.elementIds.every((elementId) => canSelectionRootConnect(this.canvas, elementId))
		)
	}

	private cancelIfSelectionRevisionChanged(): void {
		const activeDrag = this.activeDrag
		if (!activeDrag || activeDrag.origin.kind !== "selection") return
		if (
			createSelectionRevision(this.canvas.selectionManager.getSelectedIds()) !==
			activeDrag.origin.selectionRevision
		) {
			this.cancelActiveDrag()
		}
	}
}
