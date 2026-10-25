import Konva from "konva"
import type { Canvas } from "../../core/Canvas"
import type { ConnectionOrigin } from "../../shared/connectionOrigin"
import type { Rect } from "../../shared/ids"
import {
	ConnectionHandleRenderer,
	type ConnectionHandleSide,
	type ConnectionHandleInteractionState,
	type ConnectionHandleOverlayOrigin,
} from "./ConnectionHandleRenderer"
import {
	resolveConnectionHandleOverlayIntent,
	type ConnectionHandleOverlayIntent,
} from "./connectionHandleOverlayIntent"
import { collectSelectionContentSnapshot } from "../selection/selectionContentCollector"
import { isConnectionMenuSideDisabled } from "../selection/connectionMenuCapabilities"

type ConnectionHandleInteractionBlocker =
	| "crop"
	| "element-drag"
	| "eraser"
	| "extend"
	| "konva-drag"
	| "selection"
	| "transform-anchor"
	| "transform-drag"
	| "viewport-gesture"

interface ReconcileOptions {
	animated?: boolean
	forceGeometryUpdate?: boolean
}

interface PointerBridgeKeepAliveResult {
	bounds: Rect | null
	pointerInside: boolean
}

export class ConnectionHandleOverlayManager {
	private static readonly MIN_ELEMENT_SCREEN_MAJOR_SIZE_FOR_HANDLE_PX = 60
	private static readonly MIN_ELEMENT_SCREEN_MINOR_SIZE_FOR_HANDLE_PX = 24
	private static readonly HANDLE_ANIMATION_OFFSET_PX = 8
	private static readonly HANDLE_ENTER_DURATION_SECONDS = 0.14
	private static readonly HANDLE_EXIT_DURATION_SECONDS = 0.1

	private readonly canvas: Canvas
	private readonly renderer: ConnectionHandleRenderer
	private readonly animationsEnabled: boolean
	private overlayNode: Konva.Group | null = null
	private renderedIntent: ConnectionHandleOverlayIntent = {
		visible: false,
		reason: "initial",
	}
	private bridgeCandidateElementId: string | null = null
	private isStagePointerInside = true
	private menuPinnedElementId: string | null = null
	private selectionBoundingRect: Rect | null = null
	private selectedElementIds: string[] = []
	private interactionBlockers = new Set<ConnectionHandleInteractionBlocker>()
	private hoveredHandleNode: Konva.Group | null = null
	private activeHandleNode: Konva.Group | null = null
	private disabledHoveredCorridor: Konva.Rect | null = null
	private settledReconcileQueued = false
	private settledBlockers = new Set<ConnectionHandleInteractionBlocker>()
	private destroyed = false
	private overlayTweens = new Map<Konva.Group, Set<Konva.Tween>>()
	private exitingOverlayNodes = new Set<Konva.Group>()
	private eventUnsubscribers: Array<() => void> = []
	private activeHandleReleaseUnsubscribers: Array<() => void> = []

	constructor(options: {
		canvas: Canvas
		renderer?: ConnectionHandleRenderer
		animationsEnabled?: boolean
	}) {
		this.canvas = options.canvas
		this.renderer = options.renderer ?? new ConnectionHandleRenderer()
		this.animationsEnabled = options.animationsEnabled ?? true

		this.setupEventListeners()
	}

	private readonly handleStagePointerMove = (): void => {
		this.isStagePointerInside = true
		const hoveredElementId = this.canvas.hoverManager.getHoveredElementId()
		if (hoveredElementId) {
			this.bridgeCandidateElementId = hoveredElementId
			return
		}
		if (!this.bridgeCandidateElementId) return
		this.reconcile("stage-pointer-move")
	}

	private readonly handleStagePointerLeave = (): void => {
		this.isStagePointerInside = false
		this.bridgeCandidateElementId = null
		this.clearDisabledHandleHover()
		this.reconcile("stage-pointer-leave")
	}

	private readonly handleStageDragStart = (): void => {
		this.menuPinnedElementId = null
		this.beginInteraction("konva-drag", "stage-drag-start")
	}

	private readonly handleStageDragEnd = (): void => {
		this.scheduleReconcileAfterInteractionSettled("konva-drag")
	}

	private readonly handleViewportPan = (): void => {
		this.syncBridgeCandidateFromHover()
		this.reconcile("viewport-pan")
	}

