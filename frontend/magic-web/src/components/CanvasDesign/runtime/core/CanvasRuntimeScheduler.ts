import Konva from "konva"
import type { Canvas } from "./Canvas"

export type CanvasLayerName = "stage" | "content" | "selection" | "controls" | "markers" | "overlay"

export type CanvasDrawPriority = "input" | "normal" | "background"

export interface CanvasLayerDrawRequest {
	source: string
	reason: string
	priority?: CanvasDrawPriority
}

export interface CanvasRuntimeSchedulerLayerSnapshot {
	requestedCount: number
	drawnCount: number
	coalescedCount: number
	skippedByStageDrawCount: number
	pending: boolean
	lastReasons: string[]
}

export interface CanvasRuntimeSchedulerViewportScaleLayoutSnapshot {
	registeredElementCount: number
	registeredCallbackCount: number
	activeElementCount: number
	dispatchCount: number
	totalCallbackCount: number
	activationCallbackCount: number
	lastVisitedElementCount: number
	lastCallbackCount: number
}

export interface CanvasRuntimeSchedulerSnapshot {
	destroyed: boolean
	pendingDrawCount: number
	flushCount: number
	drawRequestCount: number
	drawnCount: number
	coalescedDrawRequestCount: number
	skippedByStageDrawCount: number
	peakPendingDrawCount: number
	lastFlushDurationMs: number
	lastFlushDrawnLayers: CanvasLayerName[]
	lastFlushSkippedLayers: CanvasLayerName[]
	drawReasonCounts: Record<string, number>
	layers: Record<CanvasLayerName, CanvasRuntimeSchedulerLayerSnapshot>
	viewportScaleLayouts: CanvasRuntimeSchedulerViewportScaleLayoutSnapshot
}

interface PendingLayerDraw {
	layerName: CanvasLayerName
	reasons: Set<string>
	requestCount: number
	firstRequestedAt: number
	highestPriority: CanvasDrawPriority
}

interface LayerStats {
	requestedCount: number
	drawnCount: number
	coalescedCount: number
	skippedByStageDrawCount: number
	lastReasons: string[]
}

type ViewportScaleLayoutCallback = () => void

interface ViewportScaleLayoutEntry {
	callbacks: Set<ViewportScaleLayoutCallback>
	snapshot?: ViewportScaleLayoutCallback[]
}

const LAYER_NAMES: CanvasLayerName[] = [
	"stage",
	"content",
	"selection",
	"controls",
	"markers",
	"overlay",
]

const PRIORITY_RANK: Record<CanvasDrawPriority, number> = {
	input: 0,
	normal: 1,
	background: 2,
}

type CanvasRuntimeFrameHandle = number | ReturnType<typeof globalThis.setTimeout>

function now(): number {
	return typeof performance === "undefined" ? Date.now() : performance.now()
}

function createLayerStats(): Record<CanvasLayerName, LayerStats> {
	return LAYER_NAMES.reduce(
		(acc, layerName) => {
			acc[layerName] = {
				requestedCount: 0,
				drawnCount: 0,
				coalescedCount: 0,
				skippedByStageDrawCount: 0,
				lastReasons: [],
			}
			return acc
		},
		{} as Record<CanvasLayerName, LayerStats>,
	)
}

function createLayerSnapshot(
	stats: Record<CanvasLayerName, LayerStats>,
	pendingDraws: Map<CanvasLayerName, PendingLayerDraw>,
): Record<CanvasLayerName, CanvasRuntimeSchedulerLayerSnapshot> {
	return LAYER_NAMES.reduce(
		(acc, layerName) => {
			const layerStats = stats[layerName]
			acc[layerName] = {
				requestedCount: layerStats.requestedCount,
				drawnCount: layerStats.drawnCount,
				coalescedCount: layerStats.coalescedCount,
				skippedByStageDrawCount: layerStats.skippedByStageDrawCount,
				pending: pendingDraws.has(layerName),
				lastReasons: [...layerStats.lastReasons],
			}
			return acc
		},
		{} as Record<CanvasLayerName, CanvasRuntimeSchedulerLayerSnapshot>,
	)
}

function getReasonList(reasons: ReadonlySet<string>): string[] {
	const result: string[] = []
	reasons.forEach((reason) => {
		result.push(reason)
	})
	return result
}

