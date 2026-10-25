import { describe, expect, it } from "vitest"
import { buildVideoProductionPresetContent } from "../videoProductionConfig"

describe("videoProductionConfig", () => {
	it("does not build a suffix for the default normal mode without other configuration", () => {
		expect(buildVideoProductionPresetContent({})).toBeUndefined()
		expect(
			buildVideoProductionPresetContent({
				generationMode: "普通",
				generationModeKey: "normal",
			}),
		).toBeUndefined()
	})

	it("builds the normal mode when another configuration is selected", () => {
		const payload = buildVideoProductionPresetContent({
			generationMode: "普通",
			generationModeKey: "normal",
			aspectRatio: "16:9",
			showAspectRatio: true,
			labels: { generationMode: "生成模式", aspectRatio: "画幅" },
		})

		expect(payload?.content?.[0]?.content?.[0]).toMatchObject({
			text: "生成模式: 普通; 画幅: 16:9.",
		})
	})

	it("builds a natural-language message suffix from stable config values", () => {
		const payload = buildVideoProductionPresetContent({
			generationMode: "normal",
			generationModeKey: "normal",
			aspectRatio: "16:9",
			durationSeconds: 5,
			resolution: "768p",
			showAspectRatio: true,
			showDuration: true,
			showResolution: true,
			labels: {
				generationMode: "生成模式",
				aspectRatio: "画幅",
				duration: "时长",
				resolution: "清晰度",
			},
		})

		expect(payload).toEqual({
			type: "doc",
			content: [
				{
					type: "paragraph",
					content: [
						{
							type: "text",
							text: "生成模式: normal; 画幅: 16:9; 时长: 5s; 清晰度: 768p.",
						},
					],
				},
			],
		})
	})

	it("builds detailed mode without requiring other configuration", () => {
		const payload = buildVideoProductionPresetContent({
			generationMode: "精细",
			generationModeKey: "detailed",
			labels: { generationMode: "生成模式" },
		})

		expect(payload?.content?.[0]?.content?.[0]).toMatchObject({
			text: "生成模式: 精细.",
		})
	})

	it("ignores blank and invalid optional values", () => {
		const payload = buildVideoProductionPresetContent({
			generationMode: "普通",
			generationModeKey: "normal",
			aspectRatio: "  ",
			durationSeconds: Number.NaN,
			resolution: "  ",
			showAspectRatio: true,
			showDuration: true,
			showResolution: true,
		})

		expect(payload).toBeUndefined()
	})
})