	private setupEventListeners(): void {
		const reconcile = () => {
			this.reconcile("state-change")
		}
		const reconcileGeometry = () => {
			this.reconcile("geometry-change", { forceGeometryUpdate: true })
		}
		const resetAndReconcile = () => {
			this.resetOverlaySourcesAndBlockers()
			this.reconcile("document-reset", { forceGeometryUpdate: true })
		}
		const handleHoverChange = ({ data }: { data: { elementId: string | null } }) => {
			if (data.elementId) {
				this.bridgeCandidateElementId = data.elementId
			} else if (this.renderedIntent.visible && this.renderedIntent.source === "hover") {
				this.bridgeCandidateElementId = this.renderedIntent.elementId
			}
			this.reconcile("element-hover")
		}
		const handleConnectionMenuOpen = ({
			data,
		}: {
			data: { origin: ConnectionOrigin; source: "handle" | "drag-empty" }
		}) => {
			this.menuPinnedElementId =
				data.source === "handle" && data.origin.kind === "element"
					? data.origin.elementId
					: null
			this.bridgeCandidateElementId = null
			this.reconcile("connection-menu-open")
		}
		const handleConnectionMenuClose = ({
			data,
		}: {
			data: { origin: ConnectionOrigin; source: "handle" | "drag-empty" }
		}) => {
			if (data.source !== "handle") return
			if (
				data.origin.kind === "element" &&
				data.origin.elementId !== this.menuPinnedElementId
			) {
				return
			}
			this.menuPinnedElementId = null
			this.syncBridgeCandidateFromHover()
			this.reconcile("connection-menu-close")
		}
		const refreshIfCurrentTargetChanged = ({ data }: { data: { elementId: string } }) => {
			if (this.getRelevantElementIds().has(data.elementId)) {
				this.reconcile("current-target-geometry-change", {
					forceGeometryUpdate: true,
				})
			}
		}
		const handleElementSelect = ({ data }: { data: { elementIds: string[] } }) => {
			this.selectedElementIds = [...data.elementIds]
			this.reconcile("element-select")
		}
		const handleElementDeselect = ({ data }: { data?: { elementIds?: string[] } }) => {
			if (!data?.elementIds?.length) {
				this.selectedElementIds = []
			} else {
				const removed = new Set(data.elementIds)
				this.selectedElementIds = this.selectedElementIds.filter(
					(elementId) => !removed.has(elementId),
				)
			}
			this.reconcile("element-deselect")
		}
		const handleElementDeleted = ({ data }: { data: { elementId: string } }) => {
			if (!this.getRelevantElementIds().has(data.elementId)) return
			if (this.bridgeCandidateElementId === data.elementId) {
				this.bridgeCandidateElementId = null
			}
			if (this.menuPinnedElementId === data.elementId) {
				this.menuPinnedElementId = null
			}
			this.reconcile("element-deleted", { animated: false })
		}

		this.eventUnsubscribers.push(
			this.canvas.eventEmitter.on("element:hover", handleHoverChange),
			this.canvas.eventEmitter.on("connection:menu:open", handleConnectionMenuOpen),
			this.canvas.eventEmitter.on("connection:menu:close", handleConnectionMenuClose),
			this.canvas.eventEmitter.on("element:select", handleElementSelect),
			this.canvas.eventEmitter.on("element:deselect", handleElementDeselect),
			this.canvas.eventEmitter.on("selection:position", ({ data }) => {
				this.selectionBoundingRect = data.boundingRect
				this.reconcile("selection-position", { forceGeometryUpdate: true })
			}),
			this.canvas.eventEmitter.on("element:updated", refreshIfCurrentTargetChanged),
			this.canvas.eventEmitter.on("element:rerendered", refreshIfCurrentTargetChanged),
			this.canvas.eventEmitter.on("viewport:scale", reconcileGeometry),
			this.canvas.eventEmitter.on("viewport:pan", this.handleViewportPan),
			this.canvas.eventEmitter.on("document:loaded", resetAndReconcile),
			this.canvas.eventEmitter.on("document:restored", resetAndReconcile),
			this.canvas.eventEmitter.on("permission:changed", reconcile),
			this.canvas.eventEmitter.on("canvas:devicechange", reconcile),
			this.canvas.eventEmitter.on("tool:change", reconcile),
			this.canvas.eventEmitter.on("crop:exit", () => {
				this.endInteraction("crop", "crop-exit")
			}),
			this.canvas.eventEmitter.on("extend:exit", () => {
				this.endInteraction("extend", "extend-exit")
			}),
			this.canvas.eventEmitter.on("eraser:exit", () => {
				this.endInteraction("eraser", "eraser-exit")
			}),
			this.canvas.eventEmitter.on("selection:end", () => {
				this.endInteraction("selection", "selection-end")
			}),
			this.canvas.eventEmitter.on("elements:transform:dragend", () => {
				this.scheduleReconcileAfterInteractionSettled("transform-drag")
			}),
			this.canvas.eventEmitter.on("elements:transform:anchorDragend", () => {
				this.scheduleReconcileAfterInteractionSettled("transform-anchor")
			}),
			this.canvas.eventEmitter.on("elements:transform:intentend", () => {
				this.scheduleReconcileAfterInteractionSettled()
			}),
			this.canvas.eventEmitter.on("viewport:gesture", ({ data }) => {
				if (data.active) {
					this.bridgeCandidateElementId = null
					this.menuPinnedElementId = null
					this.beginInteraction("viewport-gesture", "viewport-gesture-start")
				} else {
					this.endInteraction("viewport-gesture", "viewport-gesture-end")
				}
			}),
			this.canvas.eventEmitter.on("element:deleted", handleElementDeleted),
			this.canvas.eventEmitter.on("element:batchdeleted", () => {
				this.resetOverlaySourcesAndBlockers()
				this.clear({ animated: false })
			}),
			this.canvas.eventEmitter.on("canvas:clear", () => {
				this.resetOverlaySourcesAndBlockers()
				this.clear({ animated: false })
			}),
			this.canvas.eventEmitter.on("crop:enter", () => {
				this.bridgeCandidateElementId = null
				this.menuPinnedElementId = null
				this.beginInteraction("crop", "crop-enter")
			}),
			this.canvas.eventEmitter.on("extend:enter", () => {
				this.bridgeCandidateElementId = null
				this.menuPinnedElementId = null
				this.beginInteraction("extend", "extend-enter")
			}),
			this.canvas.eventEmitter.on("eraser:enter", () => {
				this.bridgeCandidateElementId = null
				this.menuPinnedElementId = null
				this.beginInteraction("eraser", "eraser-enter")
			}),
			this.canvas.eventEmitter.on("selection:start", () => {
				this.bridgeCandidateElementId = null
				this.menuPinnedElementId = null
				this.beginInteraction("selection", "selection-start")
			}),
			this.canvas.eventEmitter.on("element:dragstart", () => {
				this.beginInteraction("element-drag", "element-drag-start")
			}),
			this.canvas.eventEmitter.on("element:dragend", () => {
				this.scheduleReconcileAfterInteractionSettled("element-drag")
			}),
			this.canvas.eventEmitter.on("elements:transform:dragstart", () => {
				this.beginInteraction("transform-drag", "transform-drag-start")
			}),
			this.canvas.eventEmitter.on("elements:transform:anchorDragStart", () => {
				this.beginInteraction("transform-anchor", "transform-anchor-start")
			}),
		)
		this.canvas.stage.on("mousemove touchmove pointermove", this.handleStagePointerMove)
		this.canvas.stage.on("mouseleave", this.handleStagePointerLeave)
		this.canvas.stage.on("dragstart", this.handleStageDragStart)
		this.canvas.stage.on("dragend", this.handleStageDragEnd)
	}