function getRafScheduler(): {
	request: (callback: FrameRequestCallback) => CanvasRuntimeFrameHandle
	cancel: (handle: CanvasRuntimeFrameHandle) => void
} {
	if (typeof requestAnimationFrame === "function") {
		return {
			request: (callback: FrameRequestCallback) => requestAnimationFrame(callback),
			cancel: (handle: CanvasRuntimeFrameHandle) => {
				if (typeof handle === "number") {
					cancelAnimationFrame(handle)
				}
			},
		}
	}

	return {
		request: (callback: FrameRequestCallback) =>
			globalThis.setTimeout(() => callback(now()), 16),
		cancel: (handle: CanvasRuntimeFrameHandle) => globalThis.clearTimeout(handle),
	}
}

export class CanvasRuntimeScheduler {
	private readonly canvas: Canvas
	private destroyed = false
	private frameHandle: CanvasRuntimeFrameHandle | null = null
	private readonly pendingDraws = new Map<CanvasLayerName, PendingLayerDraw>()
	private readonly layerStats = createLayerStats()
	private readonly drawReasonCounts = new Map<string, number>()
	private readonly viewportScaleLayouts = new Map<string, ViewportScaleLayoutEntry>()
	/** Latest spatially eligible IDs, including elements whose layout callback has not mounted yet. */
	private viewportScaleLayoutEligibleElementIds: ReadonlySet<string> | null = null
	/** Registered callbacks that are also inside the latest spatial eligibility window. */
	private activeViewportScaleLayoutElementIds = new Set<string>()
	private hasViewportScaleLayoutEligibility = false
	private viewportScaleUnsubscribe?: () => void
	private flushCount = 0
	private drawRequestCount = 0
	private drawnCount = 0
	private coalescedDrawRequestCount = 0
	private skippedByStageDrawCount = 0
	private peakPendingDrawCount = 0
	private lastFlushDurationMs = 0
	private lastFlushDrawnLayers: CanvasLayerName[] = []
	private lastFlushSkippedLayers: CanvasLayerName[] = []
	private viewportScaleLayoutCallbackCount = 0
	private viewportScaleLayoutDispatchCount = 0
	private viewportScaleLayoutTotalCallbackCount = 0
	private viewportScaleLayoutActivationCallbackCount = 0
	private lastViewportScaleLayoutVisitedElementCount = 0
	private lastViewportScaleLayoutCallbackCount = 0

	constructor(options: { canvas: Canvas }) {
		this.canvas = options.canvas
		this.viewportScaleUnsubscribe = this.canvas.eventEmitter.on(
			"viewport:scale",
			this.flushViewportScaleLayouts,
		)
	}

	/**
	 * Register viewport-scale work by element so visibility queries can keep far elements out of
	 * the hot dispatch path. One Canvas-level event listener replaces O(element count) listeners.
	 */
	public registerViewportScaleLayout(
		elementId: string,
		callback: ViewportScaleLayoutCallback,
	): () => void {
		if (this.destroyed) return () => undefined

		let entry = this.viewportScaleLayouts.get(elementId)
		if (!entry) {
			entry = { callbacks: new Set() }
			this.viewportScaleLayouts.set(elementId, entry)
		}
		if (!entry.callbacks.has(callback)) {
			entry.callbacks.add(callback)
			entry.snapshot = undefined
			this.viewportScaleLayoutCallbackCount += 1
		}
		if (this.viewportScaleLayoutEligibleElementIds?.has(elementId)) {
			// Registration can happen after the last visibility pass. Only activate it when the last
			// spatial result already says the element is inside the layout window; far registrations
			// must wait for a later query instead of entering every scale dispatch.
			this.activeViewportScaleLayoutElementIds.add(elementId)
		}

		return () => {
			const current = this.viewportScaleLayouts.get(elementId)
			if (!current?.callbacks.delete(callback)) return
			current.snapshot = undefined
			this.viewportScaleLayoutCallbackCount -= 1
			if (current.callbacks.size === 0) {
				this.viewportScaleLayouts.delete(elementId)
				// The active set is long lived between visibility queries. Remove empty entries here so
				// element teardown cannot leave stale IDs in dispatch counts or future membership checks.
				this.activeViewportScaleLayoutElementIds.delete(elementId)
			}
		}
	}

	public getViewportScaleLayoutElementCount(): number {
		return this.viewportScaleLayouts.size
	}

