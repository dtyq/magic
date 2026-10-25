import { beforeEach, describe, expect, it, vi } from "vitest"
import { buildSingleFileDownloadMenu } from "../build-single-file-download-menu"

const handlers = {
	handleDownloadOriginal: vi.fn(),
	handleDownloadPdf: vi.fn(),
	handleDownloadPpt: vi.fn(),
	handleDownloadPptx: vi.fn(),
}

const t = (key: string) => key

describe("buildSingleFileDownloadMenu", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it.each(["html", "md", "markdown"])(
		"uses only the default dependency-aware download entry for %s files",
		(extension) => {
			const menuItems = buildSingleFileDownloadMenu({
				item: {
					file_id: `document-${extension}`,
					file_name: `document.${extension}`,
					file_extension: extension,
					is_directory: false,
				},
				handlers,
				t: t as never,
			})

			expect(menuItems.some((entry) => entry.key === "downloadWithDependencies")).toBe(false)
			menuItems.find((entry) => entry.key === "downloadOriginal")?.onClick?.()
			expect(handlers.handleDownloadOriginal).toHaveBeenCalled()
		},
	)

	it("keeps the slide folder context when exporting a multi-page PPTX", () => {
		const entryFile = {
			file_id: "entry-file",
			file_name: "index.html",
			file_extension: "html",
			is_directory: false,
		}
		const slideFile = {
			file_id: "slide-file",
			file_name: "slide-1.html",
			file_extension: "html",
			is_directory: false,
		}
		const children = [entryFile, slideFile]
		const slideFolder = {
			file_id: "slide-folder",
			file_name: "Quarterly report",
			is_directory: true,
			display_config: {
				type: "slide",
				slides: ["slide-1.html"],
			},
			children,
		}

		const menuItems = buildSingleFileDownloadMenu({
			item: slideFolder,
			handlers,
			t: t as never,
		})

		menuItems.find((entry) => entry.key === "downloadPptx")?.onClick?.()

		expect(handlers.handleDownloadPptx).toHaveBeenCalledWith(slideFolder, children)
	})
})
