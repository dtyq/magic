import { describe, expect, it } from "vitest"
import type { GenerateVideoRequest } from "../../../../../../public/magic-types"
import { resolveVideoPointsEstimateGate } from "../video-points-estimate.policy"

describe("video-points-estimate.policy", () => {
	it("allows estimating when the quote dependencies are ready", () => {
		const request: Partial<GenerateVideoRequest> = {
			model_id: "video-model",
			prompt: "make a short launch video",
		}

		expect(
			resolveVideoPointsEstimateGate({
				enabled: true,
				request,
				signature: "signature",
				hasEstimateVideoPoints: true,
				hasPendingResourceDeferrals: false,
			}),
		).toEqual({
			canEstimate: true,
			blockedReason: null,
		})
	})

	it("requires prompt or media input as user intent", () => {
		expect(
			resolveVideoPointsEstimateGate({
				enabled: true,
				request: {
					model_id: "video-model",
					prompt: "   ",
				},
				signature: "signature",
				hasEstimateVideoPoints: true,
				hasPendingResourceDeferrals: false,
			}),
		).toEqual({
			canEstimate: false,
			blockedReason: "missing_user_intent",
		})
	})

	it("treats media input as user intent even when prompt is empty", () => {
		expect(
			resolveVideoPointsEstimateGate({
				enabled: true,
				request: {
					model_id: "video-model",
					prompt: "   ",
					inputs: {
						reference_videos: [{ uri: "./videos/linked.mp4" }],
					},
				},
				signature: "signature",
				hasEstimateVideoPoints: true,
				hasPendingResourceDeferrals: false,
			}),
		).toEqual({
			canEstimate: true,
			blockedReason: null,
		})
	})

	it("reports the first structural block reason", () => {
		expect(
			resolveVideoPointsEstimateGate({
				enabled: true,
				request: { prompt: "hello" },
				signature: "signature",
				hasEstimateVideoPoints: true,
				hasPendingResourceDeferrals: false,
			}),
		).toEqual({
			canEstimate: false,
			blockedReason: "missing_model",
		})
	})

	it("blocks while request resources are still deferred", () => {
		expect(
			resolveVideoPointsEstimateGate({
				enabled: true,
				request: { model_id: "video-model", prompt: "hello" },
				signature: "signature",
				hasEstimateVideoPoints: true,
				hasPendingResourceDeferrals: true,
			}),
		).toEqual({
			canEstimate: false,
			blockedReason: "pending_resource_deferrals",
		})
	})
})