	public refresh(): void {
		this.reconcile("external-refresh", { forceGeometryUpdate: true })
	}

	public clear(options?: { animated?: boolean }): void {
		this.menuPinnedElementId = null
		this.bridgeCandidateElementId = null
		this.renderedIntent = { visible: false, reason: "cleared" }
		this.hideOverlay({ animated: options?.animated })
		if (options?.animated === false) {
			this.destroyExitingOverlays()
		}
	}

	private hideOverlay(options?: { animated?: boolean }): void {
		const overlayNode = this.overlayNode
		if (!overlayNode) return

		this.overlayNode = null
		this.resetHandleInteractionState()
		this.stopOverlayTweens(overlayNode)

		const shouldAnimate = options?.animated ?? this.animationsEnabled
		if (!shouldAnimate) {
			overlayNode.destroy()
			this.requestControlsDraw("connection-handle-clear")
			return
		}

		overlayNode.name(ConnectionHandleRenderer.EXITING_OVERLAY_GROUP_NAME)
		this.disableOverlayListening(overlayNode)
		this.exitingOverlayNodes.add(overlayNode)
		this.playExitAnimation(overlayNode)
		this.requestControlsDraw("connection-handle-clear")
	}

	public destroy(): void {
		this.destroyed = true
		this.resetHandleInteractionState()
		this.clear({ animated: false })
		this.destroyExitingOverlays()
		this.destroyAllOverlayTweens()
		this.canvas.stage.off("mousemove touchmove pointermove", this.handleStagePointerMove)
		this.canvas.stage.off("mouseleave", this.handleStagePointerLeave)
		this.canvas.stage.off("dragstart", this.handleStageDragStart)
		this.canvas.stage.off("dragend", this.handleStageDragEnd)
		this.eventUnsubscribers.forEach((unsubscribe) => unsubscribe())
		this.eventUnsubscribers = []
	}

