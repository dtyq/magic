import { describe, expect, it } from "vitest"
import { GenerationStatus, ImageGenerationTaskTypeMap } from "../../../../public/magic-types"
import type { ImageElementContent } from "../../../document/types"
import { resolveImageDisplayState } from "../imageDisplayState"

function resolve(
	overrides: Partial<ImageElementContent> = {},
	options: Partial<Parameters<typeof resolveImageDisplayState>[0]> = {},
) {
	const content: ImageElementContent = {
		contentId: "image-content-1",
		...overrides,
	}
	return resolveImageDisplayState({
		content,
		isTemporary: false,
		hasActiveGeneration: false,
		hasActiveGenerationTask: false,
		hasGenerationRequest: false,
		isReplacementUploading: false,
		isResourceError: false,
		hasLoadedImage: false,
		...options,
	})
}

describe("resolveImageDisplayState", () => {
	it("keeps temporary upload and persisted Agent generation distinct", () => {
		expect(
			resolve({ status: GenerationStatus.Processing }, { isTemporary: true }),
		).toMatchObject({
			status: "uploading",
			surface: "placeholder",
		})
		expect(resolve({ status: GenerationStatus.Pending })).toMatchObject({
			status: "generating",
			surface: "placeholder",
		})
	})

	it("prioritizes an active replacement upload", () => {
		expect(
			resolve(
				{ src: "./images/original.png", status: GenerationStatus.Completed },
				{ isReplacementUploading: true, hasLoadedImage: true },
			),
		).toMatchObject({ status: "uploading", surface: "placeholder" })
	})

	it("keeps explicit termination ahead of active generation state", () => {
		expect(
			resolve(
				{
					status: "terminated",
					generateImageRequest: { image_id: "terminated-task" },
				},
				{ hasActiveGeneration: true, hasActiveGenerationTask: true },
			),
		).toMatchObject({ status: "terminated", surface: "error", failureSource: "generation" })
	})

	it("shows an overdue pending generation as timed out", () => {
		expect(
			resolve(
				{
					status: GenerationStatus.Processing,
					generateImageRequest: { image_id: "overdue-task" },
				},
				{
					hasActiveGeneration: true,
					hasActiveGenerationTask: true,
					generationTiming: { imageId: "overdue-task", startedAt: 1 },
				},
			),
		).toMatchObject({ status: "timed-out", surface: "error", failureSource: "generation" })
	})

	it("preserves a loaded source while exposing its generating status", () => {
		expect(
			resolve(
				{ src: "./images/original.png", status: GenerationStatus.Processing },
				{ hasActiveGenerationTask: true, hasLoadedImage: true },
			),
		).toMatchObject({ status: "generating", surface: "image" })
	})

	it("distinguishes a loaded completed image from a source still loading", () => {
		expect(
			resolve({ src: "./images/result.png", status: GenerationStatus.Completed }),
		).toMatchObject({
			status: "loading",
			surface: "loading",
		})
		expect(
			resolve(
				{ src: "./images/result.png", status: GenerationStatus.Completed },
				{ hasLoadedImage: true },
			),
		).toMatchObject({ status: "completed", surface: "image" })
	})

	it("does not treat a completed Content with persisted task metadata as generating", () => {
		expect(
			resolve(
				{
					src: "./images/result.png",
					status: GenerationStatus.Completed,
					generateImageRequest: { image_id: "finished-task" },
				},
				{ hasActiveGenerationTask: true, hasGenerationRequest: true, hasLoadedImage: true },
			),
		).toMatchObject({ status: "completed", surface: "image" })
	})

	it("does not treat a sourced Content with a missing status and stale task id as generating", () => {
		expect(
			resolve(
				{
					src: "./images/result.png",
					generateImageRequest: { image_id: "stale-task" },
				},
				{ hasActiveGenerationTask: true, hasGenerationRequest: true, hasLoadedImage: true },
			),
		).toMatchObject({ status: "completed", surface: "image" })
	})

	it("carries task type and separates generation failures from resource failures", () => {
		expect(
			resolve(
				{ imageGenerationTaskMeta: { type: ImageGenerationTaskTypeMap.Expand } },
				{ hasActiveGenerationTask: true },
			),
		).toMatchObject({ status: "generating", taskType: ImageGenerationTaskTypeMap.Expand })
		expect(resolve({ status: GenerationStatus.Failed })).toMatchObject({
			status: "failed",
			failureSource: "generation",
		})
		expect(resolve({ src: "./images/missing.png" }, { isResourceError: true })).toMatchObject({
			status: "failed",
			failureSource: "resource",
		})
	})

	it("keeps a loaded image visible when refreshing its resource fails", () => {
		expect(
			resolve(
				{ src: "./images/refreshing.png", status: GenerationStatus.Completed },
				{ isResourceError: true, hasLoadedImage: true },
			),
		).toMatchObject({
			status: "failed",
			surface: "image",
			failureSource: "resource",
		})
	})

	it("keeps a generation failure distinct from a stale resource error flag", () => {
		expect(
			resolve(
				{
					src: "./images/original.png",
					status: GenerationStatus.Failed,
					errorMessage: "generation failed",
				},
				{ isResourceError: false, hasLoadedImage: true },
			),
		).toMatchObject({
			status: "failed",
			surface: "error",
			failureSource: "generation",
		})
	})

	it("always shows a generation error over a resource error flag", () => {
		expect(
			resolve(
				{ src: "./images/old.png", status: GenerationStatus.Failed },
				{ isResourceError: true, hasLoadedImage: true },
			),
		).toMatchObject({
			status: "failed",
			surface: "error",
			failureSource: "generation",
		})
	})
})
