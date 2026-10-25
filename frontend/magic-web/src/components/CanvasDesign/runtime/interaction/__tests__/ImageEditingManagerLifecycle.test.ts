import Konva from "konva"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Canvas } from "../../core/Canvas"
import { EventEmitter } from "../../core/EventEmitter"
import { ElementTypeEnum } from "../../document/types"
import { CropManager } from "../crop/CropManager"
import { CropRenderer } from "../crop/CropRenderer"
import { EraserManager } from "../eraser/EraserManager"
import { EraserRenderer } from "../eraser/EraserRenderer"
import { ExtendManager } from "../extend/ExtendManager"
import { ExtendRenderer } from "../extend/ExtendRenderer"

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

function createCanvasWithoutRenderedImage(options?: { withRenderedImage?: boolean }) {
	const eventEmitter = new EventEmitter()
	const permissionState = { write: true, generate: true }
	const sourceNode = new Konva.Group({ width: 160, height: 100, visible: true })
	const contentLayer = new Konva.Group()
	const controlsLayer = new Konva.Group()
	const markersLayer = new Konva.Group()
	const overlayLayer = new Konva.Group()
	contentLayer.add(sourceNode)
	if (options?.withRenderedImage) {
		sourceNode.add(
			new Konva.Image({
				width: 160,
				height: 100,
				image: document.createElement("canvas"),
			}),
		)
	}
	Object.assign(controlsLayer, { batchDraw: vi.fn() })
	Object.assign(markersLayer, { batchDraw: vi.fn() })
	Object.assign(overlayLayer, { batchDraw: vi.fn() })

	const imageEditingCoordinator = {
		activate: vi.fn(),
		deactivate: vi.fn(),
		isActive: vi.fn(() => false),
	}
	const elementManager = {
		getElementData: vi.fn(() => ({
			id: "image-1",
			type: ElementTypeEnum.Image,
			x: 20,
			y: 30,
			width: 160,
			height: 100,
		})),
		getElementInstance: vi.fn(() => ({
			getNode: () => sourceNode,
			getImageInfo: () => ({ naturalWidth: 160, naturalHeight: 100 }),
		})),
		update: vi.fn(),
	}
	const selectionManager = {
		deselectAll: vi.fn(),
		select: vi.fn((elementId: string) => {
			eventEmitter.emit({
				type: "element:select",
				data: { elementIds: [elementId] },
			})
		}),
	}
	const canvas = {
		eventEmitter,
		contentLayer,
		controlsLayer,
		markersLayer,
		overlayLayer,
		stage: new Konva.Group(),
		elementManager,
		selectionManager,
		imageEditingCoordinator,
		permissionManager: {
			can: (capability: string) =>
				capability === "document.write"
					? permissionState.write
					: capability === "sideEffect.generate"
						? permissionState.generate
						: true,
		},
		markerManager: {
			previewMarkersForCrop: vi.fn(),
			clearCropPreview: vi.fn(),
		},
		viewportController: { focusOnElements: vi.fn() },
		container: { focus: vi.fn() },
		cursorManager: {
			exitEraserMode: vi.fn(),
			restoreToolCursor: vi.fn(),
		},
	} as unknown as Canvas

	return {
		canvas,
		sourceNode,
		selectionManager,
		imageEditingCoordinator,
		permissionState,
	}
}

