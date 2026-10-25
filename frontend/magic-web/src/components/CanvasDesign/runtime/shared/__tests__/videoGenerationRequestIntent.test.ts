import { describe, expect, it } from "vitest"
import type { GenerateVideoRequest } from "../../../public/magic-types"
import {
	hasVideoGenerationRequestEstimateIntent,
	hasVideoGenerationRequestMediaIntent,
	hasVideoGenerationRequestSubmitIntent,
} from "../videoGenerationRequestIntent"

describe("videoGenerationRequestIntent", () => {
	it("requires prompt or media input for estimate intent", () => {
		expect(
			hasVideoGenerationRequestEstimateIntent({
				model_id: "video-model",
				prompt: " ",
			}),
		).toBe(false)
		expect(
			hasVideoGenerationRequestEstimateIntent({
				model_id: "video-model",
				prompt: "make a launch video",
			}),
		).toBe(true)
	})

	it("requires media input for video edit estimate intent", () => {
		expect(
			hasVideoGenerationRequestEstimateIntent({
				model_id: "video-model",
				input_mode: "video_edit",
				task: "edit",
				prompt: "rewrite this clip",
			}),
		).toBe(false)
		expect(
			hasVideoGenerationRequestEstimateIntent({
				model_id: "video-model",
				input_mode: "video_edit",
				task: "edit",
				prompt: "rewrite this clip",
				inputs: {
					reference_videos: [{ uri: "./videos/linked.mp4" }],
				},
			}),
		).toBe(true)
	})

	it("treats video generation media inputs as user intent", () => {
		const request: Partial<GenerateVideoRequest> = {
			model_id: "video-model",
			prompt: " ",
			inputs: {
				frames: [{ role: "start", uri: "./images/start.jpg" }],
				reference_videos: [{ uri: "./videos/linked.mp4" }],
			},
		}

		expect(hasVideoGenerationRequestMediaIntent(request)).toBe(true)
		expect(hasVideoGenerationRequestEstimateIntent(request)).toBe(true)
	})

	it("requires a non-empty prompt for submit intent", () => {
		expect(
			hasVideoGenerationRequestSubmitIntent({
				model_id: "video-model",
				prompt: " ",
				inputs: {
					reference_videos: [{ uri: "./videos/linked.mp4" }],
				},
			}),
		).toBe(false)
		expect(
			hasVideoGenerationRequestSubmitIntent({
				model_id: "video-model",
				prompt: "make a launch video",
			}),
		).toBe(true)
	})

	it("accepts a promptless draft task with either supported source reference", () => {
		for (const draftTask of [{ video_id: "draft-video-id" }, { uri: "./videos/draft.mp4" }]) {
			const request: Partial<GenerateVideoRequest> = {
				model_id: "video-model",
				input_mode: "draft_task",
				task: "generate",
				inputs: { draft_task: draftTask },
			}
			expect(hasVideoGenerationRequestSubmitIntent(request)).toBe(true)
			expect(hasVideoGenerationRequestEstimateIntent(request)).toBe(true)
		}
		expect(
			hasVideoGenerationRequestSubmitIntent({
				model_id: "video-model",
				input_mode: "draft_task",
				inputs: { draft_task: {} },
			}),
		).toBe(false)
		expect(
			hasVideoGenerationRequestEstimateIntent({
				model_id: "video-model",
				input_mode: "standard",
				inputs: { draft_task: { video_id: "draft-video-id" } },
			}),
		).toBe(false)
	})

	it("accepts canvas composition without model or prompt", () => {
		expect(
			hasVideoGenerationRequestSubmitIntent({
				generation_type: "canvas_composition",
				composition: {
					videos: [{ path: "/新建画布/videos/a.mp4" }],
				},
			}),
		).toBe(true)
		expect(
			hasVideoGenerationRequestSubmitIntent({
				generation_type: "canvas_composition",
			}),
		).toBe(false)
	})

	it("ignores empty media fields and supports legacy request fields", () => {
		expect(
			hasVideoGenerationRequestMediaIntent({
				inputs: {
					reference_images: [{ uri: " " }],
				},
			}),
		).toBe(false)
		expect(
			hasVideoGenerationRequestMediaIntent({
				reference_images: ["./images/legacy.jpg"],
			} as Partial<GenerateVideoRequest>),
		).toBe(true)
	})
})
