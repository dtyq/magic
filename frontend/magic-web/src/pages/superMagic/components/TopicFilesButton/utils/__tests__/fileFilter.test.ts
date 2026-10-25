import { describe, expect, it } from "vitest"
import { buildFileFilterResult } from "../fileFilter"
import type { AttachmentItem } from "../../hooks/types"

const allFilters = {
	documents: true,
	multimedia: true,
	code: true,
}

const attachments: AttachmentItem[] = [
	{
		file_id: "root",
		name: "Root",
		is_directory: true,
		children: [
			{
				file_id: "src",
				name: "src",
				is_directory: true,
				children: [
					{
						file_id: "main-go",
						filename: "main.go",
						file_extension: "go",
					},
					{
						file_id: "readme",
						filename: "README.md",
						file_extension: "md",
					},
				],
			},
			{
				file_id: "api-folder",
				name: "Go APIs",
				is_directory: true,
				children: [
					{
						file_id: "server-py",
						filename: "server.py",
						file_extension: "py",
					},
				],
			},
		],
	},
	{
		file_id: "notes",
		filename: "notes.txt",
		file_extension: "txt",
	},
	{
		file_id: "hidden-root",
		filename: "hidden.go",
		file_extension: "go",
		is_hidden: true,
	},
]

describe("buildFileFilterResult", () => {
	it("returns the original attachments reference for no-op default filters", () => {
		const visibleAttachments = attachments.slice(0, 2)
		const result = buildFileFilterResult({
			attachments: visibleAttachments,
			fileFilters: allFilters,
			searchValue: "",
		})

		expect(result.filteredFiles).toBe(visibleAttachments)
		expect(result.matchedItemPaths).toEqual([])
	})

	it("filters nested file matches and returns matched parent paths", () => {
		const result = buildFileFilterResult({
			attachments,
			fileFilters: allFilters,
			searchValue: ".go",
		})

		expect(result.matchedItemPaths).toEqual(["root", "src"])
		expect(result.matchedItemCount).toBe(2)
		expect(result.filteredFiles).toHaveLength(1)
		expect(result.filteredFiles[0].file_id).toBe("root")
		expect(result.filteredFiles[0].children?.[0].file_id).toBe("src")
		expect(result.filteredFiles[0].children?.[0].children).toEqual([
			expect.objectContaining({ file_id: "main-go" }),
		])
	})

	it("keeps folder-match children in legacy filteredFiles output", () => {
		const result = buildFileFilterResult({
			attachments,
			fileFilters: allFilters,
			searchValue: "Go APIs",
		})

		expect(result.matchedItemPaths).toEqual(["root"])
		expect(result.filteredFiles[0].children?.[0]).toEqual(
			expect.objectContaining({ file_id: "api-folder" }),
		)
		expect(result.filteredFiles[0].children?.[0].children).toEqual([
			expect.objectContaining({ file_id: "server-py" }),
		])
	})

	it("keeps matched paths independent from file type filters", () => {
		const result = buildFileFilterResult({
			attachments,
			fileFilters: {
				...allFilters,
				code: false,
			},
			searchValue: ".go",
		})

		expect(result.matchedItemPaths).toEqual(["root", "src"])
		expect(result.matchedItemCount).toBe(2)
		expect(result.filteredFiles).toEqual([])
	})

	it("preserves default legacy directory children while filtering hidden roots", () => {
		const result = buildFileFilterResult({
			attachments,
			fileFilters: allFilters,
			searchValue: "",
		})

		expect(result.filteredFiles).toHaveLength(2)
		expect(result.filteredFiles).not.toBe(attachments)
		expect(result.filteredFiles.map((item) => item.file_id)).toEqual(["root", "notes"])
		expect(result.filteredFiles[0].children).toBe(attachments[0].children)
		expect(result.matchedItemPaths).toEqual([])
	})

	it("classifies Opus recording artifacts as multimedia files", () => {
		const opusAttachments: AttachmentItem[] = [
			{
				file_id: "mock-opus-audio",
				filename: "mock-recording.opus",
				file_extension: "opus",
			},
		]
		const result = buildFileFilterResult({
			attachments: opusAttachments,
			fileFilters: {
				...allFilters,
				multimedia: false,
			},
			searchValue: "",
		})

		expect(result.filteredFiles).toEqual([])
	})
})
