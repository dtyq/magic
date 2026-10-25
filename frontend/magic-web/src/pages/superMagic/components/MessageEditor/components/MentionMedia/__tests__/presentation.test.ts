import { describe, expect, it } from "vitest"
import {
	DEFAULT_FILE_MENTION_RENDER_CONFIG,
	getFileMentionRenderType,
	isFileMentionFeatureEnabled,
} from "../fileMentionRenderConfig"

describe("file mention render config", () => {
	it("enables image and video independently for icon and tooltip", () => {
		for (const mediaType of ["image", "video"] as const) {
			expect(
				isFileMentionFeatureEnabled("icon", mediaType, DEFAULT_FILE_MENTION_RENDER_CONFIG),
			).toBe(true)
			expect(
				isFileMentionFeatureEnabled(
					"tooltip",
					mediaType,
					DEFAULT_FILE_MENTION_RENDER_CONFIG,
				),
			).toBe(true)
		}
	})

	it("keeps audio and other files out of the current icon and tooltip config", () => {
		expect(
			isFileMentionFeatureEnabled("icon", "audio", DEFAULT_FILE_MENTION_RENDER_CONFIG),
		).toBe(false)
		expect(
			isFileMentionFeatureEnabled("tooltip", "audio", DEFAULT_FILE_MENTION_RENDER_CONFIG),
		).toBe(false)
		expect(
			isFileMentionFeatureEnabled("icon", "other", DEFAULT_FILE_MENTION_RENDER_CONFIG),
		).toBe(false)
	})

	it("supports extending icon and tooltip types separately", () => {
		const config = {
			icon: ["image", "video", "audio"] as const,
			tooltip: ["video"] as const,
		}

		expect(isFileMentionFeatureEnabled("icon", "audio", config)).toBe(true)
		expect(isFileMentionFeatureEnabled("tooltip", "audio", config)).toBe(false)
		expect(isFileMentionFeatureEnabled("tooltip", "video", config)).toBe(true)
		expect(getFileMentionRenderType(null)).toBe("other")
	})
})
