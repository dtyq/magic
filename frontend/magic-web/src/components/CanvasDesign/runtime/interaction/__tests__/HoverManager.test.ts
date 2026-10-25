import Konva from "konva"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { HoverManager } from "../hover/HoverManager"
import type { LayerElement } from "../../document/types"

interface HoverManagerPrivate {
	handleMouseMove: (event: { target: Konva.Node }) => void
	handleMouseLeave: () => void
	hoverNode: Konva.Node | null
	hoveredElementId: string | null
	destroy: () => void
}

function installRafMock() {
	const callbacks: FrameRequestCallback[] = []
	vi.stubGlobal(
		"requestAnimationFrame",
		vi.fn((callback: FrameRequestCallback) => {
			callbacks.push(callback)
			return callbacks.length
		}),
	)
	vi.stubGlobal("cancelAnimationFrame", vi.fn())
	return {
		flush: () => {
			const callback = callbacks.shift()
			callback?.(0)
		},
		count: () => callbacks.length,
	}
}

function createHoverManager(
	options: {
		transformActive?: boolean | (() => boolean)
		transforming?: boolean | (() => boolean)
		activeTransforming?: boolean | (() => boolean)
		selected?: boolean | (() => boolean)
		connectionDragging?: boolean | (() => boolean)
		geometryHitIds?: string[]
		viewportHitTarget?: Konva.Node | null
		extendingElementId?: string | null
		hasConnections?: boolean
		customHoverNode?: Konva.Shape | Konva.Group | null
	} = {},
) {
	const stage = new Konva.Group()
	const contentLayer = new Konva.Group()
	const controlsLayer = new Konva.Group()
	const requestLayerDraw = vi.fn()
	const emit = vi.fn()
	const getPointerPosition = vi.fn(() => ({ x: 30, y: 40 }))
	const getIntersection = vi.fn(() => options.viewportHitTarget ?? null)
	const updateHoverEffect = vi.fn()
	const eventHandlers = new Map<string, Array<(event: { data?: unknown }) => void>>()
	const getOptionValue = (value: boolean | (() => boolean) | undefined, fallback: boolean) =>
		typeof value === "function" ? value() : (value ?? fallback)
	const isSelected = () => getOptionValue(options.selected, false)
	const isTransformActive = () => getOptionValue(options.transformActive, false)
	const isTransforming = () => getOptionValue(options.transforming, false)
	const isConnectionDragging = () => getOptionValue(options.connectionDragging, false)
	const isActiveTransforming = () =>
		getOptionValue(options.activeTransforming, isTransformActive() && isTransforming())
	const elementData: LayerElement = {
		id: "element-1",
		type: "rectangle",
		x: 10,
		y: 20,
		width: 120,
		height: 80,
		activeContentId: "element-1-content",
		mainContentId: "element-1-content",
		contents: [{ contentId: "element-1-content" }],
	}
	const canvas = {
		stage,
		contentLayer,
		controlsLayer,
		runtimeScheduler: { requestLayerDraw },
		eventEmitter: {
			on: vi.fn((eventType: string, handler: (event: { data?: unknown }) => void) => {
				const handlers = eventHandlers.get(eventType) ?? []
				handlers.push(handler)
				eventHandlers.set(eventType, handlers)
				return () => {
					const currentHandlers = eventHandlers.get(eventType) ?? []
					eventHandlers.set(
						eventType,
						currentHandlers.filter((currentHandler) => currentHandler !== handler),
					)
				}
			}),
			off: vi.fn(),
			emit,
		},
		elementManager: {
			hasElement: (elementId: string) => elementId === "element-1",
			getElementData: () => elementData,
			getElementInstance: () => undefined,
			getNodeAdapter: () => ({
				getElementBounds: () => ({ x: 10, y: 20, width: 120, height: 80 }),
				createHoverEffect: () => options.customHoverNode ?? null,
				updateHoverEffect,
			}),
		},
		geometryCacheManager: {
			queryElementIdsByExpandedRect: () => options.geometryHitIds ?? [],
		},
		permissionManager: {
			canHover: () => true,
		},
		selectionManager: {
			isSelected,
			getSelectedIds: () => (isSelected() ? ["element-1"] : []),
		},
		transformManager: {
			isTransformInteractionActive: isTransformActive,
			isTransforming,
			isElementInActiveTransformInteraction: () => isActiveTransforming(),
			isDraggingElement: () => false,
		},
		connectionDragManager: {
			isDraggingConnection: isConnectionDragging,
		},
		connectionManager: {
			hasConnections: () => options.hasConnections ?? true,
		},
		extendManager: {
			getExtendingElementId: () => options.extendingElementId ?? null,
		},
	}

	;(stage as unknown as { getPointerPosition: typeof getPointerPosition }).getPointerPosition =
		getPointerPosition
	;(stage as unknown as { getIntersection: typeof getIntersection }).getIntersection =
		getIntersection

	const manager = new HoverManager({ canvas: canvas as never }) as unknown as HoverManagerPrivate
	const target = new Konva.Rect({ id: "element-1" })
	return {
		emit,
		eventHandlers,
		getIntersection,
		getPointerPosition,
		manager,
		requestLayerDraw,
		stage,
		target,
		updateHoverEffect,
	}
}

