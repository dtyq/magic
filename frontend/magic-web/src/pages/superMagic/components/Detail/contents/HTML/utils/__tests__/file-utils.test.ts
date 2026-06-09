import { describe, expect, it } from "vitest"
import {
	findAttachmentByFileId,
	findDirectoryByRelativePath,
	getHtmlDirectoryPath,
	resolveHtmlRelativePath,
	resolveUploadPath,
} from "../file-utils"

describe("HTML file utils", () => {
	it("resolves external image drops into the current html images folder", () => {
		expect(resolveUploadPath("./images/picture.png", "reports/demo/index.html")).toBe(
			"reports/demo/images/picture.png",
		)
		expect(resolveUploadPath("./images/picture.png", "reports/demo/")).toBe(
			"reports/demo/images/picture.png",
		)
	})

	it("returns an html-relative path for saved images in the current folder", () => {
		expect(
			resolveHtmlRelativePath("reports/demo/images/picture.png", "reports/demo/index.html"),
		).toBe("./images/picture.png")
		expect(resolveHtmlRelativePath("reports/demo/images/picture.png", "reports/demo/")).toBe(
			"./images/picture.png",
		)
	})

	it("normalizes current html directory from file or directory input", () => {
		expect(getHtmlDirectoryPath("reports/demo/index.html")).toBe("reports/demo/")
		expect(getHtmlDirectoryPath("reports/demo/")).toBe("reports/demo/")
		expect(getHtmlDirectoryPath("index.html")).toBe("")
	})

	it("finds attachments recursively by file id and directory path", () => {
		const attachments = [
			{
				file_id: "root-dir",
				file_name: "reports",
				relative_file_path: "reports",
				is_directory: true,
				children: [
					{
						file_id: "demo-dir",
						file_name: "demo",
						relative_file_path: "reports/demo",
						is_directory: true,
						children: [
							{
								file_id: "html-1",
								file_name: "index.html",
								relative_file_path: "reports/demo/index.html",
								parent_id: "demo-dir",
								is_directory: false,
							},
						],
					},
				],
			},
		]

		expect(findAttachmentByFileId(attachments, "html-1")?.relative_file_path).toBe(
			"reports/demo/index.html",
		)
		expect(findDirectoryByRelativePath(attachments, "reports/demo")?.file_id).toBe("demo-dir")
	})
})
