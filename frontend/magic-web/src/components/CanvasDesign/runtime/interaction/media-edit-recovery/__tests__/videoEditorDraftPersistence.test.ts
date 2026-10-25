import { describe, expect, it, vi } from "vitest"
import type { Canvas } from "../../../core/Canvas"
import { ElementTypeEnum } from "../../../document/types"
import { persistVideoEditorDraft } from "../videoEditorDraftPersistence"

const quickEditSource = {
	path: "./videos/current.mp4",
	src: "./videos/current.mp4",
	fileName: "current.mp4",
	assetType: "video" as const,
}

function createCanvas(content: Record<string, unknown>) {
	const update = vi.fn()
	const canvas = {
		elementManager: {
			getElementData: vi.fn(() => ({
				type: ElementTypeEnum.Video,
				contents: [content],
			})),
			update,
		},
	} as unknown as Canvas
	return { canvas, update }
}

describe("persistVideoEditorDraft quick edit source", () => {
	it("stores the source anchor with the video editor draft", () => {
		const { canvas, update } = createCanvas({ contentId: "content-1" })

		const draft = persistVideoEditorDraft({
			canvas,
			elementId: "video-1",
			contentId: "content-1",
			snapshot: {
				request: { model_id: "model-1" },
				modeDrafts: {},
				quickEditSource,
			},
		})

		expect(draft?.quickEditSource).toEqual(quickEditSource)
		expect(update).toHaveBeenCalledWith(
			"video-1",
			expect.objectContaining({
				contents: [
					expect.objectContaining({
						videoEditorDraft: expect.objectContaining({ quickEditSource }),
					}),
				],
			}),
			{ historyPolicy: "exclude" },
		)
	})

	it("removes the source anchor when the draft no longer contains it", () => {
		const { canvas, update } = createCanvas({
			contentId: "content-1",
			videoEditorDraft: {
				version: 1,
				request: { model_id: "model-1" },
				modeDrafts: {},
				quickEditSource,
				updatedAt: 1,
			},
		})

		const draft = persistVideoEditorDraft({
			canvas,
			elementId: "video-1",
			contentId: "content-1",
			snapshot: {
				request: { model_id: "model-1" },
				modeDrafts: {},
			},
		})

		expect(draft?.quickEditSource).toBeUndefined()
		expect(update).toHaveBeenCalledOnce()
	})

	it("persists an explicit source removal marker", () => {
		const { canvas } = createCanvas({ contentId: "content-1" })

		const draft = persistVideoEditorDraft({
			canvas,
			elementId: "video-1",
			contentId: "content-1",
			snapshot: {
				request: { model_id: "model-1" },
				modeDrafts: {},
				quickEditSourceRemoved: true,
			},
		})

		expect(draft?.quickEditSourceRemoved).toBe(true)
	})
})