describe("image editing manager lifecycle", () => {
	it("keeps eraser undo and redo history isolated within the active session", () => {
		const { canvas } = createCanvasWithoutRenderedImage()
		const manager = new EraserManager({ canvas })
		const internalManager = manager as unknown as { erasingElementId: string | null }
		internalManager.erasingElementId = "image-1"

		const firstStroke = { mode: "erase" as const, radius: 16, points: [{ x: 10, y: 10 }] }
		const secondStroke = { mode: "restore" as const, radius: 20, points: [{ x: 20, y: 20 }] }
		const replacementStroke = {
			mode: "restore" as const,
			radius: 24,
			points: [{ x: 30, y: 30 }],
		}

		manager.pushStroke(firstStroke)
		manager.pushStroke(secondStroke)
		expect(manager.getMode()).toBe("erase")
		expect(manager.getStrokes()).toEqual([firstStroke, secondStroke])
		expect(manager.canUndo()).toBe(true)
		expect(manager.canRedo()).toBe(false)

		manager.undoLastStroke()
		expect(manager.getStrokes()).toEqual([firstStroke])
		expect(manager.canRedo()).toBe(true)

		manager.redoLastStroke()
		expect(manager.getStrokes()).toEqual([firstStroke, secondStroke])
		expect(manager.canRedo()).toBe(false)

		manager.undoLastStroke()
		manager.pushStroke(replacementStroke)
		expect(manager.getStrokes()).toEqual([firstStroke, replacementStroke])
		expect(manager.canRedo()).toBe(false)

		manager.exitEraserMode(true)
		expect(manager.canUndo()).toBe(false)
		expect(manager.canRedo()).toBe(false)
		manager.destroy()
	})

	it("resets the active mode with the eraser session", () => {
		const { canvas } = createCanvasWithoutRenderedImage()
		const manager = new EraserManager({ canvas })
		const internalManager = manager as unknown as { erasingElementId: string | null }
		internalManager.erasingElementId = "image-1"

		manager.setMode("restore")
		expect(manager.getMode()).toBe("restore")
		manager.exitEraserMode(true)
		expect(manager.getMode()).toBe("erase")
	})

	it("locks the stroke mode when a stroke begins", () => {
		const { canvas } = createCanvasWithoutRenderedImage()
		const manager = new EraserManager({ canvas })
		const internalManager = manager as unknown as { erasingElementId: string | null }
		internalManager.erasingElementId = "image-1"
		const renderer = new EraserRenderer({ canvas, elementId: "image-1", manager })
		const internalRenderer = renderer as unknown as { overlayGroup: Konva.Group }
		internalRenderer.overlayGroup = new Konva.Group()

		manager.setMode("restore")
		renderer.beginStroke({ x: 10, y: 10 })
		manager.setMode("erase")
		renderer.finishStroke()

		expect(manager.getStrokes()).toEqual([
			{ mode: "restore", radius: manager.getRadius(), points: [{ x: 10, y: 10 }] },
		])
		renderer.destroy()
		manager.destroy()
	})

	it("rolls crop mode back once when the visible proxy cannot mount", () => {
		const { canvas, sourceNode, selectionManager, imageEditingCoordinator } =
			createCanvasWithoutRenderedImage()
		const manager = new CropManager({ canvas })
		canvas.cropManager = manager

		manager.enterCropMode("image-1")

		expect(manager.getCroppingElementId()).toBeNull()
		expect(sourceNode.visible()).toBe(true)
		expect(imageEditingCoordinator.deactivate).toHaveBeenCalledTimes(1)
		expect(selectionManager.select).toHaveBeenCalledTimes(1)
		manager.destroy()
	})

	it("rolls eraser mode back once when the visible proxy cannot mount", () => {
		const { canvas, sourceNode, selectionManager, imageEditingCoordinator } =
			createCanvasWithoutRenderedImage()
		const manager = new EraserManager({ canvas })
		canvas.eraserManager = manager

		manager.enterEraserMode("image-1")

		expect(manager.getErasingElementId()).toBeNull()
		expect(sourceNode.visible()).toBe(true)
		expect(imageEditingCoordinator.deactivate).toHaveBeenCalledTimes(1)
		expect(selectionManager.select).toHaveBeenCalledTimes(1)
		manager.destroy()
	})

	it("restores the eraser source when its brush surface cannot be created", () => {
		const { canvas, sourceNode, selectionManager, imageEditingCoordinator } =
			createCanvasWithoutRenderedImage({ withRenderedImage: true })
		const rectDestroySpy = vi.spyOn(Konva.Rect.prototype, "destroy")
		vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue(null)
		const manager = new EraserManager({ canvas })
		canvas.eraserManager = manager

		manager.enterEraserMode("image-1")

		expect(manager.getErasingElementId()).toBeNull()
		expect(sourceNode.visible()).toBe(true)
		expect(imageEditingCoordinator.deactivate).toHaveBeenCalledTimes(1)
		expect(selectionManager.select).toHaveBeenCalledTimes(1)
		expect(rectDestroySpy).toHaveBeenCalledTimes(2)
		manager.destroy()
	})

	it("rolls crop mode back when renderer initialization throws", () => {
		const { canvas, sourceNode, selectionManager, imageEditingCoordinator } =
			createCanvasWithoutRenderedImage({ withRenderedImage: true })
		vi.spyOn(CropRenderer.prototype, "render").mockImplementation(() => {
			throw new Error("crop renderer failed")
		})
		const manager = new CropManager({ canvas })
		canvas.cropManager = manager

		expect(() => manager.enterCropMode("image-1")).toThrow("crop renderer failed")
		expect(manager.getCroppingElementId()).toBeNull()
		expect(sourceNode.visible()).toBe(true)
		expect(imageEditingCoordinator.deactivate).toHaveBeenCalledTimes(1)
		expect(selectionManager.select).toHaveBeenCalledTimes(1)
		manager.destroy()
	})

	it("rolls eraser mode back when renderer initialization throws", () => {
		const { canvas, sourceNode, selectionManager, imageEditingCoordinator } =
			createCanvasWithoutRenderedImage({ withRenderedImage: true })
		vi.spyOn(EraserRenderer.prototype, "render").mockImplementation(() => {
			throw new Error("eraser renderer failed")
		})
		const manager = new EraserManager({ canvas })
		canvas.eraserManager = manager

		expect(() => manager.enterEraserMode("image-1")).toThrow("eraser renderer failed")
		expect(manager.getErasingElementId()).toBeNull()
		expect(sourceNode.visible()).toBe(true)
		expect(imageEditingCoordinator.deactivate).toHaveBeenCalledTimes(1)
		expect(selectionManager.select).toHaveBeenCalledTimes(1)
		manager.destroy()
	})

	it("rolls extend mode back when renderer initialization throws", () => {
		const { canvas, sourceNode, selectionManager, imageEditingCoordinator } =
			createCanvasWithoutRenderedImage({ withRenderedImage: true })
		vi.spyOn(ExtendRenderer.prototype, "render").mockImplementation(() => {
			throw new Error("extend renderer failed")
		})
		const manager = new ExtendManager({ canvas })
		canvas.extendManager = manager

		expect(() => manager.enterExtendMode("image-1")).toThrow("extend renderer failed")
		expect(manager.getExtendingElementId()).toBeNull()
		expect(sourceNode.visible()).toBe(true)
		expect(imageEditingCoordinator.deactivate).toHaveBeenCalledTimes(1)
		expect(selectionManager.select).toHaveBeenCalledTimes(1)
		manager.destroy()
	})

	it("rolls extend mode back once when its renderer cannot create a proxy", () => {
		const { canvas, sourceNode, selectionManager, imageEditingCoordinator } =
			createCanvasWithoutRenderedImage()
		const manager = new ExtendManager({ canvas })
		canvas.extendManager = manager

		manager.enterExtendMode("image-1")

		expect(manager.getExtendingElementId()).toBeNull()
		expect(sourceNode.visible()).toBe(true)
		expect(imageEditingCoordinator.deactivate).toHaveBeenCalledTimes(1)
		expect(selectionManager.select).toHaveBeenCalledTimes(1)
		manager.destroy()
	})

	it("does not enter extend or eraser mode when generation is disabled", () => {
		const { canvas, permissionState } = createCanvasWithoutRenderedImage({
			withRenderedImage: true,
		})
		permissionState.generate = false
		const extendManager = new ExtendManager({ canvas })
		const eraserManager = new EraserManager({ canvas })

		extendManager.enterExtendMode("image-1")
		eraserManager.enterEraserMode("image-1")

		expect(extendManager.getExtendingElementId()).toBeNull()
		expect(eraserManager.getErasingElementId()).toBeNull()
		extendManager.destroy()
		eraserManager.destroy()
	})
})
