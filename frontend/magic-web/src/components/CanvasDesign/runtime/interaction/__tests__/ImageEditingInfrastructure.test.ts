import Konva from "konva"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Canvas } from "../../core/Canvas"
import { ImageEditingCoordinator } from "../image-editing/ImageEditingCoordinator"
import { ImageEditingSession } from "../image-editing/ImageEditingSession"
import {
	getLocalRectRelativeTo,
	syncNodeTransformRelativeTo,
} from "../../shared/geometry/nodeTransform"

function createLayerGroups() {
	const root = new Konva.Group()
	const contentLayer = new Konva.Group()
	const controlsLayer = new Konva.Group()
	const markersLayer = new Konva.Group()
	Object.assign(controlsLayer, { batchDraw: vi.fn() })
	Object.assign(markersLayer, { batchDraw: vi.fn() })
	root.add(contentLayer, controlsLayer, markersLayer)
	return { root, contentLayer, controlsLayer, markersLayer }
}

type TestEvent = { data: { elementId?: string; image?: object } }

function createTestEventEmitter() {
	const handlers = new Map<string, Set<(event: TestEvent) => void>>()
	return {
		handlers,
		eventEmitter: {
			on: vi.fn((type: string, handler: (event: TestEvent) => void) => {
				const listeners = handlers.get(type) ?? new Set()
				listeners.add(handler)
				handlers.set(type, listeners)
			}),
			off: vi.fn((type: string, handler: (event: TestEvent) => void) => {
				handlers.get(type)?.delete(handler)
			}),
		},
	}
}

beforeEach(() => {
	vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
		clearRect: vi.fn(),
		fillRect: vi.fn(),
		getImageData: vi.fn(() => ({ data: new Uint8ClampedArray([0, 0, 0, 0]) })),
	} as unknown as CanvasRenderingContext2D)
})

afterEach(() => {
	vi.restoreAllMocks()
})

