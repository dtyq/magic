import Konva from "konva"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ViewportController } from "../viewport/ViewportController"
import type { Canvas } from "../../core/Canvas"
import type { CanvasDeviceInfo } from "../../document/types"

type Listener = (event: Event) => void
type CanvasEventHandler = (event: { data?: unknown }) => void

function createTouchEvent(type: string, touches: Array<{ clientX: number; clientY: number }>) {
	const event = new Event(type, { bubbles: true, cancelable: true }) as TouchEvent
	Object.defineProperty(event, "touches", {
		value: touches,
	})
	return event
}

type FakeHitNode = {
	id: () => string
	name: () => string
	getClassName: () => string
	getParent: () => unknown
	setParent: (nextParent: unknown) => void
}

function createHitNode(id = "element-1"): FakeHitNode {
	let parent: unknown = null
	return {
		id: () => id,
		name: () => "",
		getClassName: () => "Group",
		getParent: () => parent,
		setParent: (nextParent: unknown) => {
			parent = nextParent
		},
	}
}

function createController(options: {
	touch: boolean
	hitNode?: FakeHitNode
	layout?: CanvasDeviceInfo["layout"]
	coarsePointer?: boolean
	hover?: boolean
	width?: number
	height?: number
	scale?: number
	position?: { x: number; y: number }
	onStageMutation?: () => void
}) {
	const listeners = new Map<string, Set<Listener>>()
	const canvasEventHandlers = new Map<string, Set<CanvasEventHandler>>()
	const container = {
		addEventListener: vi.fn((eventName: string, listener: Listener) => {
			let eventListeners = listeners.get(eventName)
			if (!eventListeners) {
				eventListeners = new Set()
				listeners.set(eventName, eventListeners)
			}
			eventListeners.add(listener)
		}),
		removeEventListener: vi.fn((eventName: string, listener: Listener) => {
			listeners.get(eventName)?.delete(listener)
		}),
	}

	let stagePosition = options.position ?? { x: 0, y: 0 }
	let stageWidth = options.width ?? 1000
	let stageHeight = options.height ?? 800
	let stageScale = options.scale ?? 0.3
	let pointerPosition: { x: number; y: number } | null = null

	const stage = {
		id: () => "",
		scale: vi.fn((next?: { x: number; y: number }) => {
			if (next) {
				options.onStageMutation?.()
				stageScale = next.x
				return undefined
			}
			return { x: stageScale, y: stageScale }
		}),
		scaleX: vi.fn(() => stageScale),
		scaleY: vi.fn(() => stageScale),
		position: vi.fn((next?: { x: number; y: number }) => {
			if (next) {
				options.onStageMutation?.()
				stagePosition = next
				return undefined
			}
			return stagePosition
		}),
		x: vi.fn(() => stagePosition.x),
		y: vi.fn(() => stagePosition.y),
		width: vi.fn((next?: number) => {
			if (typeof next === "number") {
				stageWidth = next
				return undefined
			}
			return stageWidth
		}),
		height: vi.fn((next?: number) => {
			if (typeof next === "number") {
				stageHeight = next
				return undefined
			}
			return stageHeight
		}),
		draggable: vi.fn(() => false),
		on: vi.fn(),
		off: vi.fn(),
		container: vi.fn(() => container),
		getAbsoluteTransform: vi.fn(() => ({
			copy: () => ({
				invert: () => ({
					point: (point: { x: number; y: number }) => ({
						x: (point.x - stagePosition.x) / stageScale,
						y: (point.y - stagePosition.y) / stageScale,
					}),
				}),
			}),
		})),
		setPointersPositions: vi.fn((event: TouchEvent) => {
			const touch = event.touches[0]
			pointerPosition = touch ? { x: touch.clientX, y: touch.clientY } : null
		}),
		getPointerPosition: vi.fn(() => pointerPosition),
		getIntersection: vi.fn(() => options.hitNode ?? null),
	}

	if (options.hitNode) {
		options.hitNode.setParent(stage)
	}

	const panTool = {}
	const selectionTool = {}
	const deviceInfo: CanvasDeviceInfo = {
		formFactor: "desktop",
		layout: options.layout ?? "regular",
		input: {
			touch: options.touch,
			coarsePointer: options.coarsePointer ?? false,
			hover: options.hover ?? true,
		},
	}

	const canvas = {
		stage,
		deviceInfo,
		runtimeScheduler: {
			requestLayerDraw: vi.fn(),
		},
		eventEmitter: {
			emit: vi.fn(),
			on: vi.fn((eventName: string, handler: CanvasEventHandler) => {
				let eventHandlers = canvasEventHandlers.get(eventName)
				if (!eventHandlers) {
					eventHandlers = new Set()
					canvasEventHandlers.set(eventName, eventHandlers)
				}
				eventHandlers.add(handler)
				return () => {
					eventHandlers?.delete(handler)
				}
			}),
		},
		eraserManager: {
			getErasingElementId: vi.fn(() => null),
		},
		toolManager: {
			getActiveTool: vi.fn(() => selectionTool),
			getPanTool: vi.fn(() => panTool),
			getSelectionTool: vi.fn(() => selectionTool),
		},
		elementManager: {
			hasElement: vi.fn((elementId: string) => elementId === "element-1"),
		},
	} as unknown as Canvas

	const controller = new ViewportController({ canvas })
	if (options.scale !== undefined) {
		stage.scale({ x: options.scale, y: options.scale })
	}

	return {
		canvas,
		container,
		controller,
		dispatch: (eventName: string, event: Event) => {
			listeners.get(eventName)?.forEach((listener) => listener(event))
		},
		dispatchCanvasEvent: (eventName: string, data?: unknown) => {
			canvasEventHandlers.get(eventName)?.forEach((handler) => handler({ data }))
		},
		stage,
	}
}

