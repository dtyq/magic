import Konva from "konva"
import { describe, expect, it, vi } from "vitest"
import { syncControlHitRect } from "../ControlHitTarget"

describe("syncControlHitRect", () => {
	it("does not widen a fixed-width control hit target when the element is tiny", () => {
		vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
			clearRect: vi.fn(),
			fillRect: vi.fn(),
			getImageData: vi.fn(() => ({ data: new Uint8ClampedArray([0, 0, 0, 0]) })),
		} as unknown as CanvasRenderingContext2D)
		const hit = new Konva.Rect({ width: 120, height: 8 })
		vi.spyOn(hit, "getAbsoluteScale").mockReturnValue({ x: 0.1, y: 0.1 })

		syncControlHitRect(hit, { x: 10, y: 10, width: 120, height: 8, expandX: false }, 32)

		expect(hit.width()).toBe(120)
		expect(hit.height()).toBe(320)
	})
})
