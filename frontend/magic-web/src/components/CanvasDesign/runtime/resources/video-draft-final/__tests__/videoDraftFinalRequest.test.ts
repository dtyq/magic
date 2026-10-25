import { describe, expect, it } from "vitest"
import type { VideoModelItem } from "../../../../public/magic-types"
import type { VideoElementContent } from "../../../document/types"
import {
	buildVideoDraftFinalRequest,
	isDraftVideoContent,
	isVideoDraftFinalRequestForSource,
	resolveVideoDraftFinalElementSize,
	supportsVideoDraftFinal,
} from "../videoDraftFinalRequest"

function createDraftContent(overrides: Partial<VideoElementContent> = {}): VideoElementContent {
	return {
		contentId: "draft-content",
		src: "./videos/draft.mp4",
		status: "completed",
		generateVideoRequest: {
			video_id: "draft-video-id",
			model_id: "seedance-model",
			prompt: "inherited only by the server",
			generation: {
				draft: true,
				resolution: "480p",
				duration_seconds: 5,
				aspect_ratio: "16:9",
			},
		},
		...overrides,
	}
}

function createDraftCapableModel(): VideoModelItem {
	return {
		model_id: "seedance-model",
		video_generation_config: {
			generation: { resolutions: ["480p", "1080p"] },
			input_modes: {
				draft_task: {
					supported_fields: ["draft_task"],
					generation_constraints: { resolutions: ["1080p"] },
				},
			},
		},
	} as VideoModelItem
}

describe("videoDraftFinalRequest", () => {
	it("identifies drafts by the persisted draft flag instead of resolution", () => {
		expect(isDraftVideoContent(createDraftContent())).toBe(true)
		expect(
			isDraftVideoContent(
				createDraftContent({
					generateVideoRequest: {
						model_id: "seedance-model",
						generation: { resolution: "480p" },
					},
				}),
			),
		).toBe(false)
	})

	it("builds the exact video-id based final request without inherited generation fields", () => {
		expect(buildVideoDraftFinalRequest(createDraftContent(), "final-video-id")).toEqual({
			video_id: "final-video-id",
			model_id: "seedance-model",
			input_mode: "draft_task",
			task: "generate",
			inputs: { draft_task: { video_id: "draft-video-id" } },
			generation: { resolution: "1080p" },
		})
	})

	it("falls back to the draft uri only when the source task id is missing", () => {
		const content = createDraftContent({
			generateVideoRequest: {
				model_id: "seedance-model",
				generation: { draft: true, resolution: "480p" },
			},
		})

		expect(buildVideoDraftFinalRequest(content, "final-video-id")?.inputs).toEqual({
			draft_task: { uri: "./videos/draft.mp4" },
		})
	})

	it("uses model metadata as the final-generation capability source", () => {
		const model = createDraftCapableModel()
		expect(supportsVideoDraftFinal(model, "seedance-model")).toBe(true)
		expect(supportsVideoDraftFinal(model, "another-model")).toBe(false)
		expect(
			supportsVideoDraftFinal(
				{
					...model,
					video_generation_config: {
						...model.video_generation_config,
						input_modes: {},
					},
				},
				"seedance-model",
			),
		).toBe(false)
	})

	it("validates a final request by video id first and uri only as a fallback", () => {
		const source = createDraftContent()
		expect(
			isVideoDraftFinalRequestForSource(
				{
					input_mode: "draft_task",
					inputs: { draft_task: { video_id: "draft-video-id" } },
				},
				source,
			),
		).toBe(true)
		expect(
			isVideoDraftFinalRequestForSource(
				{
					input_mode: "draft_task",
					inputs: { draft_task: { uri: "./videos/draft.mp4" } },
				},
				source,
			),
		).toBe(false)
		expect(
			isVideoDraftFinalRequestForSource(
				{
					input_mode: "draft_task",
					inputs: {
						draft_task: {
							video_id: "legacy-unrelated-id",
							uri: "./videos/draft.mp4",
						},
					},
				},
				createDraftContent({
					generateVideoRequest: {
						model_id: "seedance-model",
						generation: { draft: true },
					},
				}),
			),
		).toBe(true)
	})

	it("resolves the final element size from the 1080p model size for the draft ratio", () => {
		const model = createDraftCapableModel()
		const generation = model.video_generation_config?.generation
		if (!generation) throw new Error("expected video generation config")
		generation.sizes = [
			{
				label: "16:9",
				value: "1920x1080",
				width: 1920,
				height: 1080,
				resolution: "1080p",
			},
			{
				label: "9:16",
				value: "1080x1920",
				width: 1080,
				height: 1920,
				resolution: "1080p",
			},
		]

		expect(resolveVideoDraftFinalElementSize(model, createDraftContent())).toEqual({
			width: 1920,
			height: 1080,
		})
	})
})