describe("image editing infrastructure", () => {
	it("preserves a Frame child absolute transform in the controls layer", () => {
		const { contentLayer, controlsLayer } = createLayerGroups()
		const frame = new Konva.Group({ x: 240, y: 130, scaleX: 1.4, scaleY: 0.8, rotation: 18 })
		const source = new Konva.Group({ x: 35, y: 24, scaleX: 0.9, scaleY: 1.2, rotation: -7 })
		const target = new Konva.Group()
		contentLayer.add(frame)
		frame.add(source)
		controlsLayer.add(target)

		syncNodeTransformRelativeTo(source, target, controlsLayer)

		const sourceCorners = [
			source.getAbsoluteTransform().point({ x: 0, y: 0 }),
			source.getAbsoluteTransform().point({ x: 120, y: 80 }),
		]
		const targetCorners = [
			target.getAbsoluteTransform().point({ x: 0, y: 0 }),
			target.getAbsoluteTransform().point({ x: 120, y: 80 }),
		]
		expect(targetCorners[0].x).toBeCloseTo(sourceCorners[0].x)
		expect(targetCorners[0].y).toBeCloseTo(sourceCorners[0].y)
		expect(targetCorners[1].x).toBeCloseTo(sourceCorners[1].x)
		expect(targetCorners[1].y).toBeCloseTo(sourceCorners[1].y)

		const rect = getLocalRectRelativeTo(source, contentLayer, {
			x: 0,
			y: 0,
			width: 120,
			height: 80,
		})
		expect(rect.width).toBeGreaterThan(0)
		expect(rect.height).toBeGreaterThan(0)
	})

	it("mounts a proxy before hiding the source and restores a rerendered source", () => {
		const { contentLayer, controlsLayer, markersLayer } = createLayerGroups()
		const frame = new Konva.Group({ x: 300, y: 160, scaleX: 1.2, scaleY: 0.75 })
		contentLayer.add(frame)

		const createSource = () => {
			const source = new Konva.Group({ x: 40, y: 25, width: 160, height: 100 })
			source.add(
				new Konva.Image({
					x: 0,
					y: 0,
					width: 160,
					height: 100,
					image: document.createElement("canvas"),
				}),
			)
			frame.add(source)
			return source
		}

		let sourceNode = createSource()
		const handlers = new Map<string, Set<(event: { data: { elementId: string } }) => void>>()
		const eventEmitter = {
			on: vi.fn((type: string, handler: (event: { data: { elementId: string } }) => void) => {
				const listeners = handlers.get(type) ?? new Set()
				listeners.add(handler)
				handlers.set(type, listeners)
			}),
			off: vi.fn(
				(type: string, handler: (event: { data: { elementId: string } }) => void) => {
					handlers.get(type)?.delete(handler)
				},
			),
		}
		const canvas = {
			contentLayer,
			controlsLayer,
			markersLayer,
			eventEmitter,
			elementManager: {
				getElementData: vi.fn(() => ({ id: "image-1", type: "image" })),
				getElementInstance: vi.fn(() => ({ getNode: () => sourceNode })),
			},
		} as unknown as Canvas

		const session = new ImageEditingSession({ canvas, elementId: "image-1" })
		expect(session.mount()).toBe(true)
		expect(sourceNode.visible()).toBe(false)
		expect(session.getProxyGroup()?.getParent()).toBe(controlsLayer)

		sourceNode.destroy()
		sourceNode = createSource()
		handlers.get("element:rerendered")?.forEach((handler) => {
			handler({ data: { elementId: "image-1" } })
		})
		expect(sourceNode.visible()).toBe(false)

		session.destroy()
		expect(sourceNode.visible()).toBe(true)
		expect(session.getProxyGroup()).toBeNull()
	})

	it("detaches and rebinds the editing proxy around a bitmap close", async () => {
		const { contentLayer, controlsLayer, markersLayer } = createLayerGroups()
		const sourceImage = document.createElement("canvas") as unknown as ImageBitmap
		const sourceNode = new Konva.Group({ width: 160, height: 100, visible: true })
		const sourceImageNode = new Konva.Image({
			x: 0,
			y: 0,
			width: 160,
			height: 100,
			image: sourceImage,
		})
		sourceNode.add(sourceImageNode)
		contentLayer.add(sourceNode)

		const { eventEmitter, handlers } = createTestEventEmitter()
		const canvas = {
			contentLayer,
			controlsLayer,
			markersLayer,
			eventEmitter,
			elementManager: {
				getElementData: vi.fn(() => ({ id: "image-1", type: "image" })),
				getElementInstance: vi.fn(() => ({ getNode: () => sourceNode })),
			},
		} as unknown as Canvas

		const session = new ImageEditingSession({ canvas, elementId: "image-1" })
		expect(session.mount()).toBe(true)
		const proxyImage = session.getProxyGroup()?.findOne("Image") as Konva.Image
		expect(proxyImage.image()).toBe(sourceImage)

		handlers
			.get("resource:image:will-close")
			?.forEach((handler) => handler({ data: { image: sourceImage } }))

		expect(proxyImage.image()).toBeUndefined()
		const replacementImage = document.createElement("canvas") as unknown as ImageBitmap
		sourceImageNode.image(replacementImage)
		await Promise.resolve()
		expect(proxyImage.image()).toBe(replacementImage)
		session.destroy()
	})

	it("keeps the source visible when a proxy cannot be mounted", () => {
		const { contentLayer, controlsLayer, markersLayer } = createLayerGroups()
		const sourceNode = new Konva.Group({ width: 160, height: 100, visible: true })
		contentLayer.add(sourceNode)
		const canvas = {
			contentLayer,
			controlsLayer,
			markersLayer,
			eventEmitter: { on: vi.fn(), off: vi.fn() },
			elementManager: {
				getElementData: vi.fn(() => ({ id: "image-1", type: "image" })),
				getElementInstance: vi.fn(() => ({ getNode: () => sourceNode })),
			},
		} as unknown as Canvas

		const session = new ImageEditingSession({ canvas, elementId: "image-1" })
		expect(session.mount()).toBe(false)
		expect(sourceNode.visible()).toBe(true)
		expect(controlsLayer.getChildren()).toHaveLength(0)
	})

	it("switches exclusive modes without leaving the markers layer hidden", () => {
		const { contentLayer, controlsLayer, markersLayer } = createLayerGroups()
		const canvas = { contentLayer, controlsLayer, markersLayer } as unknown as Canvas
		const coordinator = new ImageEditingCoordinator({ canvas })

		coordinator.activate({
			mode: "crop",
			elementId: "image-1",
			cancel: () => coordinator.deactivate("crop", "image-1"),
		})
		expect(markersLayer.visible()).toBe(true)
		expect(markersLayer.listening()).toBe(false)

		coordinator.activate({
			mode: "eraser",
			elementId: "image-2",
			cancel: () => coordinator.deactivate("eraser", "image-2"),
		})
		expect(coordinator.getActiveMode()).toBe("eraser")
		expect(markersLayer.visible()).toBe(false)

		coordinator.deactivate("eraser", "image-2")
		expect(markersLayer.visible()).toBe(true)
		expect(markersLayer.listening()).toBe(true)
	})

	it("does not change marker visibility when an idle coordinator is destroyed", () => {
		const { contentLayer, controlsLayer, markersLayer } = createLayerGroups()
		markersLayer.visible(false)
		markersLayer.listening(false)
		const canvas = { contentLayer, controlsLayer, markersLayer } as unknown as Canvas
		const coordinator = new ImageEditingCoordinator({ canvas })

		coordinator.destroy()

		expect(markersLayer.visible()).toBe(false)
		expect(markersLayer.listening()).toBe(false)
	})
})
