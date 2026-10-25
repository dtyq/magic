import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Canvas } from "../../../../runtime/core/Canvas"
import type { CanvasDesignStorageData } from "../../../../public/magic-types"
import { createTestResourceReferenceResolver } from "../../../../public/__tests__/testResourceReferenceResolver"

const mocks = vi.hoisted(() => ({
	useCanvas: vi.fn(),
	resolveLinkedEditorInputs: vi.fn(),
}))

const resolveDesignAResourceReference = createTestResourceReferenceResolver()

vi.mock("../../../../app/providers/CanvasProvider", () => ({
	useCanvas: mocks.useCanvas,
}))

vi.mock("../../../../app/hooks/canvas", () => ({
	useCanvasEvent: vi.fn(),
}))

vi.mock("../linkedEditorInputs", async (importOriginal) => {
	const actual = await importOriginal<typeof import("../linkedEditorInputs")>()
	return {
		...actual,
		resolveLinkedEditorInputs: mocks.resolveLinkedEditorInputs,
	}
})

import { useLinkedEditorInputs } from "../useLinkedEditorInputs"

function createCanvas(initialStorage: CanvasDesignStorageData): {
	canvas: Canvas
	getStorage: () => CanvasDesignStorageData
} {
	let storage = initialStorage
	const canvas = {
		magicConfigManager: {
			config: {
				methods: {
					getStorage: () => storage,
					resolveResourceReference: resolveDesignAResourceReference,
					saveStorage: (nextStorage: CanvasDesignStorageData) => {
						storage = nextStorage
					},
				},
			},
		},
		connectionManager: {
			removeConnection: vi.fn(),
		},
	} as unknown as Canvas
	return { canvas, getStorage: () => storage }
}

describe("useLinkedEditorInputs draft persistence", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("hydrates text selections but ignores v1 media selection IDs", async () => {
		const targetElementId = "target-image"
		const { canvas, getStorage } = createCanvas({
			tempLinkedEditorDrafts: {
				[targetElementId]: {
					version: 1,
					selectedTextConnectionIds: ["text-1"],
					orderedTextConnectionIds: ["text-2", "text-1"],
					selectedMediaConnectionIds: ["media-1"],
				},
			},
		})
		mocks.useCanvas.mockReturnValue({ canvas })
		mocks.resolveLinkedEditorInputs.mockReturnValue({
			connectedSourceElementIds: [],
			textConnections: [
				{ connectionId: "text-1", sourceElementId: "source-text-1", text: "first" },
				{ connectionId: "text-2", sourceElementId: "source-text-2", text: "second" },
			],
			textPrompt: "",
			mediaItems: [
				{
					connectionId: "media-1",
					sourceElementId: "source-image-1",
					kind: "image",
					path: "./images/source.png",
					status: "inactive",
				},
			],
			activeMediaReferences: [],
		})

		const { result } = renderHook(() =>
			useLinkedEditorInputs({
				targetElementId,
				targetKind: "image",
				mediaPolicy: { supportedKinds: ["image"] },
				mentionedReferencePaths: ["./images/source.png"],
			}),
		)

		await waitFor(() => {
			expect(result.current.textConnections.map((item) => item.connectionId)).toEqual([
				"text-2",
				"text-1",
			])
			expect(result.current.isTextConnectionSelected("text-1")).toBe(true)
			expect(result.current.mediaItems[0]?.selected).toBe(true)
		})

		act(() => result.current.setTextConnectionSelected("text-2", true))

		await waitFor(() => {
			expect(getStorage().tempLinkedEditorDrafts?.[targetElementId]).toEqual({
				version: 2,
				selectedTextConnectionIds: ["text-1", "text-2"],
				orderedTextConnectionIds: ["text-2", "text-1"],
			})
		})
	})

	it("rejects media candidates disabled by the current policy", async () => {
		const targetElementId = "target-image"
		const { canvas } = createCanvas({})
		mocks.useCanvas.mockReturnValue({ canvas })
		mocks.resolveLinkedEditorInputs.mockReturnValue({
			connectedSourceElementIds: [],
			textConnections: [],
			textPrompt: "",
			mediaItems: [
				{
					connectionId: "media-video",
					sourceElementId: "source-video",
					kind: "video",
					path: "./videos/source.mp4",
					status: "inactive",
				},
			],
			activeMediaReferences: [],
		})

		const { result } = renderHook(() =>
			useLinkedEditorInputs({
				targetElementId,
				targetKind: "image",
				mediaPolicy: { supportedKinds: ["image"] },
			}),
		)

		await waitFor(() => {
			expect(result.current.mediaItems[0]?.selectionDisabledReason).toBe("unsupported-type")
		})
		expect(result.current.canSelectMediaConnection("media-video")).toBe(false)
		expect(result.current.mediaItems[0]?.selected).toBe(false)
	})

	it("derives selected state from mentions while preserving policy limits", async () => {
		const targetElementId = "target-image"
		const { canvas } = createCanvas({})
		mocks.useCanvas.mockReturnValue({ canvas })
		mocks.resolveLinkedEditorInputs.mockReturnValue({
			connectedSourceElementIds: [],
			textConnections: [],
			textPrompt: "",
			mediaItems: [
				{
					connectionId: "media-1",
					sourceElementId: "source-image-1",
					kind: "image",
					path: "./images/source-1.png",
					status: "inactive",
				},
				{
					connectionId: "media-2",
					sourceElementId: "source-image-2",
					kind: "image",
					path: "./images/source-2.png",
					status: "inactive",
				},
			],
			activeMediaReferences: [],
		})

		const { result } = renderHook(() =>
			useLinkedEditorInputs({
				targetElementId,
				targetKind: "image",
				mediaPolicy: { supportedKinds: ["image"], maxTotalCount: 1 },
				mentionedReferencePaths: ["/画布A/images/source-1.png"],
			}),
		)

		await waitFor(() => expect(result.current.mediaItems[0]?.selected).toBe(true))
		expect(result.current.mediaItems[1]?.selected).toBe(false)
		expect(result.current.canSelectMediaConnection("media-1")).toBe(true)
		expect(result.current.canSelectMediaConnection("media-2")).toBe(false)
	})
})
