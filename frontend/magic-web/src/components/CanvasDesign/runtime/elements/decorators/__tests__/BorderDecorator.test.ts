import Konva from "konva"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { BorderDecorator } from "../BorderDecorator"
import { DECORATOR_CONFIG } from "../DecoratorConfig"

function createEventEmitterMock() {
	const handlers = new Map<string, Array<() => void>>()
	return {
		handlers,
		eventEmitter: {
			on: vi.fn((eventType: string, handler: () => void) => {
				const currentHandlers = handlers.get(eventType) ?? []
				currentHandlers.push(handler)
				handlers.set(eventType, currentHandlers)
			}),
			off: vi.fn((eventType: string, handler: () => void) => {
				handlers.set(
					eventType,
					(handlers.get(eventType) ?? []).filter((current) => current !== handler),
				)
			}),
		},
		runtimeScheduler: {
			registerViewportScaleLayout: vi.fn(() => vi.fn()),
		},
	}
}

describe("BorderDecorator", () => {
	beforeEach(() => {
		vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
			clearRect: vi.fn(),
			fillRect: vi.fn(),
			getImageData: vi.fn(() => ({ data: new Uint8ClampedArray([0, 0, 0, 0]) })),
			scale: vi.fn(),
		} as unknown as CanvasRenderingContext2D)
	})

	afterEach(() => {
		vi.restoreAllMocks()
		document.body.innerHTML = ""
	})

	it("uses a screen-space stroke for static borders without registering viewport scale work", () => {
		const previousAutoDrawEnabled = Konva.autoDrawEnabled
		Konva.autoDrawEnabled = false
		try {
			const container = document.createElement("div")
			document.body.appendChild(container)
			const stage = new Konva.Stage({ container, width: 500, height: 500 })
			const layer = new Konva.Layer()
			stage.add(layer)
			const group = new Konva.Group({ width: 120, height: 80, scaleX: 0.5, scaleY: 0.5 })
			layer.add(group)
			const { eventEmitter, handlers, runtimeScheduler } = createEventEmitterMock()
			const isSelected = vi.fn(() => false)
			const decorator = new BorderDecorator(group, 120, 80, {
				isAnimated: false,
				elementId: "image-1",
				canvas: {
					eventEmitter,
					runtimeScheduler,
					selectionManager: { isSelected },
				} as never,
			})

			decorator.create()
			const border = group.findOne<Konva.Rect>(".decorator-border")
			const layerDrawSpy = vi.spyOn(layer, "batchDraw")
			isSelected.mockClear()

			stage.scale({ x: 2, y: 2 })

			expect(border?.strokeWidth()).toBeCloseTo(DECORATOR_CONFIG.BORDER_WIDTH)
			expect(border?.strokeScaleEnabled()).toBe(false)
			expect(runtimeScheduler.registerViewportScaleLayout).not.toHaveBeenCalled()
			expect(isSelected).not.toHaveBeenCalled()
			expect(layerDrawSpy).not.toHaveBeenCalled()

			isSelected.mockReturnValue(true)
			handlers.get("element:select")?.[0]?.()
			expect(border?.visible()).toBe(false)
			expect(layerDrawSpy).toHaveBeenCalledTimes(1)

			const groupOffSpy = vi.spyOn(group, "off")
			decorator.destroy()
			expect(groupOffSpy).toHaveBeenCalledWith("transform", expect.any(Function))
			stage.destroy()
		} finally {
			Konva.autoDrawEnabled = previousAutoDrawEnabled
		}
	})

	it("lets the owning media callback update animated gradient borders", () => {
		const previousAutoDrawEnabled = Konva.autoDrawEnabled
		Konva.autoDrawEnabled = false
		try {
			const container = document.createElement("div")
			document.body.appendChild(container)
			const stage = new Konva.Stage({ container, width: 500, height: 500 })
			const layer = new Konva.Layer()
			stage.add(layer)
			const group = new Konva.Group({ width: 120, height: 80 })
			layer.add(group)
			const { eventEmitter, runtimeScheduler } = createEventEmitterMock()
			const decorator = new BorderDecorator(group, 120, 80, {
				isAnimated: true,
				elementId: "image-animated",
				canvas: {
					eventEmitter,
					runtimeScheduler,
					selectionManager: { isSelected: () => false },
				} as never,
			})

			decorator.create()

			const border = group.findOne<Konva.Rect>(".decorator-border")
			const initialStrokeWidth = border?.strokeWidth() ?? 0
			stage.scale({ x: 2, y: 2 })
			decorator.updateViewportScaleLayout()

			expect(border?.strokeWidth()).toBeCloseTo(initialStrokeWidth / 2)
			expect(runtimeScheduler.registerViewportScaleLayout).not.toHaveBeenCalled()
			decorator.destroy()
			stage.destroy()
		} finally {
			Konva.autoDrawEnabled = previousAutoDrawEnabled
		}
	})

	it("pauses and resumes animated borders with render visibility", () => {
		const previousAutoDrawEnabled = Konva.autoDrawEnabled
		Konva.autoDrawEnabled = false
		const startSpy = vi.spyOn(Konva.Animation.prototype, "start")
		const stopSpy = vi.spyOn(Konva.Animation.prototype, "stop")
		try {
			const container = document.createElement("div")
			document.body.appendChild(container)
			const stage = new Konva.Stage({ container, width: 500, height: 500 })
			const layer = new Konva.Layer()
			stage.add(layer)
			const { eventEmitter, runtimeScheduler } = createEventEmitterMock()
			const group = new Konva.Group({ width: 120, height: 80 })
			const decorator = new BorderDecorator(group, 120, 80, {
				isAnimated: true,
				elementId: "image-visibility",
				canvas: {
					eventEmitter,
					runtimeScheduler,
					selectionManager: { isSelected: () => false },
				} as never,
			})
			layer.add(group)

			decorator.create()
			const initialStartCalls = startSpy.mock.calls.length
			const initialStopCalls = stopSpy.mock.calls.length
			decorator.setRenderVisibility(false)
			expect(stopSpy).toHaveBeenCalledTimes(initialStopCalls + 1)
			decorator.setRenderVisibility(true)

			expect(startSpy).toHaveBeenCalledTimes(initialStartCalls + 1)
			decorator.destroy()
			stage.destroy()
		} finally {
			Konva.autoDrawEnabled = previousAutoDrawEnabled
		}
	})
})
