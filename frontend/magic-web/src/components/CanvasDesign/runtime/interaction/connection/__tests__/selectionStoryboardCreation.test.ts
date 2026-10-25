import { afterEach, describe, expect, it, vi } from "vitest"
import type { Canvas } from "../../../core/Canvas"
import { ElementTypeEnum, type StoryboardElementContent } from "../../../document/types"
import { getActiveContent } from "../../../document/elementContent"
import type { SelectionContentSnapshot } from "../../selection/selectionContentCollector"
import { createStoryboardFromSelection } from "../selectionStoryboardCreation"

function createSnapshot(): SelectionContentSnapshot {
	return {
		rootElementIds: ["group-1", "image-3"],
		items: [],
		imageSequence: ["image-1", "image-2", "image-3"],
		videoSequence: [],
		mainVideoSequence: [],
		audioSequence: [],
		counts: { image: 3, video: 0, audio: 0, text: 0 },
		boundingRect: { x: 0, y: 0, width: 500, height: 300 },
		selectionRevision: "group-1\u0000image-3",
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
	const runTransaction = vi.fn((callback: () => string | null) => callback())
	const canvas = {
		historyManager: {
			runTransaction,
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
		magicConfigManager: {
			config: {
				methods: {
					getRootStorage: vi.fn(() => ({})),
				},
			},
		},
	} as unknown as Canvas
	return { canvas, create, remove, select, connectElementsBatch, runTransaction }
}

describe("createStoryboardFromSelection", () => {
	afterEach(() => {
		vi.restoreAllMocks()
	})

	it("creates a root storyboard and connects every selected root", () => {
		const { canvas, create, select, connectElementsBatch } = createCanvas("created")
		const snapshot = createSnapshot()

		const elementId = createStoryboardFromSelection({
			canvas,
			snapshot,
			imageModelList: [],
			x: 1200,
			y: 300,
		})

		expect(elementId).toEqual(expect.any(String))
		const element = create.mock.calls[0]?.[0]
		expect(element).toMatchObject({
			id: elementId,
			type: ElementTypeEnum.Storyboard,
			x: 1200,
			y: 300,
			zIndex: 9,
		})
		expect(getActiveContent<StoryboardElementContent>(element)?.shots).toHaveLength(1)
		expect(connectElementsBatch).toHaveBeenCalledWith({
			edges: [
				{ sourceElementId: "group-1", targetElementId: elementId },
				{ sourceElementId: "image-3", targetElementId: elementId },
			],
		})
		expect(select).toHaveBeenCalledWith(elementId)
	})

	it("deletes the new storyboard when the root connection batch is rejected", () => {
		const { canvas, remove, select } = createCanvas("invalid")

		const elementId = createStoryboardFromSelection({
			canvas,
			snapshot: createSnapshot(),
			imageModelList: [],
			x: 1200,
			y: 300,
		})

		expect(elementId).toBeNull()
		expect(remove).toHaveBeenCalledWith(expect.any(String))
		expect(select).not.toHaveBeenCalled()
	})

	it("does not create a storyboard when image elements have no usable downstream content", () => {
		const { canvas, create, connectElementsBatch, runTransaction } = createCanvas("created")
		const snapshot = { ...createSnapshot(), imageSequence: [] }

		const elementId = createStoryboardFromSelection({
			canvas,
			snapshot,
			imageModelList: [],
			x: 1200,
			y: 300,
		})

		expect(elementId).toBeNull()
		expect(runTransaction).not.toHaveBeenCalled()
		expect(create).not.toHaveBeenCalled()
		expect(connectElementsBatch).not.toHaveBeenCalled()
	})
})
