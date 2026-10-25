import { describe, expect, it, vi } from "vitest"
import { Canvas } from "../Canvas"

type StageHandler = (event: { target: unknown; evt: { clientX: number; clientY: number } }) => void

function createCanvasDoubleClickHarness() {
	const handlers = new Map<string, StageHandler>()
	const stage = {
		on: vi.fn((eventName: string, handler: StageHandler) => {
			handlers.set(eventName, handler)
		}),
		off: vi.fn(),
		getPointerPosition: vi.fn(() => ({ x: 120, y: 240 })),
		getAbsoluteTransform: vi.fn(() => ({
			copy: () => {
				const transform = {
					invert: vi.fn(() => transform),
					point: (point: { x: number; y: number }) => point,
				}
				return transform
			},
		})),
	}
	const eventEmitter = { emit: vi.fn() }
	const canvas = Object.create(Canvas.prototype) as Canvas
	Object.assign(canvas, { stage, eventEmitter })
	;(
		canvas as unknown as { setupCanvasDoubleClickHandler: () => void }
	).setupCanvasDoubleClickHandler()

	return { canvas, stage, handlers, eventEmitter }
}

function event(target: unknown, clientX: number, clientY: number) {
	return { target, evt: { clientX, clientY } }
}

describe("Canvas blank double click", () => {
	it("emits only when the two blank clicks are close together", () => {
		const { stage, handlers, eventEmitter } = createCanvasDoubleClickHarness()

		handlers.get("mousedown")?.(event(stage, 100, 200))
		handlers.get("mousedown")?.(event(stage, 104, 203))
		handlers.get("dblclick")?.(event(stage, 104, 203))

		expect(eventEmitter.emit).toHaveBeenCalledWith({
			type: "canvas:dblclick",
			data: {
				x: 104,
				y: 203,
				canvasX: 120,
				canvasY: 240,
			},
		})
	})

	it("ignores rapid clicks in different blank locations", () => {
		const { stage, handlers, eventEmitter } = createCanvasDoubleClickHarness()

		handlers.get("mousedown")?.(event(stage, 100, 200))
		handlers.get("mousedown")?.(event(stage, 140, 240))
		handlers.get("dblclick")?.(event(stage, 140, 240))

		expect(eventEmitter.emit).not.toHaveBeenCalled()
	})

	it("keeps the latest blank click for the next double click after rejecting a distant one", () => {
		const { stage, handlers, eventEmitter } = createCanvasDoubleClickHarness()

		handlers.get("mousedown")?.(event(stage, 100, 200))
		handlers.get("mousedown")?.(event(stage, 140, 240))
		handlers.get("dblclick")?.(event(stage, 140, 240))

		expect(eventEmitter.emit).not.toHaveBeenCalled()

		// Konva can emit the next dblclick after only one additional mousedown.
		handlers.get("mousedown")?.(event(stage, 140, 240))
		handlers.get("dblclick")?.(event(stage, 140, 240))

		expect(eventEmitter.emit).toHaveBeenCalledTimes(1)
		expect(eventEmitter.emit).toHaveBeenCalledWith({
			type: "canvas:dblclick",
			data: {
				x: 140,
				y: 240,
				canvasX: 120,
				canvasY: 240,
			},
		})
	})
})