	private reconcile(reason: string, options: ReconcileOptions = {}): void {
		if (this.destroyed) return
		const selectionCount = this.canvas.selectionManager.getSelectionCount()
		const selectedElementIds =
			selectionCount > 1
				? this.selectedElementIds.length > 0
					? this.selectedElementIds
					: this.canvas.selectionManager.getSelectedIds()
				: []
		const selectionSnapshot =
			selectionCount > 1 && typeof this.canvas.elementManager.getAllElements === "function"
				? collectSelectionContentSnapshot(
						this.canvas,
						selectedElementIds,
						this.selectionBoundingRect,
					)
				: null
		const hoveredElementId = this.canvas.hoverManager.getHoveredElementId()
		const touchSelectedElementId = this.getTouchSelectedElementId(selectionCount)
		const blockReason = this.getConnectionHandleOverlayBlockReason()
		const shouldResolvePointerBridge =
			!blockReason &&
			!this.menuPinnedElementId &&
			!hoveredElementId &&
			Boolean(this.bridgeCandidateElementId)
		const stageScale = this.getSafeStageScale()
		const pointerBridgeKeepAlive = shouldResolvePointerBridge
			? this.resolvePointerBridgeKeepAlive(stageScale)
			: null

		let intent = resolveConnectionHandleOverlayIntent({
			blockReason,
			hasMultipleSelection: selectionCount > 1,
			selectionTarget: selectionSnapshot
				? {
						elementIds: selectionSnapshot.rootElementIds,
						boundingRect: selectionSnapshot.boundingRect,
						selectionRevision: selectionSnapshot.selectionRevision,
					}
				: undefined,
			canShowSelectionHandles: selectionSnapshot?.allRootsCanConnect ?? false,
			menuPinnedElementId: this.menuPinnedElementId,
			hoveredElementId,
			bridgeCandidateElementId: this.bridgeCandidateElementId,
			pointerInsideKeepAliveRegion: pointerBridgeKeepAlive?.pointerInside ?? false,
			touchSelectedElementId,
		})

		let bounds: Rect | null | undefined
		if (intent.visible) {
			const intentElementId = "kind" in intent ? null : intent.elementId
			const elementBlockReason = intentElementId
				? this.getConnectionHandleElementBlockReason(intentElementId)
				: null
			if (elementBlockReason) {
				intent = { visible: false, reason: elementBlockReason }
			} else {
				bounds =
					"kind" in intent && intent.kind === "selection"
						? intent.boundingRect
						: intentElementId === this.bridgeCandidateElementId &&
							  pointerBridgeKeepAlive?.bounds
							? pointerBridgeKeepAlive.bounds
							: this.canvas.elementManager
									.getNodeAdapter()
									.getElementBounds(intentElementId as string)
				if (!this.isValidRect(bounds)) {
					intent = { visible: false, reason: "invalid-bounds" }
				} else if (!this.canFitHandlesOnScreen(bounds, stageScale)) {
					intent = { visible: false, reason: "element-too-small" }
				}
			}
		}

		if (!intent.visible && intent.reason === "no-target") {
			this.bridgeCandidateElementId = null
		}
		if (intent.visible && intent.source === "touch-selection") {
			this.bridgeCandidateElementId = null
		}

		this.applyIntent(intent, bounds, stageScale, reason, options)
	}

	private applyIntent(
		intent: ConnectionHandleOverlayIntent,
		bounds: Rect | null | undefined,
		stageScale: number,
		reason: string,
		options: ReconcileOptions,
	): void {
		const previousIntent = this.renderedIntent
		this.renderedIntent = intent

		if (!intent.visible || !this.isValidRect(bounds)) {
			this.hideOverlay({ animated: options.animated })
			if (options.animated === false) {
				this.destroyExitingOverlays()
			}
			return
		}

		const previousIdentity = this.getIntentIdentity(previousIntent)
		const nextIdentity = this.getIntentIdentity(intent)
		const isNewOverlay = !this.overlayNode
		const elementChanged = previousIdentity !== nextIdentity
		if (!this.overlayNode) {
			const disabledSides = this.resolveDisabledHandleSides(intent)
			this.overlayNode = this.renderer.createOverlay(
				this.getRendererOrigin(intent),
				bounds,
				stageScale,
				disabledSides,
			)
			this.bindHandleInteractionEvents(this.overlayNode)
			this.canvas.controlsLayer.add(this.overlayNode)
		} else if (elementChanged || options.forceGeometryUpdate) {
			if (elementChanged) {
				this.resetHandleInteractionState()
			}
			this.stopOverlayTweens(this.overlayNode)
			this.renderer.updateOverlay(
				this.overlayNode,
				this.getRendererOrigin(intent),
				bounds,
				stageScale,
				this.resolveDisabledHandleSides(intent),
			)
		}

		this.overlayNode.moveToTop()
		if (isNewOverlay || elementChanged) {
			this.playEnterAnimation(this.overlayNode, stageScale)
		} else if (options.forceGeometryUpdate) {
			this.showHandlesAtRest(this.overlayNode)
		}
		if (isNewOverlay || elementChanged || options.forceGeometryUpdate) {
			this.requestControlsDraw(`connection-handle-${reason}`)
		}
	}

	private syncBridgeCandidateFromHover(): void {
		const hoveredElementId = this.canvas.hoverManager.getHoveredElementId()
		if (hoveredElementId) {
			this.bridgeCandidateElementId = hoveredElementId
		}
	}

	private resetOverlaySourcesAndBlockers(): void {
		this.bridgeCandidateElementId = null
		this.menuPinnedElementId = null
		this.selectionBoundingRect = null
		this.selectedElementIds = []
		this.interactionBlockers.clear()
		this.settledBlockers.clear()
	}

	private getRelevantElementIds(): Set<string> {
		const touchSelectedElementId = this.getTouchSelectedElementId(
			this.canvas.selectionManager.getSelectionCount(),
		)
		const selectedIds =
			this.canvas.selectionManager.getSelectionCount() > 1 ? this.selectedElementIds : []
		return new Set(
			[
				this.menuPinnedElementId,
				this.canvas.hoverManager.getHoveredElementId(),
				this.bridgeCandidateElementId,
				this.renderedIntent.visible && !("kind" in this.renderedIntent)
					? this.renderedIntent.elementId
					: null,
				touchSelectedElementId,
				...selectedIds,
				...(this.renderedIntent.visible &&
				"kind" in this.renderedIntent &&
				this.renderedIntent.kind === "selection"
					? this.renderedIntent.elementIds
					: []),
			].filter((elementId): elementId is string => Boolean(elementId)),
		)
	}