function createTransformerAnchor(): Konva.Rect {
	const transformer = new Konva.Transformer()
	const target = new Konva.Rect({ width: 120, height: 80 })
	transformer.nodes([target])
	return transformer.findOne(".middle-right") as Konva.Rect
}

function createConnectionHitPathInsideElement(): Konva.Path {
	const elementNode = new Konva.Group({ id: "element-1" })
	const connectionGroup = new Konva.Group({ name: "canvas-connection" })
	connectionGroup.setAttr("connectionId", "connection-1")
	const hitPath = new Konva.Path({
		name: "canvas-connection-hit-path",
		data: "M 10 10 C 40 10 40 40 70 40",
	})
	hitPath.setAttr("connectionId", "connection-1")
	connectionGroup.add(hitPath)
	elementNode.add(connectionGroup)
	return hitPath
}

describe("HoverManager", () => {
	beforeEach(() => {
		vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
			clearRect: vi.fn(),
			fillRect: vi.fn(),
			getImageData: vi.fn(() => ({ data: new Uint8ClampedArray([0, 0, 0, 0]) })),
		} as unknown as CanvasRenderingContext2D)
	})

	afterEach(() => {
		vi.useRealTimers()
		vi.unstubAllGlobals()
		vi.restoreAllMocks()
	})

	it("coalesces mousemove handling into a single frame", () => {
		const raf = installRafMock()
		const { manager, requestLayerDraw, target } = createHoverManager()

		manager.handleMouseMove({ target })
		manager.handleMouseMove({ target })

		expect(raf.count()).toBe(1)
		expect(requestLayerDraw).not.toHaveBeenCalled()

		raf.flush()

		expect(requestLayerDraw).toHaveBeenCalledTimes(1)
		expect(manager.hoveredElementId).toBe("element-1")
		manager.destroy()
	})

	it("reuses the default hover node for the same element", () => {
		const raf = installRafMock()
		const { manager, requestLayerDraw, target } = createHoverManager()

		manager.handleMouseMove({ target })
		raf.flush()
		const firstHoverNode = manager.hoverNode
		manager.handleMouseMove({ target })
		raf.flush()

		expect(manager.hoverNode).toBe(firstHoverNode)
		expect(requestLayerDraw).toHaveBeenCalledTimes(1)
		manager.destroy()
	})

	it("clears hover while transform interaction is active", () => {
		const raf = installRafMock()
		let transformActive = false
		const { manager, requestLayerDraw, target } = createHoverManager()

		manager.handleMouseMove({ target })
		raf.flush()
		expect(manager.hoveredElementId).toBe("element-1")

		const active = createHoverManager({ transformActive: () => transformActive })
		active.manager.handleMouseMove({ target })
		raf.flush()
		expect(active.manager.hoveredElementId).toBe("element-1")

		transformActive = true
		active.manager.handleMouseMove({ target })
		raf.flush()

		expect(active.manager.hoveredElementId).toBeNull()
		expect(requestLayerDraw).toHaveBeenCalledTimes(1)
		expect(active.requestLayerDraw).toHaveBeenCalledTimes(2)
		manager.destroy()
		active.manager.destroy()
	})

	it("keeps hover identity for a selected transformer-bound element without drawing hover", () => {
		const raf = installRafMock()
		const { emit, manager, requestLayerDraw, target } = createHoverManager({
			selected: true,
			transforming: true,
			activeTransforming: false,
		})

		manager.handleMouseMove({ target })
		raf.flush()

		expect(manager.hoveredElementId).toBe("element-1")
		expect(manager.hoverNode).toBeNull()
		expect(requestLayerDraw).not.toHaveBeenCalled()
		expect(emit).toHaveBeenCalledWith({
			type: "element:hover",
			data: { elementId: "element-1" },
		})
		manager.destroy()
	})

	it("keeps selected hover identity when the transformer anchor is the mousemove target", () => {
		const raf = installRafMock()
		const { emit, manager, requestLayerDraw } = createHoverManager({
			selected: true,
			transforming: true,
			activeTransforming: false,
		})
		const anchor = createTransformerAnchor()

		manager.handleMouseMove({ target: anchor })
		raf.flush()

		expect(manager.hoveredElementId).toBe("element-1")
		expect(manager.hoverNode).toBeNull()
		expect(requestLayerDraw).not.toHaveBeenCalled()
		expect(emit).toHaveBeenCalledWith({
			type: "element:hover",
			data: { elementId: "element-1" },
		})
		manager.destroy()
	})

	it("does not keep selected hover identity for a transformer anchor outside selected geometry", () => {
		const raf = installRafMock()
		const { getPointerPosition, manager, requestLayerDraw } = createHoverManager({
			selected: true,
			transforming: true,
			activeTransforming: false,
		})
		const anchor = createTransformerAnchor()

		getPointerPosition.mockReturnValue({ x: 200, y: 200 })
		manager.handleMouseMove({ target: anchor })
		raf.flush()

		expect(manager.hoveredElementId).toBeNull()
		expect(manager.hoverNode).toBeNull()
		expect(requestLayerDraw).not.toHaveBeenCalled()
		manager.destroy()
	})

	it("does not set element hover when the mousemove target is a connection node", () => {
		const raf = installRafMock()
		const { manager, requestLayerDraw, target } = createHoverManager()
		const connectionHitPath = createConnectionHitPathInsideElement()

		manager.handleMouseMove({ target })
		raf.flush()
		expect(manager.hoveredElementId).toBe("element-1")
		expect(manager.hoverNode).toBeInstanceOf(Konva.Rect)

		manager.handleMouseMove({ target: connectionHitPath })
		raf.flush()

		expect(manager.hoveredElementId).toBeNull()
		expect(manager.hoverNode).toBeNull()
		expect(requestLayerDraw).toHaveBeenCalledTimes(2)
		manager.destroy()
	})

	it("refreshes selected hover identity from the current pointer without drawing hover", () => {
		const { emit, eventHandlers, manager, requestLayerDraw } = createHoverManager({
			selected: true,
			transforming: true,
			activeTransforming: false,
			geometryHitIds: ["element-1"],
		})

		eventHandlers.get("element:select")?.[0]?.({ data: { elementIds: ["element-1"] } })

		expect(manager.hoveredElementId).toBe("element-1")
		expect(manager.hoverNode).toBeNull()
		expect(requestLayerDraw).not.toHaveBeenCalled()
		expect(emit).toHaveBeenCalledWith({
			type: "element:hover",
			data: { elementId: "element-1" },
		})
		manager.destroy()
	})

	it("restores the hover node after a selected hovered element is deselected", () => {
		const raf = installRafMock()
		let selected = true
		const { eventHandlers, manager, requestLayerDraw, target } = createHoverManager({
			selected: () => selected,
			transforming: () => selected,
			activeTransforming: false,
			geometryHitIds: ["element-1"],
		})

		manager.handleMouseMove({ target })
		raf.flush()
		expect(manager.hoveredElementId).toBe("element-1")
		expect(manager.hoverNode).toBeNull()

		selected = false
		eventHandlers.get("element:deselect")?.[0]?.({ data: { elementIds: ["element-1"] } })

		expect(manager.hoveredElementId).toBe("element-1")
		expect(manager.hoverNode).toBeInstanceOf(Konva.Rect)
		expect(requestLayerDraw).toHaveBeenCalledTimes(1)
		manager.destroy()
	})

	it("refreshes hover hit testing when the viewport pans without mouse movement", () => {
		const raf = installRafMock()
		const { eventHandlers, manager, target } = createHoverManager()

		manager.handleMouseMove({ target })
		raf.flush()
		expect(manager.hoveredElementId).toBe("element-1")

		eventHandlers.get("viewport:pan")?.[0]?.({ data: { x: 20, y: 30 } })

		expect(manager.hoveredElementId).toBeNull()
		manager.destroy()
		expect(eventHandlers.get("viewport:pan")).toHaveLength(0)
	})

	it("clears stale hover when viewport hit testing still returns the previous element", () => {
		const raf = installRafMock()
		const { eventHandlers, getIntersection, getPointerPosition, manager, target } =
			createHoverManager()

		manager.handleMouseMove({ target })
		raf.flush()
		expect(manager.hoveredElementId).toBe("element-1")

		getPointerPosition.mockReturnValue({ x: 200, y: 200 })
		getIntersection.mockReturnValue(target)
		eventHandlers.get("viewport:pan")?.[0]?.({ data: { x: 20, y: 30 } })

		expect(manager.hoveredElementId).toBeNull()
		manager.destroy()
	})

	it("sets hover from geometry after viewport pan settles under a stationary pointer", () => {
		vi.useFakeTimers()
		const { eventHandlers, getIntersection, manager, requestLayerDraw } = createHoverManager({
			geometryHitIds: ["element-1"],
		})
		getIntersection.mockReturnValue(null)

		eventHandlers.get("viewport:pan")?.[0]?.({ data: { x: 20, y: 30 } })

		expect(manager.hoveredElementId).toBeNull()
		expect(requestLayerDraw).not.toHaveBeenCalled()
		vi.advanceTimersByTime(160)

		expect(manager.hoveredElementId).toBe("element-1")
		expect(requestLayerDraw).toHaveBeenCalledTimes(1)
		manager.destroy()
	})

	it("sets hover from geometry after viewport scale settles under a stationary pointer", () => {
		vi.useFakeTimers()
		const { eventHandlers, getIntersection, manager, requestLayerDraw } = createHoverManager({
			geometryHitIds: ["element-1"],
		})
		getIntersection.mockReturnValue(null)

		eventHandlers.get("viewport:scale")?.[0]?.({ data: { scale: 2 } })

		expect(manager.hoveredElementId).toBeNull()
		expect(requestLayerDraw).not.toHaveBeenCalled()
		vi.advanceTimersByTime(160)

		expect(manager.hoveredElementId).toBe("element-1")
		expect(requestLayerDraw).toHaveBeenCalledTimes(1)
		manager.destroy()
	})

	it("keeps the existing hover visuals during viewport scale and rechecks after settle", () => {
		vi.useFakeTimers()
		const raf = installRafMock()
		const {
			emit,
			eventHandlers,
			getPointerPosition,
			manager,
			requestLayerDraw,
			stage,
			target,
		} = createHoverManager()

		manager.handleMouseMove({ target })
		raf.flush()
		const hoverNode = manager.hoverNode
		expect(hoverNode).toBeInstanceOf(Konva.Rect)
		expect(manager.hoveredElementId).toBe("element-1")

		stage.scale({ x: 2, y: 2 })
		eventHandlers.get("viewport:scale")?.[0]?.({ data: { scale: 2 } })

		expect(manager.hoveredElementId).toBe("element-1")
		expect(manager.hoverNode).toBe(hoverNode)
		expect((hoverNode as Konva.Rect).strokeWidth()).toBe(1)
		expect(getPointerPosition).not.toHaveBeenCalled()
		expect(requestLayerDraw).toHaveBeenCalledTimes(1)
		expect(emit).not.toHaveBeenCalledWith({
			type: "element:hover",
			data: { elementId: null },
		})

		vi.advanceTimersByTime(160)

		expect(getPointerPosition).toHaveBeenCalledTimes(1)
		expect(manager.hoveredElementId).toBeNull()
		manager.destroy()
	})

	it("updates a custom hover node without recreating it during viewport scale", () => {
		vi.useFakeTimers()
		const customHoverNode = new Konva.Group()
		const { eventHandlers, manager, stage, target, updateHoverEffect } = createHoverManager({
			customHoverNode,
		})
		const raf = installRafMock()

		manager.handleMouseMove({ target })
		raf.flush()
		expect(manager.hoverNode).toBe(customHoverNode)

		stage.scale({ x: 2, y: 2 })
		eventHandlers.get("viewport:scale")?.[0]?.({ data: { scale: 2 } })

		expect(manager.hoverNode).toBe(customHoverNode)
		expect(updateHoverEffect).toHaveBeenCalledTimes(1)
		manager.destroy()
	})

	it("hit-tests once after zoom emits scale and pan in the same update", async () => {
		vi.useFakeTimers()
		const { eventHandlers, getPointerPosition, manager } = createHoverManager({
			geometryHitIds: ["element-1"],
		})

		eventHandlers.get("viewport:scale")?.[0]?.({ data: { scale: 2 } })
		eventHandlers.get("viewport:pan")?.[0]?.({ data: { x: 20, y: 30 } })

		expect(getPointerPosition).not.toHaveBeenCalled()
		vi.advanceTimersByTime(160)
		expect(getPointerPosition).toHaveBeenCalledTimes(1)

		await Promise.resolve()
		eventHandlers.get("viewport:pan")?.[0]?.({ data: { x: 30, y: 40 } })
		vi.advanceTimersByTime(160)
		expect(getPointerPosition).toHaveBeenCalledTimes(2)
		manager.destroy()
	})

	it("coalesces continuous viewport pan hit tests until movement settles", () => {
		vi.useFakeTimers()
		const { eventHandlers, getPointerPosition, manager } = createHoverManager({
			geometryHitIds: ["element-1"],
		})

		eventHandlers.get("viewport:pan")?.[0]?.({ data: { x: 10, y: 20 } })
		vi.advanceTimersByTime(100)
		eventHandlers.get("viewport:pan")?.[0]?.({ data: { x: 20, y: 30 } })
		vi.advanceTimersByTime(100)

		expect(getPointerPosition).not.toHaveBeenCalled()
		vi.advanceTimersByTime(60)
		expect(getPointerPosition).toHaveBeenCalledTimes(1)
		manager.destroy()
	})

	it("refreshes hover immediately when the viewport reports an explicit end", () => {
		vi.useFakeTimers()
		const { eventHandlers, getPointerPosition, manager } = createHoverManager({
			geometryHitIds: ["element-1"],
		})

		eventHandlers.get("viewport:pan")?.[0]?.({ data: { x: 20, y: 30 } })
		expect(getPointerPosition).not.toHaveBeenCalled()

		eventHandlers.get("viewport:changed")?.[0]?.({ data: { phase: "end" } })

		expect(getPointerPosition).toHaveBeenCalledTimes(1)
		expect(manager.hoveredElementId).toBe("element-1")
		expect(vi.getTimerCount()).toBe(0)
		manager.destroy()
	})

	it("does not leave hover suppressed when the viewport moves outside the stage", () => {
		vi.useFakeTimers()
		const raf = installRafMock()
		const { eventHandlers, manager, target } = createHoverManager()

		eventHandlers.get("viewport:pan")?.[0]?.({ data: { x: 20, y: 30 } })
		manager.handleMouseMove({ target })
		expect(raf.count()).toBe(0)

		manager.handleMouseLeave()
		eventHandlers.get("viewport:pan")?.[0]?.({ data: { x: 30, y: 40 } })
		expect(vi.getTimerCount()).toBe(0)

		manager.handleMouseMove({ target })
		expect(raf.count()).toBe(1)
		raf.flush()
		expect(manager.hoveredElementId).toBe("element-1")
		manager.destroy()
	})

	it("skips Konva intersection lookup during viewport refresh without connections", () => {
		vi.useFakeTimers()
		const { eventHandlers, getIntersection, manager } = createHoverManager({
			geometryHitIds: ["element-1"],
			hasConnections: false,
		})

		eventHandlers.get("viewport:scale")?.[0]?.({ data: { scale: 2 } })
		vi.advanceTimersByTime(160)

		expect(getIntersection).not.toHaveBeenCalled()
		expect(manager.hoveredElementId).toBe("element-1")
		manager.destroy()
	})

	it("does not refresh element hover from geometry when the current pointer hits a connection node", () => {
		vi.useFakeTimers()
		const { eventHandlers, getIntersection, manager, requestLayerDraw } = createHoverManager({
			geometryHitIds: ["element-1"],
		})
		getIntersection.mockReturnValue(createConnectionHitPathInsideElement())

		eventHandlers.get("viewport:pan")?.[0]?.({ data: { x: 20, y: 30 } })
		vi.advanceTimersByTime(160)

		expect(manager.hoveredElementId).toBeNull()
		expect(manager.hoverNode).toBeNull()
		expect(requestLayerDraw).not.toHaveBeenCalled()
		manager.destroy()
	})

	it("keeps hover visuals and suppresses hit testing while a pinch gesture is active", () => {
		const raf = installRafMock()
		const {
			eventHandlers,
			getIntersection,
			getPointerPosition,
			manager,
			requestLayerDraw,
			target,
		} = createHoverManager({
			geometryHitIds: ["element-1"],
		})

		manager.handleMouseMove({ target })
		raf.flush()
		expect(manager.hoveredElementId).toBe("element-1")

		eventHandlers.get("viewport:gesture")?.[0]?.({
			data: { active: true, source: "touch-pinch", pointerCount: 2 },
		})
		const hoverNode = manager.hoverNode
		expect(manager.hoveredElementId).toBe("element-1")
		expect(hoverNode).not.toBeNull()

		getIntersection.mockReturnValue(null)
		manager.handleMouseMove({ target: new Konva.Rect() })
		expect(raf.count()).toBe(0)
		eventHandlers.get("viewport:scale")?.[0]?.({ data: { scale: 2 } })

		expect(manager.hoveredElementId).toBe("element-1")
		expect(manager.hoverNode).toBe(hoverNode)
		expect(getPointerPosition).not.toHaveBeenCalled()
		expect(requestLayerDraw).toHaveBeenCalledTimes(1)

		eventHandlers.get("viewport:gesture")?.[0]?.({
			data: { active: false, source: "touch-pinch" },
		})

		expect(getPointerPosition).toHaveBeenCalledTimes(1)
		expect(manager.hoveredElementId).toBe("element-1")
		manager.destroy()
	})

	it("still clears hover when a non-zoom viewport gesture starts", () => {
		const raf = installRafMock()
		const { eventHandlers, manager, requestLayerDraw, target } = createHoverManager()

		manager.handleMouseMove({ target })
		raf.flush()
		eventHandlers.get("viewport:gesture")?.[0]?.({
			data: { active: true, source: "minimap", pointerCount: 1 },
		})

		expect(manager.hoveredElementId).toBeNull()
		expect(manager.hoverNode).toBeNull()
		expect(requestLayerDraw).toHaveBeenCalledTimes(2)
		manager.destroy()
	})

	it("does not set hover while extend mode is active", () => {
		const raf = installRafMock()
		const { manager, requestLayerDraw, target } = createHoverManager({
			extendingElementId: "element-1",
		})

		manager.handleMouseMove({ target })

		expect(raf.count()).toBe(0)
		expect(manager.hoveredElementId).toBeNull()
		expect(requestLayerDraw).not.toHaveBeenCalled()
		manager.destroy()
	})

	it("clears and suppresses hover while a connection drag is active", () => {
		const raf = installRafMock()
		let connectionDragging = false
		const { manager, requestLayerDraw, target } = createHoverManager({
			connectionDragging: () => connectionDragging,
		})

		manager.handleMouseMove({ target })
		raf.flush()
		expect(manager.hoveredElementId).toBe("element-1")
		expect(manager.hoverNode).toBeInstanceOf(Konva.Rect)

		connectionDragging = true
		manager.handleMouseMove({ target })

		expect(raf.count()).toBe(0)
		expect(manager.hoveredElementId).toBeNull()
		expect(manager.hoverNode).toBeNull()
		expect(requestLayerDraw).toHaveBeenCalledTimes(2)
		manager.destroy()
	})

	it("does not refresh hover from geometry while a connection drag is active", () => {
		const { eventHandlers, manager, requestLayerDraw } = createHoverManager({
			connectionDragging: true,
			geometryHitIds: ["element-1"],
		})

		eventHandlers.get("viewport:pan")?.[0]?.({ data: { x: 20, y: 30 } })

		expect(manager.hoveredElementId).toBeNull()
		expect(manager.hoverNode).toBeNull()
		expect(requestLayerDraw).not.toHaveBeenCalled()
		manager.destroy()
	})

	it("does not refresh hover from geometry while extend mode is active", () => {
		const { eventHandlers, manager, requestLayerDraw } = createHoverManager({
			extendingElementId: "element-1",
			geometryHitIds: ["element-1"],
		})

		eventHandlers.get("viewport:pan")?.[0]?.({ data: { x: 20, y: 30 } })

		expect(manager.hoveredElementId).toBeNull()
		expect(requestLayerDraw).not.toHaveBeenCalled()
		manager.destroy()
	})
})
