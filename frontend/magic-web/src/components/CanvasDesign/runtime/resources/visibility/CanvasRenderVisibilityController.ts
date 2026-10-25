import type Konva from "konva"
import type { Canvas } from "../../core/Canvas"
import type { BaseElement } from "../../elements/core/BaseElement"

export type CanvasRenderVisibilityStrategy = "hidden" | "detached" | "destroyed"
export type CanvasRenderVisibilitySyncMode = "bootstrap" | "incremental" | "restore-only"

interface CulledElementState {
	// The effective strategy can differ from the configured strategy; container nodes fall back
	// from destroyed to detached so their child element instances keep their Konva nodes.
	strategy: CanvasRenderVisibilityStrategy
	visible: boolean
	listening: boolean
	// Parent/index are needed for detached and destroyed strategies to restore draw order.
	parent: Konva.Container | null
	index: number
}

export interface CanvasRenderVisibilitySyncOptions {
	activeElementIds: Iterable<string>
	allElementIds: Iterable<string>
	allowCullFar: boolean
	/** Bootstrap is also used for a later full reconcile after a topology revision. */
	mode?: Exclude<CanvasRenderVisibilitySyncMode, "restore-only">
	topologyRevision?: number
}

export interface CanvasRenderVisibilitySyncResult {
	hiddenCount: number
	restoredCount: number
	activeCount: number
	culledCount: number
}

export class CanvasRenderVisibilityController {
	private readonly canvas: Canvas
	private readonly strategy: CanvasRenderVisibilityStrategy
	private readonly culledElements = new Map<string, CulledElementState>()
	/** IDs currently admitted to the Konva render workset, including nodes retained during motion. */
	private readonly renderedActiveElementIds = new Set<string>()
	private hasBootstrapped = false
	private lastTopologyRevision: number | null = null

	constructor(options: { canvas: Canvas; strategy?: CanvasRenderVisibilityStrategy }) {
		this.canvas = options.canvas
		this.strategy = options.strategy ?? "hidden"
	}

	public sync(options: CanvasRenderVisibilitySyncOptions): CanvasRenderVisibilitySyncResult {
		const activeElementIds: ReadonlySet<string> =
			options.activeElementIds instanceof Set
				? options.activeElementIds
				: new Set(options.activeElementIds)
		let hiddenCount = 0
		let restoredCount = 0
		const mode =
			options.mode ??
			(!this.hasBootstrapped && options.allowCullFar ? "bootstrap" : "incremental")

		// Before the first settled drain, far nodes remain untouched. This preserves the initial
		// loading window and avoids turning an ordinary viewport refresh into a full-document walk.
		if (mode === "incremental" && !this.hasBootstrapped) {
			return {
				hiddenCount,
				restoredCount,
				activeCount: activeElementIds.size,
				culledCount: this.culledElements.size,
			}
		}

		if (mode === "bootstrap") {
			const allElementIds = new Set(options.allElementIds)
			const nextRenderedActiveElementIds = new Set<string>()

			activeElementIds.forEach((elementId) => {
				if (!allElementIds.has(elementId)) return
				if (this.restoreElement(elementId)) {
					restoredCount += 1
				}
				nextRenderedActiveElementIds.add(elementId)
			})

			if (options.allowCullFar) {
				// The full list is consumed only for bootstrap/topology reconciliation. During motion,
				// the incremental path below works from the admitted set and never enumerates all nodes.
				for (const elementId of allElementIds) {
					if (activeElementIds.has(elementId)) continue
					if (this.hideElement(elementId)) {
						hiddenCount += 1
					}
				}
			}

			// A deleted element can leave a cull record behind because no BaseElement exists to restore.
			// Drop that record while the authoritative element list is already available.
			for (const elementId of this.culledElements.keys()) {
				if (!allElementIds.has(elementId)) this.culledElements.delete(elementId)
			}

			this.renderedActiveElementIds.clear()
			nextRenderedActiveElementIds.forEach((elementId) =>
				this.renderedActiveElementIds.add(elementId),
			)
			this.hasBootstrapped = true
			if (options.topologyRevision !== undefined) {
				this.lastTopologyRevision = options.topologyRevision
			}
		} else {
			// Restoring only newly admitted IDs avoids calling into every active Konva node on each
			// pan/zoom frame. A culled record is also restored defensively if another lifecycle path
			// hid the node after it entered the workset.
			for (const elementId of activeElementIds) {
				if (
					!this.renderedActiveElementIds.has(elementId) ||
					this.culledElements.has(elementId)
				) {
					if (this.restoreElement(elementId)) {
						restoredCount += 1
					}
					this.renderedActiveElementIds.add(elementId)
				}
			}

			if (options.allowCullFar) {
				// Nodes are retained while the viewport is moving. Once the delayed drain allows culling,
				// remove only IDs that leave the previously admitted workset; no document enumeration is
				// needed for this diff.
				for (const elementId of this.renderedActiveElementIds) {
					if (activeElementIds.has(elementId)) continue
					if (this.hideElement(elementId)) {
						hiddenCount += 1
					}
					this.renderedActiveElementIds.delete(elementId)
				}
			}
		}

		if (hiddenCount > 0 || restoredCount > 0) {
			this.canvas.runtimeScheduler.requestLayerDraw("content", {
				source: "CanvasRenderVisibilityController",
				reason: "render-visibility-sync",
				priority: "normal",
			})
		}

		return {
			hiddenCount,
			restoredCount,
			activeCount: activeElementIds.size,
			culledCount: this.culledElements.size,
		}
	}

