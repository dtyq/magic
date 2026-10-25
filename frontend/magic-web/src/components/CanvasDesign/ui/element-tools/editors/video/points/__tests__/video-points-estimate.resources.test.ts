import { describe, expect, it } from "vitest"
import type { GenerateVideoRequest } from "../../../../../../public/magic-types"
import { createTestResourceReferenceResolver } from "../../../../../../public/__tests__/testResourceReferenceResolver"
import {
	collectPendingVideoGenerationRequestResourcePaths,
	collectVideoGenerationRequestResourcePaths,
} from "../video-points-estimate.resources"

const resolveDesignAResourceReference = createTestResourceReferenceResolver()

describe("video-points-estimate.resources", () => {
	it("collects video generation schema resource paths and ignores prompt text", () => {
		const request: Partial<GenerateVideoRequest> = {
			prompt: "do not rewrite ./videos/prompt-only.mp4",
			inputs: {
				frames: [
					{ role: "start", uri: "./images/start.jpg" },
					{ role: "end", uri: "images/end.jpg" },
				],
				reference_images: [{ uri: "./images/ref.jpg" }],
				reference_videos: [{ uri: "./videos/ref.mp4" }],
				reference_audios: [{ uri: "./audios/ref.mp3" }],
				video: { uri: "./videos/source.mp4" },
				mask: { uri: "./images/mask.png" },
				audio: [{ uri: "./audios/source.wav" }],
			},
		}

		expect(collectVideoGenerationRequestResourcePaths(request)).toEqual([
			"./images/start.jpg",
			"images/end.jpg",
			"./images/ref.jpg",
			"./videos/ref.mp4",
			"./audios/ref.mp3",
			"./audios/source.wav",
			"./videos/source.mp4",
			"./images/mask.png",
		])
	})

	it("deduplicates equivalent local paths and skips remote urls", () => {
		const request: Partial<GenerateVideoRequest> = {
			inputs: {
				frames: [
					{ role: "start", uri: "./images/ref.jpg" },
					{ role: "end", uri: "/画布A/images/ref.jpg" },
				],
				reference_videos: [
					{ uri: "https://example.com/ref.mp4" },
					{ uri: "./videos/ref.mp4" },
				],
				video: { uri: "/画布A/videos/ref.mp4" },
			},
		}

		expect(
			collectVideoGenerationRequestResourcePaths(request, resolveDesignAResourceReference),
		).toEqual(["./images/ref.jpg", "./videos/ref.mp4"])
	})

	it("returns only paths that are currently deferred", () => {
		const request: Partial<GenerateVideoRequest> = {
			inputs: {
				reference_images: [{ uri: "./images/ready.jpg" }],
				reference_videos: [{ uri: "./videos/pending.mp4" }],
			},
		}

		expect(
			collectPendingVideoGenerationRequestResourcePaths(
				request,
				(path) => path === "./videos/pending.mp4",
			),
		).toEqual(["./videos/pending.mp4"])
	})

	it("collects only the uri fallback from a draft task", () => {
		expect(
			collectVideoGenerationRequestResourcePaths({
				inputs: {
					draft_task: {
						video_id: "draft-video-id",
						uri: "./videos/draft.mp4",
					},
				},
			}),
		).toEqual(["./videos/draft.mp4"])
		expect(
			collectVideoGenerationRequestResourcePaths({
				inputs: { draft_task: { video_id: "draft-video-id" } },
			}),
		).toEqual([])
	})

	it("tolerates legacy API-shaped request fields", () => {
		const request = {
			reference_images: ["./images/legacy.jpg"],
			frames: [{ role: "start", uri: "./images/legacy-start.jpg" }],
		} as Partial<GenerateVideoRequest>

		expect(collectVideoGenerationRequestResourcePaths(request)).toEqual([
			"./images/legacy.jpg",
			"./images/legacy-start.jpg",
		])
	})
})
