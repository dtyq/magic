import { describe, expect, it } from "vitest"
import {
	calculateDefaultOpenFileId,
	canSetAsDefault,
	findFirstDefaultOpenFileInFolder,
} from "../utils"

function createTemplateRoot(overrides: Record<string, unknown> = {}) {
	return {
		file_id: "template-root",
		file_name: "产品发布模板",
		is_directory: true,
		children: [
			{ file_id: "template-json", file_name: "template.json", is_directory: false },
			{ file_id: "spec", file_name: "visual-spec.md", is_directory: false },
			{ file_id: "theme", file_name: "theme.css", is_directory: false },
			{
				file_id: "slides",
				file_name: "slides",
				is_directory: true,
				children: [
					{
						file_id: "slide-1",
						file_name: "cover.html",
						file_extension: "html",
						is_directory: false,
					},
				],
			},
			{
				file_id: "previews",
				file_name: "previews",
				is_directory: true,
				children: [
					{
						file_id: "thumb",
						file_name: "thumbnail.png",
						file_extension: "png",
						is_directory: false,
					},
				],
			},
		],
		...overrides,
	}
}

describe("calculateDefaultOpenFileId template priority", () => {
	it("prefers the template root over nested html pages", () => {
		const templateRoot = createTemplateRoot()
		const selectedIds = [
			"template-root",
			"template-json",
			"spec",
			"theme",
			"slides",
			"slide-1",
			"previews",
			"thumb",
		]

		expect(calculateDefaultOpenFileId(selectedIds, [templateRoot])).toBe("template-root")
	})

	it("prefers slide project folders over nested html pages", () => {
		const deck = {
			file_id: "deck-folder",
			file_name: "Deck",
			is_directory: true,
			display_config: { type: "slide" },
			children: [
				{
					file_id: "index-html",
					file_name: "index.html",
					file_extension: "html",
					is_directory: false,
				},
			],
		}

		expect(calculateDefaultOpenFileId(["deck-folder", "index-html"], [deck])).toBe(
			"deck-folder",
		)
	})

	it("allows setting a structural template root as the default open target", () => {
		expect(canSetAsDefault(createTemplateRoot())).toBe(true)
		expect(canSetAsDefault({ file_id: "plain", is_directory: true, children: [] })).toBe(false)
	})

	it("returns the template root itself from findFirstDefaultOpenFileInFolder", () => {
		expect(findFirstDefaultOpenFileInFolder(createTemplateRoot())).toBe("template-root")
	})
})