describe("ViewportController touch pan", () => {
	beforeEach(() => {
		vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
			return window.setTimeout(() => callback(performance.now()), 0)
		})
		vi.stubGlobal("cancelAnimationFrame", (id: number) => {
			window.clearTimeout(id)
		})
	})

	afterEach(() => {
		vi.unstubAllGlobals()
		vi.restoreAllMocks()
	})

	it("pans from a single touch on blank viewport when touch input is available", () => {
		const { dispatch, stage } = createController({ touch: true })

		dispatch("touchstart", createTouchEvent("touchstart", [{ clientX: 10, clientY: 20 }]))
		dispatch("touchmove", createTouchEvent("touchmove", [{ clientX: 30, clientY: 20 }]))

		expect(stage.position).toHaveBeenCalledWith({ x: 20, y: 0 })
	})

	it("does not pan from touch when touch input is unavailable", () => {
		const { dispatch, stage } = createController({ touch: false })

		dispatch("touchstart", createTouchEvent("touchstart", [{ clientX: 10, clientY: 20 }]))
		dispatch("touchmove", createTouchEvent("touchmove", [{ clientX: 30, clientY: 20 }]))

		expect(stage.position).not.toHaveBeenCalledWith({ x: 20, y: 0 })
	})

	it("does not pan when the touch starts on a managed element", () => {
		const { dispatch, stage } = createController({ touch: true, hitNode: createHitNode() })

		dispatch("touchstart", createTouchEvent("touchstart", [{ clientX: 10, clientY: 20 }]))
		dispatch("touchmove", createTouchEvent("touchmove", [{ clientX: 30, clientY: 20 }]))

		expect(stage.position).not.toHaveBeenCalledWith({ x: 20, y: 0 })
	})

	it("emits viewport gesture state for two-finger pinch", () => {
		const { canvas, controller, dispatch } = createController({ touch: true })

		dispatch(
			"touchstart",
			createTouchEvent("touchstart", [
				{ clientX: 10, clientY: 20 },
				{ clientX: 40, clientY: 20 },
			]),
		)

		expect(canvas.eventEmitter.emit).toHaveBeenCalledWith({
			type: "viewport:gesture",
			data: { active: true, source: "touch-pinch", pointerCount: 2 },
		})
		expect(controller.isViewportGestureActive()).toBe(true)

		dispatch("touchend", createTouchEvent("touchend", []))

		expect(canvas.eventEmitter.emit).toHaveBeenCalledWith({
			type: "viewport:gesture",
			data: { active: false, source: "touch-pinch" },
		})
		expect(controller.isViewportGestureActive()).toBe(false)
	})

	it("uses latest touch input capability after device info changes", () => {
		const { canvas, dispatch, stage } = createController({ touch: false })

		dispatch("touchstart", createTouchEvent("touchstart", [{ clientX: 10, clientY: 20 }]))
		dispatch("touchmove", createTouchEvent("touchmove", [{ clientX: 30, clientY: 20 }]))
		expect(stage.position).not.toHaveBeenCalledWith({ x: 20, y: 0 })

		canvas.deviceInfo = {
			...canvas.deviceInfo,
			input: {
				...canvas.deviceInfo.input,
				touch: true,
			},
		}

		dispatch("touchstart", createTouchEvent("touchstart", [{ clientX: 10, clientY: 20 }]))
		dispatch("touchmove", createTouchEvent("touchmove", [{ clientX: 30, clientY: 20 }]))

		expect(stage.position).toHaveBeenCalledWith({ x: 20, y: 0 })
	})

	it("syncs WebKit gesture listeners after device info changes", () => {
		const { canvas, container, dispatchCanvasEvent } = createController({
			touch: true,
			layout: "regular",
			coarsePointer: false,
			hover: true,
		})
		expect(container.addEventListener).toHaveBeenCalledWith(
			"gesturestart",
			expect.any(Function),
			{ passive: false },
		)

		const previous = canvas.deviceInfo
		canvas.deviceInfo = {
			...canvas.deviceInfo,
			layout: "compact",
		}
		dispatchCanvasEvent("canvas:devicechange", { previous, current: canvas.deviceInfo })

		expect(container.removeEventListener).toHaveBeenCalledWith(
			"gesturestart",
			expect.any(Function),
		)

		const compact = canvas.deviceInfo
		canvas.deviceInfo = {
			...canvas.deviceInfo,
			layout: "regular",
			input: {
				touch: true,
				coarsePointer: false,
				hover: true,
			},
		}
		dispatchCanvasEvent("canvas:devicechange", {
			previous: compact,
			current: canvas.deviceInfo,
		})

		expect(container.addEventListener).toHaveBeenCalledTimes(12)
	})
})

