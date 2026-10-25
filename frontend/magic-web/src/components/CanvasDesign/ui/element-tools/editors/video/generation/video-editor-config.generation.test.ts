import { describe, expect, it } from "vitest"
import type { VideoModelItem } from "../../../../../public/magic-types"
import { buildVideoDurationOptions } from "./video-editor-config.generation"

const model = (durations: unknown): VideoModelItem =>
	({
		id: "model-1",
		group_id: "group-1",
		model_id: "model-1",
		model_name: "Model",
		provider_model_id: "provider-model-1",
		model_description: "",
		model_icon: "",
		model_status: "active",
		sort: 0,
		video_generation_config: {
			generation: { durations },
		},
	}) as VideoModelItem

describe("buildVideoDurationOptions", () => {
	it("ignores malformed top-level durations instead of throwing", () => {
		expect(buildVideoDurationOptions(model({ min: 3, max: 10 }))).toEqual([])
	})

	it("filters valid constrained durations against the model options", () => {
		expect(
			buildVideoDurationOptions(model([3, 5, "8", Number.NaN]), { durations: [5, 8] }),
		).toEqual([5])
	})
})
