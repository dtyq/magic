import { describe, expect, it, vi } from "vitest"
import { buildMobileFilePreviewDetail } from "./mobileFilePreview"

vi.mock("@/pages/superMagic/utils/handleFIle", () => ({
	getFileType: (extension: string) => {
		if (extension === "html") return "html"
		if (extension === "txt") return "text"
		return "notSupport"
	},
}))

describe("buildMobileFilePreviewDetail", () => {
	it("opens from message metadata when the project attachment list is not ready", () => {
		const detail = buildMobileFilePreviewDetail(
			{
				file_id: "mock-message-file",
				file_name: "mock-document.html",
				file_extension: "html",
			},
			[],
		)

		expect(detail).toMatchObject({
			type: "html",
			currentFileId: "mock-message-file",
			data: {
				file_id: "mock-message-file",
				file_name: "mock-document.html",
				file_extension: "html",
			},
		})
	})

	it("uses project metadata when the matching attachment is already loaded", () => {
		const detail = buildMobileFilePreviewDetail(
			{
				file_id: "mock-message-file",
				file_name: "mock-message-name.html",
				file_extension: "html",
			},
			[
				{
					file_id: "mock-message-file",
					file_name: "mock-project-name.html",
					file_extension: "html",
					relative_file_path: "mock-folder/mock-project-name.html",
					display_config: { type: "mock-renderer" },
				},
			],
		)

		expect(detail?.data).toMatchObject({
			file_name: "mock-project-name.html",
			relative_file_path: "mock-folder/mock-project-name.html",
			display_config: { type: "mock-renderer" },
		})
	})

	it("infers the extension from the message filename", () => {
		const detail = buildMobileFilePreviewDetail(
			{ file_id: "mock-text-file", file_name: "mock-notes.txt" },
			[],
		)

		expect(detail).toMatchObject({
			type: "text",
			data: { file_extension: "txt" },
		})
	})

	it("returns no detail when the clicked item has no file identifier", () => {
		expect(buildMobileFilePreviewDetail({ file_name: "mock-empty-file" }, [])).toBeNull()
	})
})