	public restoreAll(): void {
		const elementIds = Array.from(this.culledElements.keys())
		let restoredCount = 0
		elementIds.forEach((elementId) => {
			if (this.restoreElement(elementId)) {
				restoredCount += 1
			}
		})
		if (restoredCount > 0) {
			this.canvas.runtimeScheduler.requestLayerDraw("content", {
				source: "CanvasRenderVisibilityController",
				reason: "render-visibility-restore-all",
				priority: "normal",
			})
		}
		this.renderedActiveElementIds.clear()
		this.hasBootstrapped = false
		this.lastTopologyRevision = null
	}

	public getCulledCount(): number {
		return this.culledElements.size
	}

	public hasBootstrappedRenderWorkset(): boolean {
		return this.hasBootstrapped
	}

	public getLastTopologyRevision(): number | null {
		return this.lastTopologyRevision
	}

	private hideElement(elementId: string): boolean {
		if (this.culledElements.has(elementId)) return false
		const element = this.canvas.elementManager.getElementInstance(elementId)
		if (!element) return false
		const node = element?.getNode()
		if (!node) return false
		const strategy = this.getEffectiveStrategy(element, node)
		const state: CulledElementState = {
			strategy,
			visible: node.visible(),
			listening: node.listening(),
			parent: node.getParent(),
			index: this.getNodeIndex(node),
		}

		this.culledElements.set(elementId, state)
		if (strategy === "hidden") {
			node.visible(false)
			node.listening(false)
			return true
		}
		if (strategy === "detached") {
			// remove() detaches the node from drawing/hit graphs while keeping the node reusable.
			node.remove()
			return true
		}

		// destroyed is the most aggressive render-only strategy: drop the Konva node but keep
		// the BaseElement instance and media resources alive for a later render() restore.
		element.destroyRenderNodeForVisibilityCull()
		return true
	}

	private restoreElement(elementId: string): boolean {
		const state = this.culledElements.get(elementId)
		if (!state) return false
		this.culledElements.delete(elementId)

		const element = this.canvas.elementManager.getElementInstance(elementId)
		if (!element) return false
		if (state.strategy === "destroyed") {
			return this.restoreDestroyedElement(element, state)
		}
		const node = element.getNode()
		if (!node) return false
		if (state.strategy === "detached" && state.parent && !node.getParent()) {
			state.parent.add(node)
			this.restoreNodeIndex(node, state)
		}
		node.visible(element.getData().visible ?? state.visible)
		node.listening(state.listening)
		return true
	}

	private restoreDestroyedElement(element: BaseElement, state: CulledElementState): boolean {
		if (!state.parent) return false
		const node = element.render()
		if (!node) return false
		state.parent.add(node)
		this.restoreNodeIndex(node, state)
		node.visible(element.getData().visible ?? state.visible)
		node.listening(state.listening)
		element.onMounted()
		this.canvas.eventEmitter.emit({
			type: "element:rerendered",
			data: { elementId: element.getId(), data: element.getData() },
		})
		return true
	}

	private getEffectiveStrategy(
		element: BaseElement,
		node: Konva.Node,
	): CanvasRenderVisibilityStrategy {
		if (this.strategy !== "destroyed") return this.strategy
		// Destroying a frame/group root would also destroy children nodes that still belong to
		// independent BaseElement instances, so containers use detachable culling instead.
		const data = element.getData()
		if ("children" in data && Array.isArray(data.children) && data.children.length > 0) {
			return "detached"
		}
		if (!node.getParent()) return "hidden"
		return "destroyed"
	}

	private getNodeIndex(node: Konva.Node): number {
		const parent = node.getParent()
		if (!parent) return -1
		return Array.from(parent.getChildren()).indexOf(node)
	}

	private restoreNodeIndex(node: Konva.Node, state: CulledElementState): void {
		if (state.index < 0) return
		const parent = node.getParent()
		if (!parent) return
		const maxIndex = Math.max(0, parent.getChildren().length - 1)
		node.zIndex(Math.min(state.index, maxIndex))
	}
}
