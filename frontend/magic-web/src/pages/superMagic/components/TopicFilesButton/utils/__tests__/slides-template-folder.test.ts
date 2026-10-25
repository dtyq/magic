import { describe, expect, it } from "vitest"
import type { AttachmentItem } from "../../hooks/types"
import { isConvertiblePresentationFile, isSlidesTemplateFolder } from "../slides-template-folder"

function createStandardTemplate(overrides: Partial<AttachmentItem> = {}): AttachmentItem {
	return {
		file_id: "template-folder",
		name: "Quarterly template",
		is_directory: true,
		children: [
			{ name: "template.json", is_directory: false },
			{ name: "visual-spec.md", is_directory: false },
			{ name: "theme.css", is_directory: false },
			{ name: "slides", is_directory: true, children: [] },
		],
		...overrides,
	}
}

describe("isSlidesTemplateFolder", () => {
	it("recognizes the standard direct-child structure", () => {
		expect(isSlidesTemplateFolder(createStandardTemplate())).toBe(true)
	})

	it.each(["template.json", "visual-spec.md", "theme.css", "slides"])(
		"rejects a folder missing %s",
		(missingName) => {
			const item = createStandardTemplate()
			item.children = item.children?.filter((child) => child.name !== missingName)

			expect(isSlidesTemplateFolder(item)).toBe(false)
		},
	)

	it("rejects slides when it is a file", () => {
		const item = createStandardTemplate()
		const slides = item.children?.find((child) => child.name === "slides")
		if (slides) slides.is_directory = false

		expect(isSlidesTemplateFolder(item)).toBe(false)
	})

	it("does not recognize required files nested below direct children", () => {
		const item = createStandardTemplate({
			children: [
				{
					name: "metadata",
					is_directory: true,
					children: [
						{ name: "template.json", is_directory: false },
						{ name: "visual-spec.md", is_directory: false },
						{ name: "theme.css", is_directory: false },
					],
				},
				{ name: "slides", is_directory: true },
			],
		})

		expect(isSlidesTemplateFolder(item)).toBe(false)
	})

	it("does not mutate the original children array", () => {
		const item = createStandardTemplate()
		const originalChildren = item.children
		const originalNames = item.children?.map((child) => child.name)

		isSlidesTemplateFolder(item)

		expect(item.children).toBe(originalChildren)
		expect(item.children?.map((child) => child.name)).toEqual(originalNames)
	})
})

describe("isConvertiblePresentationFile", () => {
	it.each(["ppt", "pptx", "potx", ".PPTX"])("recognizes %s via file_extension", (extension) => {
		expect(
			isConvertiblePresentationFile({
				file_id: "deck-1",
				name: "deck",
				file_extension: extension,
				is_directory: false,
			}),
		).toBe(true)
	})

	it.each(["deck.ppt", "deck.pptx", "templates/brand.potx"])(
		"recognizes %s via file name when extension is missing",
		(name) => {
			expect(
				isConvertiblePresentationFile({
					file_id: "deck-1",
					name,
					is_directory: false,
				}),
			).toBe(true)
		},
	)

	it("rejects directories and other file types", () => {
		expect(
			isConvertiblePresentationFile({
				file_id: "folder-1",
				name: "deck.pptx",
				is_directory: true,
			}),
		).toBe(false)
		expect(
			isConvertiblePresentationFile({
				file_id: "notes-1",
				name: "notes.txt",
				file_extension: "txt",
				is_directory: false,
			}),
		).toBe(false)
		expect(isConvertiblePresentationFile(undefined)).toBe(false)
	})
})
