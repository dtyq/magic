import { describe, expect, it } from "vitest"
import { getPromptRichTextPlainText } from "../../panels/promptRichText"
import { OptionViewType, SkillPanelType, type FieldPanelConfig } from "../../panels/types"
import { TemplatePanelStore } from "../TemplatePanelStore"

describe("TemplatePanelStore", () => {
	it("updates complex field value when a grid template is selected", () => {
		const config: FieldPanelConfig = {
			type: SkillPanelType.FIELD,
			field: {
				view_type: OptionViewType.GRID,
				items: [
					{
						data_key: "template",
						label: { default: "Template" },
						option_view_type: OptionViewType.GRID,
						options: [
							{
								value: { default: "poster" },
								label: { default: "Poster" },
							},
							{
								value: { default: "landing-page" },
								label: { default: "Landing Page" },
							},
						],
						preset_content: {
							default: "Use the {preset_value} template",
						},
					},
				],
			},
		}
		const store = new TemplatePanelStore()

		store.initialize(config)
		store.setSelectedTemplate({
			value: { default: "landing-page" },
			label: { default: "Landing Page" },
		})

		expect(store.complexField?.current_value).toBe("landing-page")
		expect(getPromptRichTextPlainText(store.concatenatedPresetContent)).toBe(
			"Use the landing-page template.",
		)
	})

	it("builds preset content for slide preset panels", () => {
		const config: FieldPanelConfig = {
			type: SkillPanelType.FIELD,
			field: {
				view_type: OptionViewType.SLIDES_PRESET,
				items: [
					{
						data_key: "style",
						label: { default: "Preset" },
						option_view_type: OptionViewType.GRID,
						options: [
							{
								value: "academic-research",
								label: "Academic Research",
								preview_url: "https://example.com/academic-preview",
							},
						],
						preset_content: {
							default: "Use PPT template: {preset_value}",
						},
					},
				],
			},
		}
		const store = new TemplatePanelStore()

		store.initialize(config)
		store.setSelectedTemplate({
			value: "academic-research",
			label: "Academic Research",
		})

		expect(store.complexField?.current_value).toBe("academic-research")
		expect(getPromptRichTextPlainText(store.concatenatedPresetContent)).toBe(
			"Use PPT template: academic-research.",
		)
	})
})
