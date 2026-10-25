import { describe, expect, it } from "vitest"
import type { AttachmentItem } from "../../hooks/types"
import { detectDuplicateFiles } from "../duplicateFileHandler"
import {
	detectDuplicateFilesInTarget,
	renameFilesForTargetUpload,
	stripTopLevelFolderFromFiles,
} from "../folderConflictHandler"

function createUploadFile(name: string, relativePath: string): File {
	const file = new File(["content"], name)
	Object.defineProperty(file, "webkitRelativePath", {
		value: relativePath,
		configurable: true,
	})
	return file
}

const attachments: AttachmentItem[] = [
	{
		file_id: "news-folder",
		file_name: "新闻报道",
		is_directory: true,
		children: [
			{
				file_id: "category-four",
				file_name: "分类4",
				is_directory: true,
				children: [
					{ file_id: "existing-four", file_name: "新建文件.md", is_directory: false },
				],
			},
			{
				file_id: "category-five",
				file_name: "分类五",
				is_directory: true,
				children: [
					{ file_id: "existing-five", file_name: "新建文件.md", is_directory: false },
				],
			},
			{ file_id: "existing-root", file_name: "新建文件.md", is_directory: false },
		],
	},
]

describe("folder merge duplicate paths", () => {
	it("keeps regular folder uploads matched relative to their target folder", () => {
		const files = [createUploadFile("新建文件.md", "新闻报道/新建文件.md")]
		const duplicates = detectDuplicateFiles(files, "新闻报道", attachments)

		expect(Array.from(duplicates.keys())).toEqual(["新建文件.md"])
	})

	it("detects root and nested duplicates after removing the uploaded root folder", () => {
		const files = stripTopLevelFolderFromFiles([
			createUploadFile("新建文件.md", "新闻报道/新建文件.md"),
			createUploadFile("新建文件.md", "新闻报道/分类4/新建文件.md"),
			createUploadFile("新建文件.md", "新闻报道/分类五/新建文件.md"),
		])

		const duplicates = detectDuplicateFilesInTarget(files, "news-folder", attachments)

		expect(Array.from(duplicates.keys())).toEqual([
			"新建文件.md",
			"分类4/新建文件.md",
			"分类五/新建文件.md",
		])
	})

	it("renames a nested duplicate without losing its subfolder path", () => {
		const files = stripTopLevelFolderFromFiles([
			createUploadFile("新建文件.md", "新闻报道/分类五/新建文件.md"),
		])

		const [renamedFile] = renameFilesForTargetUpload(
			files,
			new Map([["分类五/新建文件.md", "新建文件(1).md"]]),
		)

		expect(renamedFile.name).toBe("新建文件(1).md")
		expect(renamedFile.webkitRelativePath).toBe("分类五/新建文件(1).md")
	})
})