describe("ViewportController layout center preservation", () => {
	afterEach(() => {
		vi.restoreAllMocks()
	})

	it("keeps the default viewport world center when the stage size changes", () => {
		const { canvas, controller, stage } = createController({
			touch: false,
			width: 1000,
			height: 800,
			scale: 0.5,
			position: { x: -100, y: -80 },
		})

		controller.setDefaultViewportPadding({
			left: 200,
			right: 0,
			top: 0,
			bottom: 0,
		})

		controller.preserveViewportCenterDuringLayoutChange(
			() => {
				stage.width(1400)
				stage.height(900)
			},
			{ source: "resize", reason: "test-resize" },
		)

		expect(stage.position).toHaveBeenLastCalledWith({ x: 100, y: -30 })
		expect(canvas.eventEmitter.emit).toHaveBeenCalledWith({
			type: "viewport:pan",
			data: { x: 100, y: -30 },
		})
		expect(canvas.eventEmitter.emit).toHaveBeenCalledWith({
			type: "viewport:changed",
			data: {
				scale: 0.5,
				position: { x: 100, y: -30 },
				source: "resize",
				phase: "end",
			},
		})
	})

	it("keeps the default viewport world center when default padding changes", () => {
		const { controller, stage } = createController({
			touch: false,
			width: 1000,
			height: 800,
			scale: 0.5,
			position: { x: -100, y: -80 },
		})

		controller.setDefaultViewportPadding(
			{
				left: 250,
				right: 0,
				top: 0,
				bottom: 0,
			},
			{ preserveViewportCenter: true },
		)

		expect(stage.position).toHaveBeenLastCalledWith({ x: 25, y: -80 })
	})
})

