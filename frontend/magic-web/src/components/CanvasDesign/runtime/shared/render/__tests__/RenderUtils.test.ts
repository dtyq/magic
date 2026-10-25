import Konva from "konva"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { RenderUtils } from "../RenderUtils"

function createImage(width: number, height: number): HTMLImageElement {
	const image = new Image()
	image.width = width
	image.height = height
	return image
}

beforeEach(() => {
	vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
		clearRect: vi.fn(),
		fillRect: vi.fn(),
		getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(400) })),
	} as unknown as CanvasRenderingContext2D)
})

afterEach(() => {
	vi.restoreAllMocks()
})

describe("RenderUtils contained image layout", () => {
	it("fits a wide source without cropping", () => {
		const source = createImage(1600, 900)
		const imageNode = new Konva.Image({ image: source })

		RenderUtils.updateContainedImageLayout(imageNode, 400, 400)

		expect(imageNode.position()).toEqual({ x: 0, y: 87.5 })
		expect(imageNode.width()).toBe(400)
		expect(imageNode.height()).toBe(225)
		expect(imageNode.crop()).toEqual({ x: 0, y: 0, width: 1600, height: 900 })
	})

	it("fits a portrait source without cropping", () => {
		const source = createImage(900, 1600)
		const imageNode = new Konva.Image({ image: source })

		RenderUtils.updateContainedImageLayout(imageNode, 400, 400)

		expect(imageNode.position()).toEqual({ x: 87.5, y: 0 })
		expect(imageNode.width()).toBe(225)
		expect(imageNode.height()).toBe(400)
	})

	it("fills a square target for a square source", () => {
		const source = createImage(800, 800)
		const imageNode = new Konva.Image({ image: source })

		RenderUtils.updateContainedImageLayout(imageNode, 400, 400)

		expect(imageNode.position()).toEqual({ x: 0, y: 0 })
		expect(imageNode.width()).toBe(400)
		expect(imageNode.height()).toBe(400)
	})
})
