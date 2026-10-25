import { describe, expect, it, vi } from "vitest"
import type { VideoInputModesMap, VideoModelItem } from "../../../../public/magic-types"
import type { Canvas } from "../../../core/Canvas"
import { resolveVideoContinuationModel } from "../videoContinuationModel"

function model(id: string, modes: VideoInputModesMap): VideoModelItem {
	return {
		id,
		group_id: "group",
		model_id: id,
		model_name: id,
		provider_model_id: id,
		model_description: "",
		model_icon: "",
		model_status: "normal",
		sort: 0,
		video_generation_config: { input_modes: modes },
	}
}

function canvas(defaultConfig: Record<string, unknown>): Canvas {
	return {
		magicConfigManager: {
			config: {
				methods: {
					getRootStorage: vi.fn(() => ({ defaultGenerateVideoConfig: defaultConfig })),
				},
			},
		},
	} as unknown as Canvas
}

describe("resolveVideoContinuationModel", () => {
	it("keeps the default model and mode when both support a start frame", () => {
		const current = model("default", {
			omni_reference: {
				supported_fields: ["frames"],
				frame_roles: ["start"],
				task: "edit",
			},
			keyframe_guided: { supported_fields: ["frames"], frame_roles: ["start"] },
		})

		expect(
			resolveVideoContinuationModel(
				canvas({ model_id: "default", input_mode: "omni_reference" }),
				[current],
			),
		).toMatchObject({ model: current, inputMode: "omni_reference", task: "edit" })
	})

	it("prefers keyframe mode before falling back to the first compatible model", () => {
		const unsupportedDefault = model("default", {
			standard: { supported_fields: [] },
		})
		const fallback = model("fallback", {
			image_reference: { supported_fields: ["frames"], frame_roles: ["start"] },
			keyframe_guided: { supported_fields: ["frames"], frame_roles: ["start"] },
		})

		expect(
			resolveVideoContinuationModel(
				canvas({ model_id: "default", input_mode: "standard", task: "generate" }),
				[unsupportedDefault, fallback],
			),
		).toMatchObject({ model: fallback, inputMode: "keyframe_guided", task: "generate" })
	})

	it("returns null when no input mode supports start frames", () => {
		expect(
			resolveVideoContinuationModel(canvas({}), [
				model("standard-only", { standard: { supported_fields: [] } }),
			]),
		).toBeNull()
	})
})
