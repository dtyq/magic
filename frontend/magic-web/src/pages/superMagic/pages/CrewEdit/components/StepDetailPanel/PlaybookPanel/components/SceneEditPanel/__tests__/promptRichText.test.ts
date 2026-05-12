import { describe, expect, it } from "vitest"
import { MentionItemType } from "@/components/business/MentionPanel/types"
import {
	getPromptRichTextPlainText,
	isPromptRichTextEmpty,
	parsePromptRichText,
	PROMPT_PRESET_VALUE_NODE_NAME,
	PROMPT_PRESET_VALUE_TOKEN,
	serializePromptRichTextLocaleValue,
} from "@/pages/superMagic/components/MainInputContainer/panels/promptRichText"

describe("promptRichText", () => {
	it("parses legacy plain text into a doc", () => {
		expect(parsePromptRichText("hello\nworld")).toEqual({
			type: "doc",
			content: [
				{ type: "paragraph", content: [{ type: "text", text: "hello" }] },
				{ type: "paragraph", content: [{ type: "text", text: "world" }] },
			],
		})
	})

	it("extracts plain text from rich prompt content", () => {
		const value = JSON.stringify({
			type: "doc",
			content: [
				{
					type: "paragraph",
					content: [
						{ type: "text", text: "Run " },
						{
							type: "mention",
							attrs: {
								type: MentionItemType.SKILL,
								data: {
									id: "skill-1",
									name: "Image Skill",
									icon: "",
									description: "",
								},
							},
						},
						{ type: "text", text: " with " },
						{ type: PROMPT_PRESET_VALUE_NODE_NAME },
					],
				},
			],
		})

		expect(getPromptRichTextPlainText(value)).toBe(
			`Run @Image Skill with ${PROMPT_PRESET_VALUE_TOKEN}`,
		)
	})

	it("treats whitespace-only docs as empty", () => {
		expect(
			isPromptRichTextEmpty(
				JSON.stringify({
					type: "doc",
					content: [
						{ type: "paragraph", content: [{ type: "text", text: "   \u200b" }] },
					],
				}),
			),
		).toBe(true)
	})

	it("keeps mention and preset nodes as meaningful content", () => {
		expect(
			isPromptRichTextEmpty({
				type: "doc",
				content: [
					{
						type: "paragraph",
						content: [{ type: PROMPT_PRESET_VALUE_NODE_NAME }],
					},
				],
			}),
		).toBe(false)
	})

	it("serializes empty locale values back to blank strings", () => {
		expect(
			serializePromptRichTextLocaleValue({
				type: "doc",
				content: [{ type: "paragraph" }],
			}),
		).toBe("")
	})
})
