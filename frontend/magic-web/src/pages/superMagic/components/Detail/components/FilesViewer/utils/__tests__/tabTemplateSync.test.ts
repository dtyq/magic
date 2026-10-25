import { describe, expect, it } from "vitest"
import type { FileItem, TabItem } from "../../types"
import { convertFileToTabItem, mergeAttachmentFileForTab } from "../tabUtils"

function createTab(displayType: string): TabItem {
	return {
		id: "root",
		title: "PPT-template",
		active: true,
		closeable: true,
		fileData: {
			file_id: "root",
			file_name: "PPT-template",
			is_directory: true,
			display_config: { type: displayType },
		},
	}
}

describe("template tab attachment sync", () => {
	it("keeps the template root as a slide-template tab", () => {
		const root: FileItem = {
			file_id: "root",
			file_name: "PPT-template",
			relative_file_path: "PPT-template",
			is_directory: true,
			display_config: { type: "slide-template", source: "project-template" },
		}

		expect(convertFileToTabItem(root, [root])).toMatchObject({
			id: "root",
			filePath: "PPT-template",
			display_config: { type: "slide-template", source: "project-template" },
		})
	})

	it("keeps template child files as independent tabs", () => {
		const root = {
			file_id: "root",
			file_name: "PPT-template",
			relative_file_path: "PPT-template",
			is_directory: true,
			children: [
				{ file_id: "manifest", file_name: "template.json", is_directory: false },
				{ file_id: "spec", file_name: "visual-spec.md", is_directory: false },
				{ file_id: "theme", file_name: "theme.css", is_directory: false },
				{
					file_id: "slides",
					file_name: "slides",
					is_directory: true,
					relative_file_path: "PPT-template/slides",
					children: [
						{
							file_id: "slide-1",
							file_name: "01-封面.html",
							is_directory: false,
							parent_id: "slides",
							relative_file_path: "PPT-template/slides/01-封面.html",
						},
					],
				},
			],
		}

		const tab = convertFileToTabItem(root.children?.[3].children?.[0] || {}, [root])

		expect(tab).toMatchObject({
			id: "slide-1",
			filePath: "PPT-template/slides/01-封面.html",
			fileData: {
				file_id: "slide-1",
			},
		})
	})

	it("keeps slide-template metadata when the attachment tree has no display_config", () => {
		const updatedFile: FileItem = {
			file_id: "root",
			file_name: "PPT-template",
			is_directory: true,
			children: [],
		}

		expect(mergeAttachmentFileForTab(createTab("slide-template"), updatedFile)).toMatchObject({
			children: [],
			display_config: { type: "slide-template" },
		})
	})

	it("keeps HTML navigation context when the attachment tree refreshes", () => {
		const updatedFile: FileItem = {
			file_id: "detail",
			file_name: "detail.html",
			relative_file_path: "detail.html",
		}
		const tab = {
			...createTab("html"),
			id: "detail",
			title: "detail.html",
			fileData: {
				file_id: "detail",
				file_name: "detail.html",
				htmlNavigation: {
					filePath: "detail.html",
					search: "?mode=edit",
					hash: "#section",
					anchor: "section",
				},
			},
		}

		expect(mergeAttachmentFileForTab(tab, updatedFile).htmlNavigation).toEqual({
			filePath: "detail.html",
			search: "?mode=edit",
			hash: "#section",
			anchor: "section",
		})
	})

	it("uses the latest attachment metadata for persistent render types", () => {
		const updatedFile: FileItem = {
			file_id: "root",
			file_name: "Deck",
			is_directory: true,
			display_config: { type: "slide", name: "Updated deck" },
		}

		expect(mergeAttachmentFileForTab(createTab("slide"), updatedFile).display_config).toEqual(
			updatedFile.display_config,
		)
	})
})
