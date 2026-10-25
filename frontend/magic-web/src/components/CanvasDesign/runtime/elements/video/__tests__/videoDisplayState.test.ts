import { describe, expect, it } from "vitest"
import type { VideoElementContent } from "../../../document/types"
import { GenerationStatus } from "../../../../public/magic-types"
import { resolveVideoDisplayState } from "../videoDisplayState"

function resolve(
	overrides: Partial<VideoElementContent> = {},
	options: Partial<Parameters<typeof resolveVideoDisplayState>[0]> = {},
) {
	const content: VideoElementContent = {
		contentId: "video-content-1",
		...overrides,
	}
	return resolveVideoDisplayState({
		content,
		isTemporary: false,
		isComplianceActive: false,
		hasActiveGeneration: false,
		hasActiveGenerationTask: false,
		isCompositionActive: false,
		isReplacementUploading: false,
		isResourceError: false,
		isGenerationError: false,
		hasPreview: false,
		isPreviewLoading: false,
		...options,
	})
}

describe("resolveVideoDisplayState", () => {
	it("keeps temporary upload and persisted generation distinct", () => {
		expect(
			resolve({ status: GenerationStatus.Processing }, { isTemporary: true }),
		).toMatchObject({
			status: "uploading",
			surface: "placeholder",
		})
		expect(resolve({ status: GenerationStatus.Pending })).toMatchObject({
			status: "uploading",
			surface: "placeholder",
		})
	})

	it("keeps pending without a task id in the upload phase", () => {
		expect(resolve({ status: GenerationStatus.Pending })).toMatchObject({
			status: "uploading",
			surface: "placeholder",
		})
		expect(
			resolve({ status: GenerationStatus.Pending }, { hasActiveGenerationTask: true }),
		).toMatchObject({ status: "generating", surface: "placeholder" })
	})

	it("treats processing on a formal element as generation", () => {
		expect(resolve({ status: GenerationStatus.Processing })).toMatchObject({
			status: "generating",
			surface: "placeholder",
		})
	})

	it("treats a pending sourced video with a valid task id as generating", () => {
		expect(
			resolve(
				{ src: "./videos/old.mp4", status: GenerationStatus.Pending },
				{ hasActiveGenerationTask: true, hasPreview: true },
			),
		).toMatchObject({ status: "generating", surface: "preview" })
	})

	it("prioritizes replacement upload", () => {
		expect(
			resolve(
				{ src: "./videos/original.mp4", status: GenerationStatus.Completed },
				{ isReplacementUploading: true, hasPreview: true },
			),
		).toMatchObject({ status: "uploading", surface: "placeholder" })
	})

	it("shows the compliance placeholder before generation starts", () => {
		expect(
			resolve(
				{ src: "./videos/original.mp4", status: GenerationStatus.Completed },
				{ isComplianceActive: true, hasPreview: true },
			),
		).toMatchObject({ status: "compliance", surface: "placeholder" })
	})

	it("keeps an existing preview while generation or composition is active", () => {
		expect(
			resolve(
				{ src: "./videos/original.mp4", status: GenerationStatus.Processing },
				{ hasActiveGenerationTask: true, hasPreview: true },
			),
		).toMatchObject({ status: "generating", surface: "preview" })
		expect(
			resolve(
				{ src: "./videos/original.mp4", status: GenerationStatus.Completed },
				{ isCompositionActive: true, hasPreview: true },
			),
		).toMatchObject({ status: "composing", surface: "preview" })
		expect(
			resolve(
				{ src: "./videos/original.mp4", status: GenerationStatus.Completed },
				{ isCompositionActive: true },
			),
		).toMatchObject({ status: "composing", surface: "loading" })
	})

	it("uses loading surface until a sourced video has a preview", () => {
		expect(
			resolve({ src: "./videos/result.mp4", status: GenerationStatus.Completed }),
		).toMatchObject({
			status: "loading",
			surface: "loading",
		})
		expect(
			resolve(
				{ src: "./videos/result.mp4", status: GenerationStatus.Completed },
				{ hasPreview: true },
			),
		).toMatchObject({ status: "completed", surface: "preview" })
	})

	it("does not treat completed sourced content with stale task metadata as generating", () => {
		expect(
			resolve(
				{
					src: "./videos/result.mp4",
					status: GenerationStatus.Completed,
					generateVideoRequest: { video_id: "stale-task" },
				},
				{ hasActiveGenerationTask: true, hasPreview: true },
			),
		).toMatchObject({ status: "completed", surface: "preview" })
	})

	it("returns empty for a request without a task id or lifecycle status", () => {
		expect(resolve({ generateVideoRequest: { prompt: "stale request" } })).toMatchObject({
			status: "empty",
			surface: "empty",
		})
	})

	it("distinguishes generation failure from resource failure", () => {
		expect(resolve({ status: GenerationStatus.Failed })).toMatchObject({
			status: "failed",
			surface: "error",
			failureSource: "generation",
		})
		expect(resolve({ src: "./videos/missing.mp4" }, { isResourceError: true })).toMatchObject({
			status: "failed",
			surface: "error",
			failureSource: "resource",
		})
	})

	it("retains an old preview when a resource refresh fails", () => {
		expect(
			resolve(
				{ src: "./videos/refreshing.mp4", status: GenerationStatus.Completed },
				{ isResourceError: true, hasPreview: true },
			),
		).toMatchObject({ status: "failed", surface: "preview", failureSource: "resource" })
	})

	it("shows generation failure instead of an old preview", () => {
		expect(
			resolve(
				{ src: "./videos/old.mp4", status: GenerationStatus.Failed },
				{ hasPreview: true },
			),
		).toMatchObject({ status: "failed", surface: "error", failureSource: "generation" })
	})

	it("keeps playback failures outside the display state contract", () => {
		const state = resolve(
			{ src: "./videos/valid.mp4", status: GenerationStatus.Completed },
			{ hasPreview: true },
		)
		expect(state).toMatchObject({ status: "completed", surface: "preview" })
	})
})