	/**
	 * VisibilityManager transfers the latest spatial eligibility window. The scheduler keeps only
	 * registered callbacks from that window in the hot dispatch set. Layouts that become active are
	 * synchronized once because they may have skipped intervening scales.
	 */
	public replaceViewportScaleLayoutEligibility(elementIds: ReadonlySet<string>): void {
		if (this.destroyed) return
		const previousElementIds = this.hasViewportScaleLayoutEligibility
			? this.activeViewportScaleLayoutElementIds
			: null
		this.viewportScaleLayoutEligibleElementIds = elementIds
		const nextActiveElementIds = new Set<string>()
		this.viewportScaleLayoutEligibleElementIds.forEach((elementId) => {
			if (this.viewportScaleLayouts.has(elementId)) nextActiveElementIds.add(elementId)
		})
		this.hasViewportScaleLayoutEligibility = true
		this.activeViewportScaleLayoutElementIds = nextActiveElementIds
		if (previousElementIds === null) return

		let callbackCount = 0
		this.runWithKonvaAutoDrawDisabled(() => {
			nextActiveElementIds.forEach((elementId) => {
				if (previousElementIds.has(elementId)) return
				callbackCount += this.invokeViewportScaleLayoutEntry(elementId)
			})
		})
		if (callbackCount === 0) return

		this.viewportScaleLayoutActivationCallbackCount += callbackCount
		this.requestLayerDraw("content", {
			source: "CanvasRuntimeScheduler",
			reason: "viewport-layout-activate",
			priority: "normal",
		})
	}

	public requestLayerDraw(layerName: CanvasLayerName, request: CanvasLayerDrawRequest): void {
		if (this.destroyed) return

		this.drawRequestCount += 1
		this.layerStats[layerName].requestedCount += 1
		const reasonKey = `${request.source}:${request.reason}`
		this.drawReasonCounts.set(reasonKey, (this.drawReasonCounts.get(reasonKey) ?? 0) + 1)

		const priority = request.priority ?? "normal"
		const pending = this.pendingDraws.get(layerName)
		if (pending) {
			pending.requestCount += 1
			pending.reasons.add(reasonKey)
			if (PRIORITY_RANK[priority] < PRIORITY_RANK[pending.highestPriority]) {
				pending.highestPriority = priority
			}
			this.layerStats[layerName].coalescedCount += 1
			this.coalescedDrawRequestCount += 1
			return
		}

		this.pendingDraws.set(layerName, {
			layerName,
			reasons: new Set([reasonKey]),
			requestCount: 1,
			firstRequestedAt: now(),
			highestPriority: priority,
		})
		this.peakPendingDrawCount = Math.max(this.peakPendingDrawCount, this.pendingDraws.size)
		this.scheduleFlush()
	}

	public flushDraws(): void {
		if (this.destroyed || this.pendingDraws.size === 0) return
		if (this.frameHandle !== null) {
			getRafScheduler().cancel(this.frameHandle)
			this.frameHandle = null
		}

		const startedAt = now()
		const pendingDraws: PendingLayerDraw[] = []
		this.pendingDraws.forEach((pendingDraw) => {
			pendingDraws.push(pendingDraw)
		})
		pendingDraws.sort((a, b) => {
			const priorityDiff = PRIORITY_RANK[a.highestPriority] - PRIORITY_RANK[b.highestPriority]
			if (priorityDiff !== 0) return priorityDiff
			return a.firstRequestedAt - b.firstRequestedAt
		})
		this.pendingDraws.clear()

		const hasStageDraw = pendingDraws.some((item) => item.layerName === "stage")
		const drawnLayers: CanvasLayerName[] = []
		const skippedLayers: CanvasLayerName[] = []

		for (const pending of pendingDraws) {
			if (hasStageDraw && pending.layerName !== "stage") {
				this.skippedByStageDrawCount += 1
				this.layerStats[pending.layerName].skippedByStageDrawCount += 1
				this.layerStats[pending.layerName].lastReasons = getReasonList(pending.reasons)
				skippedLayers.push(pending.layerName)
				continue
			}

			const target = this.getDrawTarget(pending.layerName)
			if (!target) continue
			// The scheduler has already coalesced requests and entered its RAF callback. Calling
			// Konva.batchDraw() here would enqueue another RAF, adding a frame of input latency and
			// making flush duration/count stats describe scheduling instead of the actual draw.
			target.draw()
			this.drawnCount += 1
			this.layerStats[pending.layerName].drawnCount += 1
			this.layerStats[pending.layerName].lastReasons = getReasonList(pending.reasons)
			drawnLayers.push(pending.layerName)
		}

		this.flushCount += 1
		this.lastFlushDurationMs = now() - startedAt
		this.lastFlushDrawnLayers = drawnLayers
		this.lastFlushSkippedLayers = skippedLayers
	}

