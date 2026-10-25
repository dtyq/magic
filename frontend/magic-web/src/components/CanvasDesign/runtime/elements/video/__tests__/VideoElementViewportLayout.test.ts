import Konva from "konva"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { VideoElement } from "../VideoElement"

function createEventEmitterMock() {
	const handlers = new Map<string, Array<() => void>>()
	const viewportLayouts = new Map<string, Array<() => void>>()
	return {
		handlers,
		viewportLayouts,
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
			registerViewportScaleLayout: vi.fn((elementId: string, handler: () => void) => {
				viewportLayouts.set(elementId, [...(viewportLayouts.get(elementId) ?? []), handler])
				return () => {
					viewportLayouts.set(
						elementId,
						(viewportLayouts.get(elementId) ?? []).filter(
							(current) => current !== handler,
						),
					)
				}
			}),
		},
	}
}

describe("VideoElement viewport layout", () => {
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

	it("updates viewport-dependent controls without requesting another layer draw", () => {
		const previousAutoDrawEnabled = Konva.autoDrawEnabled
		Konva.autoDrawEnabled = false
		try {
			const container = document.createElement("div")
			document.body.appendChild(container)
			const stage = new Konva.Stage({ container, width: 500, height: 500 })
			const layer = new Konva.Layer()
			stage.add(layer)
			const group = new Konva.Group({ width: 320, height: 180 })
			layer.add(group)
			const { eventEmitter, runtimeScheduler, viewportLayouts } = createEventEmitterMock()
			const updatePlaceholderContentLayout = vi.fn()
			const updatePlayerLayout = vi.fn()
			const updatePlayerViewportScaleLayout = vi.fn()
			const updateViewportScaleLayout = vi.fn()
			const element = Object.create(VideoElement.prototype) as unknown as {
				data: { id: string; width: number; height: number }
				canvas: {
					eventEmitter: typeof eventEmitter
					runtimeScheduler: typeof runtimeScheduler
				}
				renderer: {
					updatePlaceholderContentLayout: typeof updatePlaceholderContentLayout
					updatePlayerLayout: typeof updatePlayerLayout
					updatePlayerViewportScaleLayout: typeof updatePlayerViewportScaleLayout
				}
				borderDecorator: {
					updateViewportScaleLayout: typeof updateViewportScaleLayout
				}
				setupContentUpdateListener: (group: Konva.Group) => void
				removeContentUpdateListener: () => void
			}
			Object.assign(element, {
				data: { id: "video-1", width: 320, height: 180 },
				canvas: { eventEmitter, runtimeScheduler },
				renderer: {
					updatePlaceholderContentLayout,
					updatePlayerLayout,
					updatePlayerViewportScaleLayout,
				},
				borderDecorator: { updateViewportScaleLayout },
			})

			element.setupContentUpdateListener(group)
			const layerDrawSpy = vi.spyOn(layer, "batchDraw")
			viewportLayouts.get("video-1")?.[0]?.()

			expect(updatePlaceholderContentLayout).toHaveBeenCalledWith(group, 320, 180)
			expect(updatePlayerViewportScaleLayout).toHaveBeenCalledWith(group)
			expect(updateViewportScaleLayout).toHaveBeenCalledTimes(1)
			expect(updatePlayerLayout).not.toHaveBeenCalled()
			expect(layerDrawSpy).not.toHaveBeenCalled()

			updatePlaceholderContentLayout.mockClear()
			updatePlayerViewportScaleLayout.mockClear()
			updateViewportScaleLayout.mockClear()
			updatePlayerLayout.mockClear()
			group.fire("transform")
			expect(updatePlaceholderContentLayout).toHaveBeenCalledTimes(1)
			expect(updatePlayerLayout).toHaveBeenCalledTimes(1)
			expect(updatePlayerViewportScaleLayout).not.toHaveBeenCalled()
			expect(updateViewportScaleLayout).not.toHaveBeenCalled()
			expect(layerDrawSpy).toHaveBeenCalledTimes(1)

			element.removeContentUpdateListener()
			updatePlaceholderContentLayout.mockClear()
			group.fire("transform")
			expect(updatePlaceholderContentLayout).not.toHaveBeenCalled()

			stage.destroy()
		} finally {
			Konva.autoDrawEnabled = previousAutoDrawEnabled
		}
	})
})
