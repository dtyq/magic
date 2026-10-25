import { beforeEach, describe, expect, it, vi } from "vitest"

const { start, ImageBatchPollingManagerMock } = vi.hoisted(() => {
	const start = vi.fn()
	const ImageBatchPollingManagerMock = vi.fn().mockImplementation(() => ({
		start,
	}))

	return { start, ImageBatchPollingManagerMock }
})

vi.mock("../polling/ImageBatchPollingManager", () => ({
	ImageBatchPollingManager: ImageBatchPollingManagerMock,
}))

import { resumeImageBatchPollingManagers } from "../polling/resumeImageBatchPolling"

describe("resumeImageBatchPollingManagers", () => {
	beforeEach(() => {
		start.mockReset()
		ImageBatchPollingManagerMock.mockClear()
	})

	it("rebuilds batch polling from persisted batch image task meta", () => {
		const canvas = {
			elementManager: {
				getAllElements: vi.fn(() => [
					{
						id: "element-2",
						type: "image",
						activeContentId: "element-2-content",
						mainContentId: "element-2-content",
						contents: [
							{
								contentId: "element-2-content",
								status: "processing",
								imageGenerationTaskMeta: {
									type: "batch",
									image_id: "batch-1",
									output_index: 2,
									output_count: 3,
								},
							},
						],
					},
					{
						id: "element-3",
						type: "image",
						activeContentId: "element-3-content",
						mainContentId: "element-3-content",
						contents: [
							{
								contentId: "element-3-content",
								status: "processing",
								imageGenerationTaskMeta: {
									type: "batch",
									image_id: "batch-1",
									output_index: 3,
									output_count: 3,
								},
							},
						],
					},
					{
						id: "completed-element",
						type: "image",
						activeContentId: "completed-content",
						mainContentId: "completed-content",
						contents: [
							{
								contentId: "completed-content",
								src: "/images/done.png",
								status: "completed",
								imageGenerationTaskMeta: {
									type: "batch",
									image_id: "batch-1",
									output_index: 1,
									output_count: 3,
								},
							},
						],
					},
				]),
			},
			imageBatchPollingRegistry: {
				get: vi.fn(() => undefined),
			},
		}

		resumeImageBatchPollingManagers(canvas as never)

		expect(ImageBatchPollingManagerMock).toHaveBeenCalledWith({
			canvas,
			imageId: "batch-1",
			elementIds: ["element-2", "element-3"],
			outputIndexes: [2, 3],
			contentIds: ["element-2-content", "element-3-content"],
			registry: canvas.imageBatchPollingRegistry,
		})
		expect(start).toHaveBeenCalledTimes(1)
	})

	it("rebuilds polling from a processing batch task in a non-active image Content", () => {
		const canvas = {
			elementManager: {
				getAllElements: vi.fn(() => [
					{
						id: "image-v2",
						type: "image",
						activeContentId: "v1",
						mainContentId: "v1",
						contents: [
							{
								contentId: "v1",
								src: "/images/done.png",
								status: "completed",
							},
							{
								contentId: "v2",
								status: "processing",
								imageGenerationTaskMeta: {
									type: "batch",
									image_id: "batch-2",
									output_index: 1,
									output_count: 1,
								},
							},
						],
					},
				]),
			},
			imageBatchPollingRegistry: {
				get: vi.fn(() => undefined),
			},
		}

		resumeImageBatchPollingManagers(canvas as never)

		expect(ImageBatchPollingManagerMock).toHaveBeenCalledWith({
			canvas,
			imageId: "batch-2",
			elementIds: ["image-v2"],
			outputIndexes: [1],
			contentIds: ["v2"],
			registry: canvas.imageBatchPollingRegistry,
		})
		expect(start).toHaveBeenCalledTimes(1)
	})

	it("syncs element ids into an active batch polling manager", () => {
		const syncElementIds = vi.fn()
		const canvas = {
			elementManager: {
				getAllElements: vi.fn(() => [
					{
						id: "element-1",
						type: "image",
						activeContentId: "element-1-content",
						mainContentId: "element-1-content",
						contents: [
							{
								contentId: "element-1-content",
								status: "processing",
								imageGenerationTaskMeta: {
									type: "batch",
									image_id: "batch-1",
									output_index: 1,
									output_count: 1,
								},
							},
						],
					},
				]),
			},
			imageBatchPollingRegistry: {
				get: vi.fn(() => ({ syncElementIds })),
			},
		}

		resumeImageBatchPollingManagers(canvas as never)

		expect(ImageBatchPollingManagerMock).not.toHaveBeenCalled()
		expect(start).not.toHaveBeenCalled()
		expect(syncElementIds).toHaveBeenCalledWith(["element-1"], [1], ["element-1-content"])
	})
})
