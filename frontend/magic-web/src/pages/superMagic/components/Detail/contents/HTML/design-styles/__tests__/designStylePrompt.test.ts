import i18next from "i18next"
import { beforeAll, beforeEach, describe, expect, it } from "vitest"
import { MentionItemType } from "@/components/business/MentionPanel/types"
import enSuper from "@/assets/locales/en_US/super.json"
import zhSuper from "@/assets/locales/zh_CN/super.json"
import { buildDesignStylePromptContent } from "../designStylePrompt"
import { designStyleFixture } from "./fixtures"

describe("buildDesignStylePromptContent", () => {
	beforeAll(async () => {
		await i18next.init({
			lng: "en_US",
			fallbackLng: "en_US",
			ns: ["super"],
			defaultNS: "super",
			resources: {
				en_US: { super: enSuper },
				zh_CN: { super: zhSuper },
			},
		})
	})

	beforeEach(async () => {
		await i18next.changeLanguage("en_US")
	})

	it("includes the current HTML file mention and style code", () => {
		const style = designStyleFixture
		const result = buildDesignStylePromptContent(
			{
				fileId: "file-1",
				fileName: "index.html",
				filePath: "pages/index.html",
			},
			style,
		)
		const paragraphs = result.content ?? []
		const mention = paragraphs[1]?.content?.find((node) => node.type === "mention")

		expect(mention?.attrs).toMatchObject({
			type: MentionItemType.PROJECT_FILE,
			data: {
				file_id: "file-1",
				file_name: "index.html",
				file_path: "pages/index.html",
				file_extension: "html",
			},
		})
		expect(JSON.stringify(result)).toContain(`style_code: ${style.code}`)
		// Only dispatch information: skill, file, style. Rules stay in the skill.
		expect(paragraphs).toHaveLength(3)
		expect(paragraphs[0]?.content?.[0]?.text).toContain("html-design-style")
		expect(JSON.stringify(result)).not.toContain("Preserve the existing content")
	})

	it.each([
		{
			language: "en_US",
			skillPrompt: "Use the `html-design-style` skill to complete this task:",
			filePrompt: "Apply the specified design style to this HTML file: ",
			stylePrompt: 'Target style: "Fixture Style" (style_code: fixture-style).',
		},
		{
			language: "zh_CN",
			skillPrompt: "请使用 `html-design-style` skill 完成以下任务：",
			filePrompt: "将以下 HTML 文件应用为指定设计风格：",
			stylePrompt: "目标风格：「Fixture Style」（style_code: fixture-style）。",
		},
	])("uses the $language prompt", async ({ language, skillPrompt, filePrompt, stylePrompt }) => {
		await i18next.changeLanguage(language)
		const result = buildDesignStylePromptContent(
			{ fileId: "file-1", fileName: "index.html", filePath: "pages/index.html" },
			designStyleFixture,
		)

		expect(result.content?.[0]?.content?.[0]?.text).toBe(skillPrompt)
		expect(result.content?.[1]?.content?.[0]?.text).toBe(filePrompt)
		expect(result.content?.[2]?.content?.[0]?.text).toBe(stylePrompt)
	})

	it("rejects an incomplete file context", () => {
		expect(() =>
			buildDesignStylePromptContent(
				{ fileId: "", fileName: "index.html", filePath: "pages/index.html" },
				designStyleFixture,
			),
		).toThrow("HTML file context is incomplete")
	})
})