	private readonly flushViewportScaleLayouts = (): void => {
		if (this.destroyed || this.viewportScaleLayouts.size === 0) return

		let visitedElementCount = 0
		let callbackCount = 0
		this.runWithKonvaAutoDrawDisabled(() => {
			this.activeViewportScaleLayoutElementIds.forEach((elementId) => {
				if (!this.viewportScaleLayouts.has(elementId)) return
				visitedElementCount += 1
				callbackCount += this.invokeViewportScaleLayoutEntry(elementId)
			})
		})

		this.viewportScaleLayoutDispatchCount += 1
		this.viewportScaleLayoutTotalCallbackCount += callbackCount
		this.lastViewportScaleLayoutVisitedElementCount = visitedElementCount
		this.lastViewportScaleLayoutCallbackCount = callbackCount
	}

	public getSnapshot(): CanvasRuntimeSchedulerSnapshot {
		return {
			destroyed: this.destroyed,
			pendingDrawCount: this.pendingDraws.size,
			flushCount: this.flushCount,
			drawRequestCount: this.drawRequestCount,
			drawnCount: this.drawnCount,
			coalescedDrawRequestCount: this.coalescedDrawRequestCount,
			skippedByStageDrawCount: this.skippedByStageDrawCount,
			peakPendingDrawCount: this.peakPendingDrawCount,
			lastFlushDurationMs: this.lastFlushDurationMs,
			lastFlushDrawnLayers: [...this.lastFlushDrawnLayers],
			lastFlushSkippedLayers: [...this.lastFlushSkippedLayers],
			drawReasonCounts: Object.fromEntries(this.drawReasonCounts),
			layers: createLayerSnapshot(this.layerStats, this.pendingDraws),
			viewportScaleLayouts: {
				registeredElementCount: this.viewportScaleLayouts.size,
				registeredCallbackCount: this.viewportScaleLayoutCallbackCount,
				activeElementCount: this.activeViewportScaleLayoutElementIds.size,
				dispatchCount: this.viewportScaleLayoutDispatchCount,
				totalCallbackCount: this.viewportScaleLayoutTotalCallbackCount,
				activationCallbackCount: this.viewportScaleLayoutActivationCallbackCount,
				lastVisitedElementCount: this.lastViewportScaleLayoutVisitedElementCount,
				lastCallbackCount: this.lastViewportScaleLayoutCallbackCount,
			},
		}
	}

	public destroy(): void {
		this.destroyed = true
		this.viewportScaleUnsubscribe?.()
		this.viewportScaleUnsubscribe = undefined
		if (this.frameHandle !== null) {
			getRafScheduler().cancel(this.frameHandle)
			this.frameHandle = null
		}
		this.pendingDraws.clear()
		this.viewportScaleLayouts.clear()
		this.viewportScaleLayoutEligibleElementIds = null
		this.activeViewportScaleLayoutElementIds.clear()
		this.hasViewportScaleLayoutEligibility = false
		this.viewportScaleLayoutCallbackCount = 0
	}

	private invokeViewportScaleLayoutEntry(elementId: string): number {
		const entry = this.viewportScaleLayouts.get(elementId)
		if (!entry || entry.callbacks.size === 0) return 0

		const callbacks = entry.snapshot ?? Array.from(entry.callbacks)
		entry.snapshot = callbacks
		callbacks.forEach((callback) => {
			try {
				callback()
			} catch (error) {
				console.error(`Error in viewport scale layout for element "${elementId}":`, error)
			}
		})
		return callbacks.length
	}

	private runWithKonvaAutoDrawDisabled(callback: () => void): void {
		const previousAutoDrawEnabled = Konva.autoDrawEnabled
		Konva.autoDrawEnabled = false
		try {
			callback()
		} finally {
			Konva.autoDrawEnabled = previousAutoDrawEnabled
		}
	}

	private scheduleFlush(): void {
		if (this.frameHandle !== null) return
		this.frameHandle = getRafScheduler().request(() => {
			this.frameHandle = null
			this.flushDraws()
		})
	}

	private getDrawTarget(layerName: CanvasLayerName): Konva.Stage | Konva.Layer | null {
		if (layerName === "stage") return this.canvas.stage
		if (layerName === "content") return this.canvas.contentLayer
		if (layerName === "selection") return this.canvas.selectionLayer
		if (layerName === "controls") return this.canvas.controlsLayer
		if (layerName === "markers") return this.canvas.markersLayer
		return this.canvas.overlayLayer
	}
}
