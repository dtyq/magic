import { describe, expect, it } from "vitest"
import type { VideoModelItem } from "../../../../../../public/magic-types"
import {
	buildVideoAspectRatioOptions,
	buildVideoDurationOptions,
	buildVideoResolutionOptions,
	getVideoDurationConfig,
	intersectVideoGenerationConstraints,
	resolveDraftVideoGenerationConstraints,
	resolveVideoDefaultDuration,
	resolveRestoredVideoResolution,
} from "../video-editor-config.generation"

function createModel(generation: Record<string, unknown>): VideoModelItem {
	return {
		id: "model-id",
		group_id: "group-id",
		model_id: "model-id",
		model_name: "model",
		provider_model_id: "provider-model",
		model_description: "",
		model_icon: "",
		model_status: "normal" as VideoModelItem["model_status"],
		sort: 0,
		video_generation_config: { generation: generation as never },
	}
}

describe("buildVideoAspectRatioOptions", () => {
	it("dedupes sizes by label when no resolution is selected", () => {
		const model = createModel({
			default_resolution: "1080p",
			sizes: [
				{ label: "16:9", value: "1280x720", width: 1280, height: 720, resolution: "720p" },
				{
					label: "16:9",
					value: "1920x1080",
					width: 1920,
					height: 1080,
					resolution: "1080p",
				},
				{ label: "9:16", value: "720x1280", width: 720, height: 1280, resolution: "720p" },
				{
					label: "9:16",
					value: "1080x1920",
					width: 1080,
					height: 1920,
					resolution: "1080p",
				},
			],
		})

		const options = buildVideoAspectRatioOptions(model)

		expect(options.map((item) => item.value)).toEqual(["16:9", "9:16"])
		expect(options.find((item) => item.value === "16:9")).toMatchObject({
			originalValue: "1920x1080",
			originalScale: "1080p",
		})
	})

	it("keeps all sizes for the selected resolution", () => {
		const model = createModel({
			sizes: [
				{ label: "16:9", value: "1280x720", width: 1280, height: 720, resolution: "720p" },
				{
					label: "9:16",
					value: "1080x1920",
					width: 1080,
					height: 1920,
					resolution: "1080p",
				},
				{ label: "9:16", value: "720x1280", width: 720, height: 1280, resolution: "720p" },
			],
		})

		const options = buildVideoAspectRatioOptions(model, "720p")

		expect(options.map((item) => item.value)).toEqual(["16:9", "9:16"])
		expect(options.find((item) => item.value === "9:16")).toMatchObject({
			originalValue: "720x1280",
			originalScale: "720p",
		})
	})
})

describe("video generation duration configuration", () => {
	it("keeps discrete duration options", () => {
		const model = createModel({
			duration_type: "options",
			durations: [4, 5, 8],
			default_duration_seconds: 5,
		})

		expect(buildVideoDurationOptions(model)).toEqual([4, 5, 8])
		expect(getVideoDurationConfig(model)).toEqual({ type: "options" })
		expect(resolveVideoDefaultDuration(model)).toBe(5)
	})

	it("expands range values for validation while exposing range metadata", () => {
		const model = createModel({
			duration_type: "range",
			durations: { min: 4, max: 8, step: 2 },
			default_duration_seconds: 6,
		})

		expect(buildVideoDurationOptions(model)).toEqual([4, 6, 8])
		expect(getVideoDurationConfig(model)).toEqual({
			type: "range",
			range: { min: 4, max: 8, step: 2 },
		})
		expect(resolveVideoDefaultDuration(model)).toBe(6)
	})

	it("lets active mode constraints narrow a model range", () => {
		const model = createModel({
			duration_type: "range",
			durations: { min: 4, max: 12, step: 1 },
			default_duration_seconds: 10,
		})
		const constraints = { durations: [5, 7, 9] }

		expect(buildVideoDurationOptions(model, constraints)).toEqual([5, 7, 9])
		expect(getVideoDurationConfig(model, constraints)).toEqual({ type: "options" })
		expect(resolveVideoDefaultDuration(model, constraints)).toBe(9)
	})
})

describe("draft video generation constraints", () => {
	it("intersects the active mode with the fixed 480p draft capability", () => {
		const model = createModel({
			resolutions: ["480p", "720p", "1080p"],
			default_resolution: "1080p",
		})
		const constraints = intersectVideoGenerationConstraints(
			{ resolutions: ["480p", "1080p"], aspect_ratios: ["16:9", "9:16"] },
			resolveDraftVideoGenerationConstraints({
				resolutions: ["480p", "720p"],
				aspect_ratios: ["16:9"],
			}),
		)

		expect(constraints).toEqual({
			resolutions: ["480p"],
			aspect_ratios: ["16:9"],
		})
		expect(
			buildVideoResolutionOptions(model, constraints).map((option) => option.value),
		).toEqual(["480p"])
	})

	it("reports no draft resolution when the current mode excludes 480p", () => {
		const constraints = intersectVideoGenerationConstraints(
			{ resolutions: ["1080p"] },
			resolveDraftVideoGenerationConstraints(),
		)
		expect(constraints?.resolutions).toEqual([])
	})

	it("does not fall back to model resolutions when the mode size whitelist excludes 480p", () => {
		const model = createModel({
			resolutions: ["480p", "1080p"],
			sizes: [
				{ label: "16:9", value: "864x496", width: 864, height: 496, resolution: "480p" },
				{
					label: "16:9",
					value: "1920x1080",
					width: 1920,
					height: 1080,
					resolution: "1080p",
				},
			],
		})
		const constraints = intersectVideoGenerationConstraints(
			{
				sizes: [
					{
						label: "16:9",
						value: "1920x1080",
						width: 1920,
						height: 1080,
						resolution: "1080p",
					},
				],
			},
			resolveDraftVideoGenerationConstraints(),
		)

		expect(buildVideoResolutionOptions(model, constraints)).toEqual([])
	})

	it("restores the previous resolution before falling back to model defaults", () => {
		const model = createModel({
			resolutions: ["480p", "720p", "1080p"],
			default_resolution: "1080p",
		})
		const options = buildVideoResolutionOptions(model)
		expect(resolveRestoredVideoResolution(model, options, "720p")).toBe("720p")
		expect(resolveRestoredVideoResolution(model, options, "4k")).toBe("1080p")
	})
})