	private getTouchSelectedElementId(selectionCount: number): string | null {
		if (!this.shouldShowSelectedElementHandle() || selectionCount !== 1) return null
		return this.canvas.selectionManager.getSelectedIds()[0] ?? null
	}

	private shouldShowSelectedElementHandle(): boolean {
		const { formFactor, input } = this.canvas.deviceInfo
		return input.touch && (input.coarsePointer || !input.hover || formFactor !== "desktop")
	}

	private getConnectionHandleOverlayBlockReason(): string | null {
		const interactionBlocker = this.interactionBlockers.values().next().value
		if (interactionBlocker) return interactionBlocker
		if (this.canvas.stage.isDragging()) return "stage-dragging"
		if (!this.canvas.permissionManager.can("document.write"))
			return "document-write-unavailable"
		if (this.canvas.connectionDragManager?.isDraggingConnection?.())
			return "connection-dragging"
		if (!this.canvas.permissionManager.canUseSelectionToolAffordance()) {
			return "selection-tool-affordance-disabled"
		}
		if (this.isExtendModeActive()) return "extend-mode"
		if (this.canvas.transformManager.isTransformInteractionActive()) {
			return "transform-interaction-active"
		}
		if (this.canvas.transformManager.isDraggingElement()) return "dragging-element"
		return null
	}

	private getConnectionHandleElementBlockReason(elementId: string): string | null {
		if (!this.canvas.elementManager.hasElement(elementId)) return "missing-element"
		const elementData = this.canvas.elementManager.getElementData(elementId)
		if (!this.canvas.permissionManager.canConnect(elementData)) return "cannot-connect"
		return null
	}

	private isExtendModeActive(): boolean {
		return Boolean(this.canvas.extendManager?.getExtendingElementId?.())
	}

