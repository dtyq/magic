import { describe, expect, it } from "vitest"
import type { VideoInputModeConfig, VideoModelItem } from "../../../../../public/magic-types"
import {
	canAddReferenceAsset,
	canReplaceReferenceAssetByCounts,
	resolveReferenceAssetLimits,
	validateReferenceAssetsByLimits,
	resolveSelectableInputModeForAvailableModes,
	resolveVideoReferenceVideoModel,
} from "../model-config/video-editor-config.model"

function createVideoModel(
	modelId: string,
	inputModes: Partial<Record<string, VideoInputModeConfig>>,
): VideoModelItem {
	return {
		id: modelId,
		group_id: modelId,
		model_id: modelId,
		model_name: modelId,
		provider_model_id: modelId,
		model_description: "",
		model_icon: "",
		model_status: "normal",
		sort: 0,
		video_generation_config: {
			input_modes: inputModes,
		} as VideoModelItem["video_generation_config"],
	}
}

describe("resolveSelectableInputModeForAvailableModes", () => {
	it("moves the transient standard mode to omni reference when that tab is available", () => {
		expect(
			resolveSelectableInputModeForAvailableModes(
				["standard", "omni_reference", "image_reference"],
				"standard",
			),
		).toBe("omni_reference")
	})

	it("uses the normal fallback order when omni reference is unavailable", () => {
		expect(
			resolveSelectableInputModeForAvailableModes(
				["standard", "keyframe_guided", "image_reference"],
				"standard",
			),
		).toBe("keyframe_guided")
	})

	it("preserves a selected non-standard mode", () => {
		expect(
			resolveSelectableInputModeForAvailableModes(
				["standard", "omni_reference", "image_reference"],
				"image_reference",
			),
		).toBe("image_reference")
	})

	it("keeps standard when it is the only available mode", () => {
		expect(resolveSelectableInputModeForAvailableModes(["standard"], "standard")).toBe(
			"standard",
		)
	})
})

describe("resolveVideoReferenceVideoModel", () => {
	it("prefers the current model when it supports reference videos", () => {
		const currentModel = createVideoModel("current", {
			omni_reference: {
				supported_fields: ["reference_videos"],
				task: "edit",
			},
		})
		const fallbackModel = createVideoModel("fallback", {
			video_edit: { supported_fields: ["reference_videos"] },
		})

		expect(
			resolveVideoReferenceVideoModel([fallbackModel, currentModel], "current"),
		).toMatchObject({
			model: currentModel,
			inputMode: "omni_reference",
			task: "edit",
			maxReferenceVideos: Infinity,
		})
	})

	it("uses the configured mode order within a model", () => {
		const model = createVideoModel("model", {
			omni_reference: { supported_fields: ["reference_videos"] },
			video_edit: { supported_fields: ["reference_videos"] },
		})

		expect(resolveVideoReferenceVideoModel([model])).toMatchObject({
			inputMode: "omni_reference",
		})
	})

	it("falls back to the first supported model", () => {
		const unsupportedModel = createVideoModel("unsupported", {
			standard: { supported_fields: [] },
		})
		const supportedModel = createVideoModel("supported", {
			omni_reference: {
				supported_fields: ["reference_videos"],
				max_count: 2,
			},
		})

		expect(resolveVideoReferenceVideoModel([unsupportedModel, supportedModel])).toMatchObject({
			model: supportedModel,
			maxReferenceVideos: 2,
		})
	})

	it("returns null when reference videos are unsupported or unavailable", () => {
		const unsupportedModel = createVideoModel("unsupported", {
			video_edit: { supported_fields: ["reference_images"] },
		})
		const zeroLimitModel = createVideoModel("zero", {
			video_edit: {
				supported_fields: ["reference_videos"],
				variants: [{ code: "no-video", limits: { reference_videos: { max: 0 } } }],
			},
		})
		const minimumTwoModel = createVideoModel("minimum-two", {
			video_edit: {
				supported_fields: ["reference_videos"],
				variants: [{ code: "two-videos", limits: { reference_videos: { min: 2 } } }],
			},
		})
		const requiresImageModel = createVideoModel("requires-image", {
			video_edit: {
				supported_fields: ["reference_images", "reference_videos"],
				variants: [
					{
						code: "image-and-video",
						limits: { reference_images: { min: 1 }, reference_videos: { min: 1 } },
					},
				],
			},
		})

		expect(resolveVideoReferenceVideoModel([unsupportedModel])).toBeNull()
		expect(resolveVideoReferenceVideoModel([zeroLimitModel])).toBeNull()
		expect(resolveVideoReferenceVideoModel([minimumTwoModel])).toBeNull()
		expect(resolveVideoReferenceVideoModel([requiresImageModel])).toBeNull()
	})
})

