import { describe, expect, it } from "vitest"
import type { GenerateVideoRequest } from "../../../../../../public/magic-types"
import {
	areVideoPointsEstimateRequestsEqual,
	buildVideoPointsEstimateSignature,
	buildVideoPointsEstimateSignaturePayload,
} from "../video-points-estimate.utils"

describe("video-points-estimate.utils", () => {
	it("builds the explicit quote payload used for the estimate signature", () => {
		const request: Partial<GenerateVideoRequest> = {
			project_id: "project-id",
			video_id: "video-id",
			file_dir: "/Canvas/videos/",
			file_name: "clip.mp4",
			model_id: "video-model",
			prompt: "prompt text",
			input_mode: "standard",
			task: "generate",
			generation: {
				aspect_ratio: "16:9",
				resolution: "720p",
			},
		}

		expect(buildVideoPointsEstimateSignaturePayload(request)).toEqual({
			model_id: "video-model",
			input_mode: "standard",
			task: "generate",
			inputs: undefined,
			generation: {
				aspect_ratio: "16:9",
				resolution: "720p",
			},
		})
	})

	it("keeps prompt and request identity fields out of the signature", () => {
		const request: Partial<GenerateVideoRequest> = {
			project_id: "project-a",
			video_id: "video-a",
			file_dir: "/Canvas/videos/",
			file_name: "a.mp4",
			model_id: "video-model",
			prompt: "first prompt",
			input_mode: "standard",
			task: "generate",
			generation: {
				duration_seconds: 5,
			},
		}
		const sameQuoteRequest: Partial<GenerateVideoRequest> = {
			...request,
			project_id: "project-b",
			video_id: "video-b",
			file_name: "b.mp4",
			prompt: "second prompt",
		}

		expect(buildVideoPointsEstimateSignature(request)).toBe(
			buildVideoPointsEstimateSignature(sameQuoteRequest),
		)
	})

	it("treats deep-equal generation params as the same signature regardless of key order", () => {
		const left: Partial<GenerateVideoRequest> = {
			model_id: "video-model",
			input_mode: "standard",
			task: "generate",
			generation: {
				duration_seconds: 8,
				generate_audio: true,
				web_search: false,
			},
		}
		const right: Partial<GenerateVideoRequest> = {
			model_id: "video-model",
			task: "generate",
			input_mode: "standard",
			generation: {
				web_search: false,
				generate_audio: true,
				duration_seconds: 8,
			},
		}

		expect(buildVideoPointsEstimateSignature(left)).toBe(
			buildVideoPointsEstimateSignature(right),
		)
		expect(areVideoPointsEstimateRequestsEqual(left, right)).toBe(true)
	})
})
