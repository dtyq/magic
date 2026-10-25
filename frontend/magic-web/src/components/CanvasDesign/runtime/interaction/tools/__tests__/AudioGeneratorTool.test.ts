import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Canvas } from "../../../core/Canvas"
import { ElementTypeEnum } from "../../../document/types"
import { AudioGeneratorTool } from "../AudioGeneratorTool"

const mocks = vi.hoisted(() => ({
	generateElementId: vi.fn(() => "audio-generated-1"),
	collectObstacleRects: vi.fn(() => [{ x: 0, y: 0, width: 100, height: 100 }]),
	findPosition: vi.fn(() => ({ x: 120, y: 220 })),
}))

vi.mock("../../../shared/ids", () => ({
	generateElementId: mocks.generateElementId,
}))

vi.mock("../../../shared/placement/findNonOverlappingPlacement", () => ({
	collectObstacleRects: mocks.collectObstacleRects,
	findNextImageVideoPlaceholderPositionNearViewport: mocks.findPosition,
}))

vi.mock("../../../shared/placement/elementUtils", () => ({
	getCanvasCenter: vi.fn(() => ({ x: 500, y: 400 })),
	getViewportCanvasRect: vi.fn(() => ({ x: 0, y: 0, width: 1000, height: 800 })),
	getResolvedMediaPlacementConfig: vi.fn(() => ({
		spacing: 24,
		maxPerRow: 4,
		maxSearchRings: 8,
	})),
}))

function createHarness(options?: { inViewport?: boolean }) {
	let clickHandler: (() => void) | undefined
	const create = vi.fn()
	const select = vi.fn()
	const moveElementToViewport = vi.fn()
	const switchToSelection = vi.fn()
	const stage = {
		on: vi.fn((_eventType: string, handler: () => void) => {
			clickHandler = handler
		}),
		off: vi.fn(),
		getPointerPosition: vi.fn(() => ({ x: 640, y: 360 })),
		getAbsoluteTransform: vi.fn(() => ({
			copy: () => ({
				invert: vi.fn(),
				point: vi.fn(() => ({ x: 900, y: 700 })),
			}),
		})),
	} as unknown as Canvas["stage"]
	const canvas = {
		stage,
		contentLayer: {},
		elementManager: {
			getAllElements: vi.fn(() => []),
			getNextZIndexInLevel: vi.fn(() => 9),
			create,
		},
		permissionManager: {
			isVisible: vi.fn(() => true),
			isLocked: vi.fn(() => false),
		},
		selectionManager: { select },
		viewportController: {
			isElementInViewport: vi.fn(() => options?.inViewport ?? false),
			moveElementToViewport,
		},
		toolManager: { getActivationSource: vi.fn(() => null), switchToSelection },
	} as unknown as Canvas

	return {
		canvas,
		tool: new AudioGeneratorTool({ canvas }),
		create,
		select,
		moveElementToViewport,
		switchToSelection,
		stage,
		triggerClick: () => clickHandler?.(),
	}
}

describe("AudioGeneratorTool", () => {
	beforeEach(() => {
		mocks.generateElementId.mockReturnValue("audio-generated-1")
		mocks.collectObstacleRects.mockClear()
		mocks.findPosition.mockClear()
	})

	afterEach(() => {
		vi.unstubAllGlobals()
		vi.restoreAllMocks()
	})

	it("creates and selects a persistent empty audio node near the viewport", () => {
		vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
			callback(0)
			return 1
		})
		const harness = createHarness()

		harness.tool.createAudioAtCenter()

		expect(mocks.findPosition).toHaveBeenCalledWith(
			expect.any(Array),
			expect.objectContaining({
				elementWidth: 1280,
				elementHeight: 720,
				anchor: { x: 500, y: 400 },
			}),
		)
		expect(harness.create).toHaveBeenCalledWith(
			expect.objectContaining({
				id: "audio-generated-1",
				type: ElementTypeEnum.Audio,
				x: 120,
				y: 220,
				width: 1280,
				height: 720,
				zIndex: 9,
				activeContentId: "audio-generated-1-content-1",
				mainContentId: "audio-generated-1-content-1",
				contents: [{ contentId: "audio-generated-1-content-1" }],
			}),
		)
		expect(harness.select).toHaveBeenCalledWith("audio-generated-1")
		expect(harness.moveElementToViewport).toHaveBeenCalledWith(
			["audio-generated-1"],
			expect.objectContaining({ animated: true }),
		)
		expect(harness.switchToSelection).toHaveBeenCalledTimes(1)
	})

	it("creates at an explicit canvas point and keeps an already visible node in place", () => {
		vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
			callback(0)
			return 1
		})
		const harness = createHarness({ inViewport: true })

		expect(harness.tool.createAudioAtCanvasPoint(1000, 800)).toBe("audio-generated-1")

		expect(harness.create).toHaveBeenCalledWith(
			expect.objectContaining({ x: 360, y: 440, width: 1280, height: 720 }),
		)
		expect(mocks.findPosition).not.toHaveBeenCalled()
		expect(harness.moveElementToViewport).not.toHaveBeenCalled()
	})

	it("supports click placement and removes its stage listener when deactivated", () => {
		vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
			callback(0)
			return 1
		})
		const harness = createHarness({ inViewport: true })

		harness.tool.activate()
		harness.triggerClick()
		harness.tool.deactivate()

		expect(harness.stage.on).toHaveBeenCalledWith("click", expect.any(Function))
		expect(harness.create).toHaveBeenCalledWith(
			expect.objectContaining({ x: 260, y: 340, width: 1280, height: 720 }),
		)
		expect(harness.stage.off).toHaveBeenCalledWith("click", expect.any(Function))
	})
})
