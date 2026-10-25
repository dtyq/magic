import { describe, expect, it } from "vitest"
import { buildPreviewFile, resolvePublishedDefaultOpenFileId } from "../publishedMicroAppPreview"

describe("publishedMicroAppPreview", () => {
	it("reads the nested default open file id from share payloads", () => {
		expect(resolvePublishedDefaultOpenFileId({ default_open_file_id: "file-1" })).toBe("file-1")
		expect(
			resolvePublishedDefaultOpenFileId({
				data: { default_open_file_id: "file-2" },
			}),
		).toBe("file-2")
		expect(
			resolvePublishedDefaultOpenFileId({
				data: { data: { default_open_file_id: "file-3" } },
			}),
		).toBe("file-3")
		expect(resolvePublishedDefaultOpenFileId({})).toBeNull()
	})

	it("normalizes the html entry file for preview", () => {
		expect(
			buildPreviewFile({
				file_id: "file-1",
				filename: "index.html",
				file_extension: "html",
			}),
		).toMatchObject({
			file_id: "file-1",
			file_name: "index.html",
			file_extension: "html",
		})
	})
})