describe("ViewportController external wheel input", () => {
	beforeEach(() => {
		vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
			return window.setTimeout(() => callback(performance.now()), 0)
		})
		vi.stubGlobal("cancelAnimationFrame", (id: number) => {
			window.clearTimeout(id)
		})
	})

	afterEach(() => {
		vi.unstubAllGlobals()
		vi.restoreAllMocks()
	})

	it("keeps the current viewport center fixed while applying wheel zoom", () => {
		const { canvas, controller, stage } = createController({
			touch: false,
			width: 1000,
			height: 800,
			scale: 1,
			position: { x: 10, y: 20 },
		})
		const viewportCenter = { x: 500, y: 400 }
		const initialCanvasPoint = {
			x: (viewportCenter.x - stage.position().x) / stage.scaleX(),
			y: (viewportCenter.y - stage.position().y) / stage.scaleY(),
		}

		controller.zoomByWheelDeltaAtViewportCenter(-120, "minimap")

		const nextScale = stage.scaleX()
		const nextPosition = stage.position()
		expect(nextScale).toBeGreaterThan(1)
		expect((viewportCenter.x - nextPosition.x) / nextScale).toBeCloseTo(initialCanvasPoint.x)
		expect((viewportCenter.y - nextPosition.y) / nextScale).toBeCloseTo(initialCanvasPoint.y)
		expect(canvas.eventEmitter.emit).toHaveBeenCalledWith({
			type: "viewport:changed",
			data: expect.objectContaining({
				source: "minimap",
				phase: "move",
			}),
		})
	})

	it("suppresses Konva auto draws while updating the Stage and viewport listeners", () => {
		const stageMutationAutoDrawStates: boolean[] = []
		const { canvas, controller } = createController({
			touch: false,
			scale: 1,
			position: { x: 0, y: 0 },
			onStageMutation: () => stageMutationAutoDrawStates.push(Konva.autoDrawEnabled),
		})
		const emit = canvas.eventEmitter.emit as unknown as ReturnType<typeof vi.fn>
		const autoDrawStates: boolean[] = []
		emit.mockImplementation(() => {
			autoDrawStates.push(Konva.autoDrawEnabled)
		})
		const previousAutoDrawEnabled = Konva.autoDrawEnabled
		Konva.autoDrawEnabled = true
		stageMutationAutoDrawStates.length = 0

		try {
			controller.zoomByWheelDeltaAtViewportCenter(-120, "minimap")

			expect(stageMutationAutoDrawStates).toEqual([false, false])
			expect(autoDrawStates).toHaveLength(3)
			expect(autoDrawStates.every((enabled) => !enabled)).toBe(true)
			expect(Konva.autoDrawEnabled).toBe(true)
			expect(canvas.runtimeScheduler.requestLayerDraw).toHaveBeenCalledWith("stage", {
				source: "ViewportController",
				reason: "zoom-update",
				priority: "input",
			})
		} finally {
			Konva.autoDrawEnabled = previousAutoDrawEnabled
		}
	})

	it.each([
		["setScale", "set-scale", (controller: ViewportController) => controller.setScale(1.5)],
		[
			"setPosition",
			"set-position",
			(controller: ViewportController) => controller.setPosition({ x: 40, y: 60 }),
		],
		["resetView", "reset-view", (controller: ViewportController) => controller.resetView()],
		["zoomToFit", "zoom-to-fit", (controller: ViewportController) => controller.zoomToFit()],
		[
			"a non-animated viewport transform",
			"viewport-transform",
			(controller: ViewportController) =>
				(
					controller as unknown as {
						applyViewportTransform: (
							bounds: { x: number; y: number; width: number; height: number },
							options: { animated: boolean },
						) => void
					}
				).applyViewportTransform(
					{ x: 100, y: 120, width: 240, height: 180 },
					{ animated: false },
				),
		],
	] as const)(
		"keeps %s Stage mutations and listeners in one scheduler-owned draw",
		(_label, expectedReason, updateViewport) => {
			const stageMutationAutoDrawStates: boolean[] = []
			const { canvas, controller } = createController({
				touch: false,
				scale: 1,
				position: { x: 0, y: 0 },
				onStageMutation: () => stageMutationAutoDrawStates.push(Konva.autoDrawEnabled),
			})
			const emit = canvas.eventEmitter.emit as unknown as ReturnType<typeof vi.fn>
			const requestLayerDraw = canvas.runtimeScheduler
				.requestLayerDraw as unknown as ReturnType<typeof vi.fn>
			const listenerAutoDrawStates: boolean[] = []
			emit.mockImplementation(() => {
				listenerAutoDrawStates.push(Konva.autoDrawEnabled)
			})
			requestLayerDraw.mockClear()
			stageMutationAutoDrawStates.length = 0
			const previousAutoDrawEnabled = Konva.autoDrawEnabled
			Konva.autoDrawEnabled = true

			try {
				updateViewport(controller)

				expect(stageMutationAutoDrawStates.length).toBeGreaterThan(0)
				expect(stageMutationAutoDrawStates.every((enabled) => !enabled)).toBe(true)
				expect(listenerAutoDrawStates.length).toBeGreaterThan(0)
				expect(listenerAutoDrawStates.every((enabled) => !enabled)).toBe(true)
				expect(requestLayerDraw).toHaveBeenCalledTimes(1)
				expect(requestLayerDraw).toHaveBeenCalledWith("stage", {
					source: "ViewportController",
					reason: expectedReason,
					priority: "input",
				})
				expect(Konva.autoDrawEnabled).toBe(true)
			} finally {
				Konva.autoDrawEnabled = previousAutoDrawEnabled
			}
		},
	)

	it("suppresses Konva auto draw while applying a Stage layout change", () => {
		const { canvas, controller } = createController({
			touch: false,
			width: 1000,
			height: 800,
			scale: 1,
			position: { x: 0, y: 0 },
		})
		const autoDrawStates: boolean[] = []
		const previousAutoDrawEnabled = Konva.autoDrawEnabled
		Konva.autoDrawEnabled = true

		try {
			controller.preserveViewportCenterDuringLayoutChange(
				() => {
					autoDrawStates.push(Konva.autoDrawEnabled)
					canvas.stage.width(900)
				},
				{ reason: "test-layout" },
			)

			expect(autoDrawStates).toEqual([false])
			expect(canvas.runtimeScheduler.requestLayerDraw).toHaveBeenCalledWith("stage", {
				source: "ViewportController",
				reason: "test-layout",
				priority: "input",
			})
			expect(Konva.autoDrawEnabled).toBe(true)
		} finally {
			Konva.autoDrawEnabled = previousAutoDrawEnabled
		}
	})

	it("leaves an animated completion draw to the owning Konva Tween", () => {
		let finishTween: (() => void) | undefined
		const play = vi.fn()
		vi.spyOn(Konva, "Tween").mockImplementation(function MockTween(
			config: ConstructorParameters<typeof Konva.Tween>[0],
		) {
			finishTween = () => config.onFinish?.()
			return { destroy: vi.fn(), play } as unknown as Konva.Tween
		})
		const { canvas, controller } = createController({
			touch: false,
			scale: 1,
			position: { x: 0, y: 0 },
		})
		const applyViewportTransform = (
			controller as unknown as {
				applyViewportTransform: (
					bounds: { x: number; y: number; width: number; height: number },
					options: { animated: boolean },
				) => void
			}
		).applyViewportTransform.bind(controller)

		applyViewportTransform({ x: 100, y: 120, width: 240, height: 180 }, { animated: true })
		expect(play).toHaveBeenCalledTimes(1)

		finishTween?.()

		expect(canvas.runtimeScheduler.requestLayerDraw).not.toHaveBeenCalled()
		expect(canvas.eventEmitter.emit).toHaveBeenCalledWith({
			type: "viewport:changed",
			data: expect.objectContaining({ phase: "end", source: "programmatic" }),
		})
	})

	it("pans with the same wheel delta semantics as the main canvas", () => {
		const { canvas, controller, stage } = createController({
			touch: false,
			scale: 1,
			position: { x: 10, y: 20 },
		})

		controller.panByWheelDelta(12, -8, "minimap")

		expect(stage.position).toHaveBeenLastCalledWith({ x: -2, y: 28 })
		expect(canvas.eventEmitter.emit).toHaveBeenCalledWith({
			type: "viewport:changed",
			data: expect.objectContaining({
				source: "minimap",
				phase: "move",
			}),
		})
	})
})