	private isValidRect(rect: Rect | null | undefined): rect is Rect {
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

	private canFitHandlesOnScreen(rect: Rect, stageScale: number): boolean {
		const screenWidth = rect.width * stageScale
		const screenHeight = rect.height * stageScale
		const majorScreenSize = Math.max(screenWidth, screenHeight)
		const minorScreenSize = Math.min(screenWidth, screenHeight)
		return (
			majorScreenSize >=
				ConnectionHandleOverlayManager.MIN_ELEMENT_SCREEN_MAJOR_SIZE_FOR_HANDLE_PX &&
			minorScreenSize >=
				ConnectionHandleOverlayManager.MIN_ELEMENT_SCREEN_MINOR_SIZE_FOR_HANDLE_PX
		)
	}

	private getSafeStageScale(): number {
		const scale = this.canvas.stage.scaleX()
		return Number.isFinite(scale) && scale > 0 ? scale : 1
	}

	private beginInteraction(blocker: ConnectionHandleInteractionBlocker, reason: string): void {
		this.interactionBlockers.add(blocker)
		this.reconcile(reason, { animated: false })
	}

	private endInteraction(blocker: ConnectionHandleInteractionBlocker, reason: string): void {
		this.interactionBlockers.delete(blocker)
		this.reconcile(reason, { forceGeometryUpdate: true })
	}

	private resolvePointerBridgeKeepAlive(stageScale: number): PointerBridgeKeepAliveResult {
		if (!this.isStagePointerInside || !this.bridgeCandidateElementId) {
			return { bounds: null, pointerInside: false }
		}

		const pointerPosition = this.getPointerPositionInControlsLayer()
		if (!pointerPosition) return { bounds: null, pointerInside: false }

		const bounds = this.canvas.elementManager
			.getNodeAdapter()
			.getElementBounds(this.bridgeCandidateElementId)
		if (!this.isValidRect(bounds)) return { bounds, pointerInside: false }

		if (!this.canFitHandlesOnScreen(bounds, stageScale)) {
			return { bounds, pointerInside: false }
		}

		return {
			bounds,
			pointerInside: this.renderer.isPointInHandleKeepAliveRegion(
				bounds,
				stageScale,
				pointerPosition,
			),
		}
	}

	private getPointerPositionInControlsLayer(): { x: number; y: number } | null {
		const pointerPosition = this.canvas.stage.getPointerPosition()
		if (!pointerPosition) return null

		const controlsTransform = this.canvas.controlsLayer.getAbsoluteTransform().copy().invert()
		return controlsTransform.point(pointerPosition)
	}

	private bindHandleInteractionEvents(overlayNode: Konva.Group): void {
		this.getCorridorNodes(overlayNode).forEach((corridor) => {
			corridor.on("mouseenter", () => {
				const side = this.getConnectionHandleSide(corridor)
				if (!side) return
				const handle = this.getHandleNodes(overlayNode).find(
					(node) => this.getConnectionHandleSide(node) === side,
				)
				if (!handle || !this.isHandleDisabled(handle)) return
				this.disabledHoveredCorridor = corridor
				this.canvas.cursorManager.setTemporary("not-allowed")
			})

			corridor.on("mouseleave", () => {
				if (this.disabledHoveredCorridor !== corridor) return
				this.clearDisabledHandleHover()
			})
		})

		this.getHandleNodes(overlayNode).forEach((handle) => {
			handle.on("mouseenter", () => {
				if (this.isHandleDisabled(handle)) return
				this.hoveredHandleNode = handle
				this.setHandleInteractionState(
					handle,
					this.activeHandleNode === handle ? "active" : "hover",
					"connection-handle-hover",
				)
				this.canvas.cursorManager.setTemporary("pointer")
			})

			handle.on("mouseleave", () => {
				if (this.isHandleDisabled(handle)) return
				if (this.hoveredHandleNode === handle) {
					this.hoveredHandleNode = null
				}
				if (this.activeHandleNode === handle) {
					return
				}
				this.setHandleInteractionState(handle, "idle", "connection-handle-unhover")
				this.restoreHandleCursorIfIdle()
			})

			handle.on("pointerdown mousedown touchstart", (event) => {
				this.stopHandleEvent(event)
				if (this.isHandleDisabled(handle)) return
				this.activeHandleNode = handle
				this.hoveredHandleNode = handle
				this.setHandleInteractionState(handle, "active", "connection-handle-active")
				this.canvas.cursorManager.setTemporary("pointer")
				this.startConnectionDragFromHandle(handle, event)
				this.bindActiveHandleReleaseEvents()
			})

			handle.on("pointerup pointercancel mouseup touchend touchcancel", (event) => {
				this.stopHandleEvent(event)
				this.finishActiveHandle()
			})

			handle.on("click tap", (event) => {
				this.stopHandleEvent(event)
			})
		})
	}

	private setHandleInteractionState(
		handle: Konva.Group,
		state: ConnectionHandleInteractionState,
		reason: string,
	): void {
		this.renderer.setHandleInteractionState(handle, state)
		this.requestControlsDraw(reason)
	}

	private finishActiveHandle(): void {
		this.canvas.connectionDragManager?.releasePendingHandleInteraction()
		const activeHandle = this.activeHandleNode
		this.activeHandleNode = null
		this.removeActiveHandleReleaseEvents()
		if (activeHandle) {
			this.setHandleInteractionState(
				activeHandle,
				this.hoveredHandleNode === activeHandle ? "hover" : "idle",
				"connection-handle-active-end",
			)
		}
		this.restoreHandleCursorIfIdle()
	}

	private startConnectionDragFromHandle(
		handle: Konva.Group,
		event: Konva.KonvaEventObject<Event>,
	): void {
		const side = this.getConnectionHandleSide(handle)
		if (!side) return
		const overlayOrigin = this.getConnectionHandleOrigin(handle)
		if (!overlayOrigin) return
		// Prefer the rendered intent so a selection handle never falls back to a fake 1x1 rect
		// when the memorized selection:position event has not arrived yet.
		const selectionBoundingRect =
			this.renderedIntent.visible &&
			"kind" in this.renderedIntent &&
			this.renderedIntent.kind === "selection" &&
			overlayOrigin.kind === "selection" &&
			this.renderedIntent.selectionRevision === overlayOrigin.selectionRevision
				? this.renderedIntent.boundingRect
				: this.selectionBoundingRect
		const origin: ConnectionOrigin | null =
			overlayOrigin.kind === "selection" && this.isValidRect(selectionBoundingRect)
				? {
						kind: "selection",
						elementIds: [...overlayOrigin.elementIds],
						side,
						boundingRect: { ...selectionBoundingRect },
						selectionRevision: overlayOrigin.selectionRevision,
					}
				: overlayOrigin.kind === "element"
					? { kind: "element", elementId: overlayOrigin.elementId, side }
					: null
		if (!origin) return

		this.canvas.connectionDragManager?.startFromHandle({ origin, event })
	}

	private getConnectionHandleOrigin(handle: Konva.Group): ConnectionHandleOverlayOrigin | null {
		const origin = handle.getAttr(ConnectionHandleRenderer.HANDLE_ORIGIN_ATTR)
		if (!origin || typeof origin !== "object") return null
		if (
			origin.kind === "element" &&
			typeof origin.elementId === "string" &&
			origin.elementId.length > 0
		) {
			return { kind: "element", elementId: origin.elementId }
		}
		if (
			origin.kind === "selection" &&
			Array.isArray(origin.elementIds) &&
			origin.elementIds.length > 1 &&
			origin.elementIds.every((elementId: unknown) => typeof elementId === "string") &&
			typeof origin.selectionRevision === "string"
		) {
			return {
				kind: "selection",
				elementIds: [...origin.elementIds],
				selectionRevision: origin.selectionRevision,
			}
		}
		return null
	}

	private getIntentIdentity(intent: ConnectionHandleOverlayIntent): string | null {
		if (!intent.visible) return null
		if ("kind" in intent) {
			return `selection:${intent.selectionRevision}`
		}
		return `element:${intent.elementId}`
	}

	private getRendererOrigin(
		intent: Extract<ConnectionHandleOverlayIntent, { visible: true }>,
	): ConnectionHandleOverlayOrigin {
		if ("kind" in intent) {
			return {
				kind: "selection",
				elementIds: intent.elementIds,
				selectionRevision: intent.selectionRevision,
			}
		}
		return { kind: "element", elementId: intent.elementId }
	}

	private getConnectionHandleSide(node: Konva.Node): ConnectionHandleSide | null {
		const side = node.getAttr("connectionHandleSide")
		return side === "left" || side === "right" ? side : null
	}

	private isHandleDisabled(handle: Konva.Group): boolean {
		return handle.getAttr(ConnectionHandleRenderer.HANDLE_DISABLED_ATTR) === true
	}

	private resolveDisabledHandleSides(
		intent: Extract<ConnectionHandleOverlayIntent, { visible: true }>,
	): ConnectionHandleSide[] {
		const origin = this.getRendererOrigin(intent)
		const snapshot = collectSelectionContentSnapshot(
			this.canvas,
			origin.kind === "selection" ? origin.elementIds : [origin.elementId],
			"kind" in intent && intent.kind === "selection" ? intent.boundingRect : undefined,
		)
		return (["left", "right"] as const).filter((side) =>
			isConnectionMenuSideDisabled({
				origin:
					origin.kind === "selection"
						? {
								...origin,
								side,
								boundingRect:
									"kind" in intent && intent.kind === "selection"
										? intent.boundingRect
										: { x: 0, y: 0, width: 0, height: 0 },
							}
						: { ...origin, side },
				snapshot,
			}),
		)
	}

	private resetHandleInteractionState(): void {
		this.clearDisabledHandleHover()
		const hasInteraction = !!this.hoveredHandleNode || !!this.activeHandleNode
		const handles = new Set(
			[this.hoveredHandleNode, this.activeHandleNode].filter(
				(node): node is Konva.Group => node instanceof Konva.Group,
			),
		)
		handles.forEach((handle) => {
			if (handle.getParent()) {
				if (this.isHandleDisabled(handle)) {
					this.renderer.setHandleDisabledState(handle, true)
				} else {
					this.renderer.setHandleInteractionState(handle, "idle")
				}
			}
		})
		this.hoveredHandleNode = null
		this.activeHandleNode = null
		this.removeActiveHandleReleaseEvents()
		if (hasInteraction) {
			this.canvas.cursorManager.restoreToolCursor()
		}
	}

	private clearDisabledHandleHover(): void {
		if (!this.disabledHoveredCorridor) return
		this.disabledHoveredCorridor = null
		this.canvas.cursorManager.restoreToolCursor()
	}

	private restoreHandleCursorIfIdle(): void {
		if (this.hoveredHandleNode || this.activeHandleNode) return
		this.canvas.cursorManager.restoreToolCursor()
	}

	private bindActiveHandleReleaseEvents(): void {
		if (this.activeHandleReleaseUnsubscribers.length > 0) return
		if (typeof window === "undefined") return

		const release = () => {
			this.finishActiveHandle()
		}
		window.addEventListener("mouseup", release)
		window.addEventListener("touchend", release)
		window.addEventListener("touchcancel", release)
		this.activeHandleReleaseUnsubscribers = [
			() => window.removeEventListener("mouseup", release),
			() => window.removeEventListener("touchend", release),
			() => window.removeEventListener("touchcancel", release),
		]
	}

	private removeActiveHandleReleaseEvents(): void {
		this.activeHandleReleaseUnsubscribers.forEach((unsubscribe) => unsubscribe())
		this.activeHandleReleaseUnsubscribers = []
	}

	private stopHandleEvent(event: Konva.KonvaEventObject<Event>): void {
		event.cancelBubble = true
		event.evt?.stopPropagation()
		event.evt?.stopImmediatePropagation()
	}

	private scheduleReconcileAfterInteractionSettled(
		blocker?: ConnectionHandleInteractionBlocker,
	): void {
		if (blocker) {
			this.settledBlockers.add(blocker)
		}
		if (this.settledReconcileQueued) return
		this.settledReconcileQueued = true
		const schedule =
			typeof queueMicrotask === "function"
				? queueMicrotask
				: (callback: () => void) => {
						void Promise.resolve().then(callback)
					}
		schedule(() => {
			this.settledReconcileQueued = false
			if (this.destroyed) return
			this.settledBlockers.forEach((settledBlocker) => {
				this.interactionBlockers.delete(settledBlocker)
			})
			this.settledBlockers.clear()
			this.reconcile("interaction-settled", { forceGeometryUpdate: true })
		})
	}

	private playEnterAnimation(overlayNode: Konva.Group, stageScale: number): void {
		this.stopOverlayTweens(overlayNode)
		const handles = this.getHandleNodes(overlayNode)
		if (!this.canAnimateOverlay(overlayNode) || handles.length === 0) {
			this.showHandlesAtRest(overlayNode)
			return
		}

		handles.forEach((handle) => {
			const targetX = handle.x()
			const targetY = handle.y()
			handle.setAttrs({
				x: targetX + this.getInwardOffsetX(handle, stageScale),
				y: targetY,
				opacity: 0,
			})
			this.playTween(overlayNode, {
				node: handle,
				duration: ConnectionHandleOverlayManager.HANDLE_ENTER_DURATION_SECONDS,
				x: targetX,
				y: targetY,
				opacity: 1,
				easing: Konva.Easings.EaseOut,
				onUpdate: () => {
					this.requestControlsDraw("connection-handle-enter")
				},
				onFinish: () => {
					handle.opacity(1)
					this.requestControlsDraw("connection-handle-enter-finish")
				},
			})
		})
	}

	private playExitAnimation(overlayNode: Konva.Group): void {
		const handles = this.getHandleNodes(overlayNode)
		if (!this.canAnimateOverlay(overlayNode) || handles.length === 0) {
			this.finishExitAnimation(overlayNode)
			return
		}

		const stageScale = this.getSafeStageScale()
		let remaining = handles.length
		const finishOne = () => {
			remaining -= 1
			if (remaining <= 0) {
				this.finishExitAnimation(overlayNode)
			}
		}

		handles.forEach((handle) => {
			this.playTween(overlayNode, {
				node: handle,
				duration: ConnectionHandleOverlayManager.HANDLE_EXIT_DURATION_SECONDS,
				x: handle.x() + this.getInwardOffsetX(handle, stageScale),
				y: handle.y(),
				opacity: 0,
				easing: Konva.Easings.EaseIn,
				onUpdate: () => {
					this.requestControlsDraw("connection-handle-exit")
				},
				onFinish: finishOne,
			})
		})
	}

	private finishExitAnimation(overlayNode: Konva.Group): void {
		this.stopOverlayTweens(overlayNode)
		this.exitingOverlayNodes.delete(overlayNode)
		overlayNode.destroy()
		this.requestControlsDraw("connection-handle-exit-finish")
	}

	private showHandlesAtRest(overlayNode: Konva.Group): void {
		this.getHandleNodes(overlayNode).forEach((handle) => {
			handle.opacity(1)
		})
	}

	private getHandleNodes(overlayNode: Konva.Group): Konva.Group[] {
		return overlayNode
			.find(`.${ConnectionHandleRenderer.HANDLE_GROUP_NAME}`)
			.filter((node): node is Konva.Group => node instanceof Konva.Group)
	}

	private getCorridorNodes(overlayNode: Konva.Group): Konva.Rect[] {
		return overlayNode
			.find(`.${ConnectionHandleRenderer.HANDLE_CORRIDOR_NAME}`)
			.filter((node): node is Konva.Rect => node instanceof Konva.Rect)
	}

	private canAnimateOverlay(overlayNode: Konva.Group): boolean {
		return this.animationsEnabled && !!overlayNode.getLayer()
	}

	private getInwardOffsetX(handle: Konva.Group, stageScale: number): number {
		const scale = Number.isFinite(stageScale) && stageScale > 0 ? stageScale : 1
		const offset = ConnectionHandleOverlayManager.HANDLE_ANIMATION_OFFSET_PX / scale
		return handle.getAttr("connectionHandleSide") === "left" ? offset : -offset
	}

	private playTween(overlayNode: Konva.Group, config: Konva.TweenConfig): void {
		const tween = new Konva.Tween({
			...config,
			onFinish: () => {
				this.unregisterOverlayTween(overlayNode, tween)
				config.onFinish?.()
			},
		})
		this.registerOverlayTween(overlayNode, tween)
		tween.play()
	}

	private registerOverlayTween(overlayNode: Konva.Group, tween: Konva.Tween): void {
		const tweens = this.overlayTweens.get(overlayNode) ?? new Set<Konva.Tween>()
		tweens.add(tween)
		this.overlayTweens.set(overlayNode, tweens)
	}

	private unregisterOverlayTween(overlayNode: Konva.Group, tween: Konva.Tween): void {
		const tweens = this.overlayTweens.get(overlayNode)
		if (!tweens) return
		tweens.delete(tween)
		tween.destroy()
		if (tweens.size === 0) {
			this.overlayTweens.delete(overlayNode)
		}
	}

	private stopOverlayTweens(overlayNode: Konva.Group): void {
		const tweens = this.overlayTweens.get(overlayNode)
		if (!tweens) return
		tweens.forEach((tween) => {
			tween.destroy()
		})
		this.overlayTweens.delete(overlayNode)
	}

	private destroyAllOverlayTweens(): void {
		Array.from(this.overlayTweens.keys()).forEach((overlayNode) => {
			this.stopOverlayTweens(overlayNode)
		})
	}

	private destroyExitingOverlays(): void {
		this.exitingOverlayNodes.forEach((overlayNode) => {
			this.stopOverlayTweens(overlayNode)
			overlayNode.destroy()
		})
		this.exitingOverlayNodes.clear()
	}

	private disableOverlayListening(overlayNode: Konva.Group): void {
		overlayNode.listening(false)
		const selectors = ["Group", "Rect", "Circle", "Line"]
		selectors.forEach((selector) => {
			overlayNode.find(selector).forEach((node) => {
				node.listening(false)
			})
		})
	}

	private requestControlsDraw(reason: string): void {
		this.canvas.runtimeScheduler.requestLayerDraw("controls", {
			source: "ConnectionHandleOverlayManager",
			reason,
			priority: "input",
		})
	}
}
