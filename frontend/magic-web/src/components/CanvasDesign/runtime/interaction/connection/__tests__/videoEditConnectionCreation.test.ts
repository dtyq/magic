import { afterEach, describe, expect, it, vi } from "vitest"
import type { Canvas } from "../../../core/Canvas"
import { ElementTypeEnum } from "../../../document/types"
import {
	canCreateVideoEditFromAudioConnection,
	createVideoEditFromAudioConnection,
} from "../videoEditConnectionCreation"

function createCanvas(connectionStatus: "created" | "invalid", sourceType = ElementTypeEnum.Audio) {
	const create = vi.fn()
	const remove = vi.fn()
	const select = vi.fn()
	const connectElements = vi.fn(() =>
		connectionStatus === "created"
			? ({ status: "created", connectionId: "connection-1" } as const)
			: ({ status: "invalid", reason: "already-connected" } as const),
	)
	const canvas = {
		elementManager: {
			getElementData: vi.fn((elementId: string) =>
				elementId === "audio-1" ? { id: elementId, type: sourceType } : undefined,
			),
			isElementVisibleInDataTree: vi.fn(() => true),
			getNextZIndexInLevel: vi.fn(() => 9),
			create,
			delete: remove,
			hasElement: vi.fn(() => true),
		},
		connectionManager: { connectElements },
		historyManager: {
			runTransaction: vi.fn((callback: () => string | null) => callback()),
		},
		selectionManager: { select },
		viewportController: {
			isElementInViewport: vi.fn(() => true),
			moveElementToViewport: vi.fn(),
		},
		permissionManager: { canConnect: vi.fn(() => true) },
	} as unknown as Canvas
	return { canvas, create, remove, select, connectElements }
}

describe("video edit connection creation from audio", () => {
	afterEach(() => {
		vi.restoreAllMocks()
	})

	it("only allows a single audio element on the right side", () => {
		const { canvas } = createCanvas("created")

		expect(
			canCreateVideoEditFromAudioConnection(canvas, {
				kind: "element",
				elementId: "audio-1",
				side: "right",
			}),
		).toBe(true)
		expect(
			canCreateVideoEditFromAudioConnection(canvas, {
				kind: "element",
				elementId: "audio-1",
				side: "left",
			}),
		).toBe(false)
		const { canvas: videoCanvas } = createCanvas("created", ElementTypeEnum.Video)
		expect(
			canCreateVideoEditFromAudioConnection(videoCanvas, {
				kind: "element",
				elementId: "audio-1",
				side: "right",
			}),
		).toBe(false)
	})

	it("creates a video edit node and connects the audio source atomically", () => {
		const { canvas, create, select, connectElements } = createCanvas("created")

		const elementId = createVideoEditFromAudioConnection({
			canvas,
			origin: { kind: "element", elementId: "audio-1", side: "right" },
			x: 1200,
			y: 300,
		})

		expect(elementId).toEqual(expect.any(String))
		expect(create).toHaveBeenCalledWith(
			expect.objectContaining({
				id: elementId,
				type: ElementTypeEnum.VideoEdit,
				x: 1200,
				y: 300,
				zIndex: 9,
			}),
		)
		expect(connectElements).toHaveBeenCalledWith({
			sourceElementId: "audio-1",
			targetElementId: elementId,
		})
		expect(select).toHaveBeenCalledWith(elementId)
	})

	it("removes the new node when the connection is rejected", () => {
		const { canvas, remove, select } = createCanvas("invalid")

		const elementId = createVideoEditFromAudioConnection({
			canvas,
			origin: { kind: "element", elementId: "audio-1", side: "right" },
			x: 1200,
			y: 300,
		})

		expect(elementId).toBeNull()
		expect(remove).toHaveBeenCalledWith(expect.any(String))
		expect(select).not.toHaveBeenCalled()
	})
})
