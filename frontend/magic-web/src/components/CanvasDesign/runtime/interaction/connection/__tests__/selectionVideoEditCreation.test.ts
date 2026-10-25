import { afterEach, describe, expect, it, vi } from "vitest"
import type { Canvas } from "../../../core/Canvas"
import { ElementTypeEnum, type VideoEditElementContent } from "../../../document/types"
import { getActiveContent } from "../../../document/elementContent"
import type { SelectionContentSnapshot } from "../../selection/selectionContentCollector"
import { createVideoEditFromSelection } from "../selectionVideoEditCreation"

function createSnapshot(): SelectionContentSnapshot {
	return {
		rootElementIds: ["frame-1", "video-3"],
		items: [],
		imageSequence: [],
		videoSequence: ["video-1", "video-2", "video-3"],
		mainVideoSequence: ["video-1", "video-2", "video-3"],
		audioSequence: ["audio-1"],
		counts: { image: 0, video: 3, audio: 1, text: 0 },
		boundingRect: { x: 0, y: 0, width: 500, height: 300 },
		selectionRevision: "frame-1\u0000video-3",
		allRootsCanConnect: true,
	}
}

function createCanvas(connectionStatus: "created" | "invalid") {
	const create = vi.fn()
	const remove = vi.fn()
	const select = vi.fn()
	const connectElementsBatch = vi.fn(({ edges }) =>
		connectionStatus === "created"
			? {
					status: "created" as const,
					connectionIds: edges.map((_: unknown, index: number) => `c-${index}`),
				}
			: { status: "invalid" as const, reason: "already-connected" as const },
	)
	const canvas = {
		historyManager: {
			runTransaction: vi.fn((callback: () => string | null) => callback()),
		},
		elementManager: {
			getNextZIndexInLevel: vi.fn(() => 9),
			create,
			delete: remove,
			hasElement: vi.fn(() => true),
		},
		connectionManager: { connectElementsBatch },
		selectionManager: { select },
		viewportController: {
			isElementInViewport: vi.fn(() => true),
			moveElementToViewport: vi.fn(),
		},
	} as unknown as Canvas
	return { canvas, create, remove, select, connectElementsBatch }
}

describe("createVideoEditFromSelection", () => {
	afterEach(() => {
		vi.restoreAllMocks()
	})

	it("creates a root video-edit node with collected sequences and root-level connections", () => {
		const { canvas, create, select, connectElementsBatch } = createCanvas("created")
		const snapshot = createSnapshot()

		const elementId = createVideoEditFromSelection({ canvas, snapshot, x: 1200, y: 300 })

		expect(elementId).toEqual(expect.any(String))
		const element = create.mock.calls[0]?.[0]
		expect(element).toMatchObject({
			id: elementId,
			type: ElementTypeEnum.VideoEdit,
			x: 1200,
			y: 300,
			zIndex: 9,
		})
		const content = getActiveContent<VideoEditElementContent>(element)
		expect(content).toEqual({ contentId: `${elementId}-content-1` })
		expect(connectElementsBatch).toHaveBeenCalledWith({
			edges: [
				{ sourceElementId: "frame-1", targetElementId: elementId },
				{ sourceElementId: "video-3", targetElementId: elementId },
			],
		})
		expect(select).toHaveBeenCalledWith(elementId)
	})

	it("deletes the new node when the atomic connection batch is rejected", () => {
		const { canvas, remove, select } = createCanvas("invalid")

		const elementId = createVideoEditFromSelection({
			canvas,
			snapshot: createSnapshot(),
			x: 1200,
			y: 300,
		})

		expect(elementId).toBeNull()
		expect(remove).toHaveBeenCalledWith(expect.any(String))
		expect(select).not.toHaveBeenCalled()
	})
})