describe("omni reference asset limits", () => {
	it("uses max_count as a per-type fallback without applying it as a total cap", () => {
		const config: VideoInputModeConfig = {
			supported_fields: ["reference_images", "reference_videos", "reference_audios"],
			max_count: 2,
			reference_images: { max_count: 1 },
		}
		const assets = [{ assetType: "image" as const }, { assetType: "video" as const }]
		const limits = resolveReferenceAssetLimits(config, assets, {
			ignoreModeMaxCountForTotal: true,
		})
		expect(limits.reference_images.max).toBe(1)
		expect(limits.reference_videos.max).toBe(2)
		expect(limits.reference_audios.max).toBe(2)
		expect(limits.total.max).toBe(5)
		expect(
			canAddReferenceAsset(config, assets, "audio", {
				ignoreModeMaxCountForTotal: true,
			}),
		).toBe(true)
	})

	it("requires a variant minimum at submit time but does not delete the draft", () => {
		const config: VideoInputModeConfig = {
			supported_fields: ["reference_images", "reference_videos"],
			variants: [
				{
					code: "image-and-video",
					limits: { reference_images: { min: 1 }, reference_videos: { min: 1 } },
				},
			],
		}
		const assets = [{ assetType: "image" as const }]
		expect(
			validateReferenceAssetsByLimits(config, assets, {
				ignoreModeMaxCountForTotal: true,
			}).some((issue) => issue.reason === "variant"),
		).toBe(true)
	})

	it("validates replacement after removing the old asset from the counts", () => {
		const config: VideoInputModeConfig = {
			supported_fields: ["reference_images", "reference_videos"],
			variants: [
				{
					code: "image-and-video",
					limits: {
						reference_images: { min: 1, max: 1 },
						reference_videos: { min: 1, max: 1 },
					},
				},
			],
		}

		expect(
			canReplaceReferenceAssetByCounts(
				config,
				{ images: 1, videos: 1, audios: 0 },
				"image",
				"image",
			),
		).toBe(true)
		expect(
			canReplaceReferenceAssetByCounts(
				config,
				{ images: 1, videos: 1, audios: 0 },
				"image",
				"video",
			),
		).toBe(false)
	})

	it("rejects replacement that would exceed effective limits", () => {
		const config: VideoInputModeConfig = {
			supported_fields: ["reference_images"],
			reference_images: { max_count: 2 },
		}

		expect(
			canReplaceReferenceAssetByCounts(
				config,
				{ images: 3, videos: 0, audios: 0 },
				"image",
				"image",
			),
		).toBe(false)
	})

	it("allows replacing an asset while a variant minimum is still incomplete", () => {
		const config: VideoInputModeConfig = {
			supported_fields: ["reference_images", "reference_videos"],
			variants: [
				{
					code: "image-and-video",
					limits: {
						reference_images: { min: 1, max: 1 },
						reference_videos: { min: 1, max: 1 },
					},
				},
			],
		}

		expect(
			canReplaceReferenceAssetByCounts(
				config,
				{ images: 1, videos: 0, audios: 0 },
				"image",
				"image",
			),
		).toBe(true)
	})
})
