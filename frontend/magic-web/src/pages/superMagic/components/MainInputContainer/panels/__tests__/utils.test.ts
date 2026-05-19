import { describe, expect, it } from "vitest"
import { getPromptRichTextPlainText, serializePromptRichTextLocaleValue } from "../promptRichText"
import { buildConcatenatedPresetContent } from "../utils"
import type { FieldItem } from "../types"

function expectPresetContentText(fields: FieldItem[], locale: string, expected: string) {
	expect(getPromptRichTextPlainText(buildConcatenatedPresetContent(fields, locale))).toBe(
		expected,
	)
}

describe("MainInputContainer panel utils", () => {
	it("builds mixed preset content per field instead of switching logic for the whole list", () => {
		const fields: FieldItem[] = [
			{
				data_key: "style",
				label: { default: "Style" },
				current_value: "Oil painting",
				options: [],
				preset_content: { default: "Style: {preset_value}" },
			},
			{
				data_key: "lighting",
				label: { default: "Lighting" },
				current_value: "soft",
				options: [
					{
						value: { default: "soft", en_US: "soft" },
					},
				],
			},
			{
				data_key: "camera",
				label: { default: "Camera" },
				current_value: "close-up",
				options: [
					{
						value: { default: "close-up", en_US: "close-up" },
					},
				],
			},
			{
				data_key: "mood",
				label: { default: "Mood" },
				current_value: "calm",
				options: [],
				preset_content: { default: "Mood: {preset_value}" },
			},
		]

		expectPresetContentText(
			fields,
			"en_US",
			"Style: Oil painting, Lighting: soft, Camera: close-up, Mood: calm.",
		)
	})

	it("keeps the original fallback sentence when no field has preset_content", () => {
		const fields: FieldItem[] = [
			{
				data_key: "lighting",
				label: { default: "Lighting" },
				current_value: "soft",
				options: [
					{
						value: { default: "soft", en_US: "soft" },
					},
				],
			},
			{
				data_key: "camera",
				label: { default: "Camera" },
				current_value: "close-up",
				options: [
					{
						value: { default: "close-up", en_US: "close-up" },
					},
				],
			},
		]

		expectPresetContentText(fields, "en_US", "Lighting: soft, Camera: close-up.")
	})

	it("skips fields with preset_content when current_value is undefined", () => {
		const fields: FieldItem[] = [
			{
				data_key: "style",
				label: { default: "Style" },
				options: [],
				preset_content: { default: "Style: {preset_value}" },
			},
			{
				data_key: "lighting",
				label: { default: "Lighting" },
				current_value: "soft",
				options: [
					{
						value: { default: "soft", en_US: "soft" },
					},
				],
			},
		]

		expectPresetContentText(fields, "en_US", "Lighting: soft.")
	})

	it("keeps prompt rich text preset_content as JSON while replacing preset value", () => {
		const fields: FieldItem[] = [
			{
				data_key: "style",
				label: { default: "Style" },
				current_value: "Oil painting",
				options: [],
				preset_content: {
					default: serializePromptRichTextLocaleValue({
						type: "doc",
						content: [
							{
								type: "paragraph",
								content: [
									{ type: "text", text: "Style: " },
									{ type: "promptPresetValue" },
								],
							},
						],
					}),
				},
			},
		]

		const content = buildConcatenatedPresetContent(fields, "en_US")

		expect(content).toEqual({
			type: "doc",
			content: [
				{
					type: "paragraph",
					content: [
						{ type: "text", text: "Style: " },
						{ type: "text", text: "Oil painting" },
						{ type: "text", text: "." },
					],
				},
			],
		})
	})

	it("preserves rich text mention nodes in preset_content", () => {
		const fields: FieldItem[] = [
			{
				data_key: "style",
				label: { default: "Style" },
				current_value: "Oil painting",
				options: [],
				preset_content: {
					default: serializePromptRichTextLocaleValue({
						type: "doc",
						content: [
							{
								type: "paragraph",
								content: [
									{
										type: "mention",
										attrs: {
											type: "skill",
											data: {
												id: "skill-1",
												name: "Render",
											},
										},
									},
									{ type: "text", text: " with " },
									{ type: "promptPresetValue" },
								],
							},
						],
					}),
				},
			},
		]

		const content = buildConcatenatedPresetContent(fields, "en_US")

		expect(content?.content?.[0].content?.[0]).toMatchObject({
			type: "mention",
			attrs: {
				type: "skill",
				data: {
					id: "skill-1",
					name: "Render",
				},
			},
		})
		expect(getPromptRichTextPlainText(content)).toBe("@Render with Oil painting.")
	})
})
