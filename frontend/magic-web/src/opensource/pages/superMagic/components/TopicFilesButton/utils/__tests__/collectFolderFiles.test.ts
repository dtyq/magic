import { describe, it, expect } from "vitest"
import { collectFolderFiles, findParentFolder, isAppEntryFile } from "../collectFolderFiles"
import type { AttachmentItem } from "../../hooks/types"
import { AttachmentSource } from "../../hooks/types"

describe("collectFolderFiles", () => {
	it("should collect all files in a folder including the folder itself", () => {
		const folder: AttachmentItem = {
			file_id: "folder-1",
			name: "app",
			is_directory: true,
			source: AttachmentSource.DEFAULT,
			children: [
				{
					file_id: "file-1",
					name: "index.html",
					is_directory: false,
					source: AttachmentSource.DEFAULT,
				},
				{
					file_id: "file-2",
					name: "style.css",
					is_directory: false,
					source: AttachmentSource.DEFAULT,
				},
			],
		}

		const result = collectFolderFiles(folder)

		expect(result).toEqual(["folder-1", "file-1", "file-2"])
	})

	it("should recursively collect all nested files", () => {
		const folder: AttachmentItem = {
			file_id: "folder-1",
			name: "app",
			is_directory: true,
			source: AttachmentSource.DEFAULT,
			children: [
				{
					file_id: "file-1",
					name: "index.html",
					is_directory: false,
					source: AttachmentSource.DEFAULT,
				},
				{
					file_id: "folder-2",
					name: "assets",
					is_directory: true,
					source: AttachmentSource.DEFAULT,
					children: [
						{
							file_id: "file-2",
							name: "logo.png",
							is_directory: false,
							source: AttachmentSource.DEFAULT,
						},
					],
				},
			],
		}

		const result = collectFolderFiles(folder)

		expect(result).toEqual(["folder-1", "file-1", "folder-2", "file-2"])
	})

	it("should handle empty folder", () => {
		const folder: AttachmentItem = {
			file_id: "folder-1",
			name: "empty",
			is_directory: true,
			source: AttachmentSource.DEFAULT,
			children: [],
		}

		const result = collectFolderFiles(folder)

		expect(result).toEqual(["folder-1"])
	})
})

describe("findParentFolder", () => {
	const mockFiles: AttachmentItem[] = [
		{
			file_id: "folder-1",
			name: "app",
			is_directory: true,
			source: AttachmentSource.DEFAULT,
			children: [
				{
					file_id: "file-1",
					name: "index.html",
					is_directory: false,
					source: AttachmentSource.DEFAULT,
					metadata: { type: "webapp" },
				},
				{
					file_id: "file-2",
					name: "style.css",
					is_directory: false,
					source: AttachmentSource.DEFAULT,
				},
			],
		},
		{
			file_id: "file-3",
			name: "readme.md",
			is_directory: false,
			source: AttachmentSource.DEFAULT,
		},
	]

	it("should find parent folder for a file", () => {
		const result = findParentFolder(mockFiles, "file-1")

		expect(result).toBeDefined()
		expect(result?.file_id).toBe("folder-1")
	})

	it("should return null for root level file", () => {
		const result = findParentFolder(mockFiles, "file-3")

		expect(result).toBeNull()
	})

	it("should return null for non-existent file", () => {
		const result = findParentFolder(mockFiles, "non-existent")

		expect(result).toBeNull()
	})

	it("should find parent in nested structure", () => {
		const nestedFiles: AttachmentItem[] = [
			{
				file_id: "folder-1",
				name: "root",
				is_directory: true,
				source: AttachmentSource.DEFAULT,
				children: [
					{
						file_id: "folder-2",
						name: "nested",
						is_directory: true,
						source: AttachmentSource.DEFAULT,
						children: [
							{
								file_id: "file-1",
								name: "deep.txt",
								is_directory: false,
								source: AttachmentSource.DEFAULT,
							},
						],
					},
				],
			},
		]

		const result = findParentFolder(nestedFiles, "file-1")

		expect(result).toBeDefined()
		expect(result?.file_id).toBe("folder-2")
	})
})

describe("isAppEntryFile", () => {
	it("should return true for index.html with metadata.type", () => {
		const file: AttachmentItem = {
			file_id: "file-1",
			name: "index.html",
			is_directory: false,
			source: AttachmentSource.DEFAULT,
			metadata: { type: "webapp" },
		}

		expect(isAppEntryFile(file)).toBe(true)
	})

	it("should return true for index.html with file_name and metadata.type", () => {
		const file: AttachmentItem = {
			file_id: "file-1",
			file_name: "index.html",
			is_directory: false,
			source: AttachmentSource.DEFAULT,
			metadata: { type: "slide" },
		}

		expect(isAppEntryFile(file)).toBe(true)
	})

	it("should return false for index.html without metadata", () => {
		const file: AttachmentItem = {
			file_id: "file-1",
			name: "index.html",
			is_directory: false,
			source: AttachmentSource.DEFAULT,
		}

		expect(isAppEntryFile(file)).toBe(false)
	})

	it("should return false for index.html with empty metadata.type", () => {
		const file: AttachmentItem = {
			file_id: "file-1",
			name: "index.html",
			is_directory: false,
			source: AttachmentSource.DEFAULT,
			metadata: { type: "" },
		}

		expect(isAppEntryFile(file)).toBe(false)
	})

	it("should return false for non-index.html file", () => {
		const file: AttachmentItem = {
			file_id: "file-1",
			name: "app.html",
			is_directory: false,
			source: AttachmentSource.DEFAULT,
			metadata: { type: "webapp" },
		}

		expect(isAppEntryFile(file)).toBe(false)
	})

	it("should return false for directory named index.html", () => {
		const file: AttachmentItem = {
			file_id: "folder-1",
			name: "index.html",
			is_directory: true,
			source: AttachmentSource.DEFAULT,
			metadata: { type: "webapp" },
		}

		expect(isAppEntryFile(file)).toBe(false)
	})
})
