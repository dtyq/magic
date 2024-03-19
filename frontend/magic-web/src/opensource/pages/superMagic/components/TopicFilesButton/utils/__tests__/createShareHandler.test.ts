import { describe, it, expect, vi, beforeEach } from "vitest"
import { createShareHandler } from "../createShareHandler"
import type { AttachmentItem } from "../../hooks/types"
import { AttachmentSource } from "../../hooks/types"

describe("createShareHandler", () => {
	let mockSetShareFileInfo: ReturnType<typeof vi.fn>
	let mockSetShareModalVisible: ReturnType<typeof vi.fn>
	let mockGetItemId: (item: AttachmentItem) => string

	beforeEach(() => {
		mockSetShareFileInfo = vi.fn()
		mockSetShareModalVisible = vi.fn()
		mockGetItemId = (item) => item.file_id || ""
	})

	describe("entry file handling", () => {
		it("should share entire folder when clicking on entry file", () => {
			const allFiles: AttachmentItem[] = [
				{
					file_id: "folder-1",
					name: "webapp",
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
						{
							file_id: "file-3",
							name: "script.js",
							is_directory: false,
							source: AttachmentSource.DEFAULT,
						},
					],
				},
			]

			const entryFile = allFiles[0].children![0]

			createShareHandler({
				item: entryFile,
				selectedItems: new Set(),
				allFiles,
				getItemId: mockGetItemId,
				setShareFileInfo: mockSetShareFileInfo,
				setShareModalVisible: mockSetShareModalVisible,
			})

			expect(mockSetShareFileInfo).toHaveBeenCalledWith(
				expect.objectContaining({
					fileIds: expect.arrayContaining(["folder-1", "file-1", "file-2", "file-3"]),
				}),
			)
			expect(mockSetShareModalVisible).toHaveBeenCalledWith(true)
		})

		it("should share entire folder when entry file is in selected items", () => {
			const allFiles: AttachmentItem[] = [
				{
					file_id: "folder-1",
					name: "slideshow",
					is_directory: true,
					source: AttachmentSource.DEFAULT,
					children: [
						{
							file_id: "file-1",
							name: "index.html",
							is_directory: false,
							source: AttachmentSource.DEFAULT,
							metadata: { type: "slide" },
						},
						{
							file_id: "file-2",
							name: "slide1.png",
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

			const entryFile = allFiles[0].children![0]
			const selectedItems = new Set(["file-1"])

			createShareHandler({
				item: entryFile,
				selectedItems,
				allFiles,
				getItemId: mockGetItemId,
				setShareFileInfo: mockSetShareFileInfo,
				setShareModalVisible: mockSetShareModalVisible,
			})

			const call = mockSetShareFileInfo.mock.calls[0][0]
			expect(call.fileIds).toContain("folder-1")
			expect(call.fileIds).toContain("file-1")
			expect(call.fileIds).toContain("file-2")
			expect(mockSetShareModalVisible).toHaveBeenCalledWith(true)
		})

		it("should handle multiple selected items including entry file", () => {
			const allFiles: AttachmentItem[] = [
				{
					file_id: "folder-1",
					name: "webapp",
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

			const entryFile = allFiles[0].children![0]
			const selectedItems = new Set(["file-1", "file-3"])

			createShareHandler({
				item: entryFile,
				selectedItems,
				allFiles,
				getItemId: mockGetItemId,
				setShareFileInfo: mockSetShareFileInfo,
				setShareModalVisible: mockSetShareModalVisible,
			})

			const call = mockSetShareFileInfo.mock.calls[0][0]
			// Should include entire webapp folder
			expect(call.fileIds).toContain("folder-1")
			expect(call.fileIds).toContain("file-1")
			expect(call.fileIds).toContain("file-2")
			// Should also include the separate selected file
			expect(call.fileIds).toContain("file-3")
		})

		it("should not expand normal index.html without metadata.type", () => {
			const allFiles: AttachmentItem[] = [
				{
					file_id: "folder-1",
					name: "docs",
					is_directory: true,
					source: AttachmentSource.DEFAULT,
					children: [
						{
							file_id: "file-1",
							name: "index.html",
							is_directory: false,
							source: AttachmentSource.DEFAULT,
							// No metadata.type
						},
						{
							file_id: "file-2",
							name: "content.html",
							is_directory: false,
							source: AttachmentSource.DEFAULT,
						},
					],
				},
			]

			const normalIndexFile = allFiles[0].children![0]

			createShareHandler({
				item: normalIndexFile,
				selectedItems: new Set(),
				allFiles,
				getItemId: mockGetItemId,
				setShareFileInfo: mockSetShareFileInfo,
				setShareModalVisible: mockSetShareModalVisible,
			})

			expect(mockSetShareFileInfo).toHaveBeenCalledWith(
				expect.objectContaining({
					fileIds: ["file-1"], // Only the file itself
				}),
			)
		})
	})

	describe("standard file sharing", () => {
		it("should share single file when no items selected", () => {
			const allFiles: AttachmentItem[] = [
				{
					file_id: "file-1",
					name: "document.pdf",
					is_directory: false,
					source: AttachmentSource.DEFAULT,
				},
			]

			createShareHandler({
				item: allFiles[0],
				selectedItems: new Set(),
				allFiles,
				getItemId: mockGetItemId,
				setShareFileInfo: mockSetShareFileInfo,
				setShareModalVisible: mockSetShareModalVisible,
			})

			expect(mockSetShareFileInfo).toHaveBeenCalledWith(
				expect.objectContaining({
					fileIds: ["file-1"],
				}),
			)
			expect(mockSetShareModalVisible).toHaveBeenCalledWith(true)
		})

		it("should share selected items when multiple files selected", () => {
			const allFiles: AttachmentItem[] = [
				{
					file_id: "file-1",
					name: "doc1.pdf",
					is_directory: false,
					source: AttachmentSource.DEFAULT,
				},
				{
					file_id: "file-2",
					name: "doc2.pdf",
					is_directory: false,
					source: AttachmentSource.DEFAULT,
				},
				{
					file_id: "file-3",
					name: "doc3.pdf",
					is_directory: false,
					source: AttachmentSource.DEFAULT,
				},
			]

			const selectedItems = new Set(["file-1", "file-2"])

			createShareHandler({
				item: allFiles[0],
				selectedItems,
				allFiles,
				getItemId: mockGetItemId,
				setShareFileInfo: mockSetShareFileInfo,
				setShareModalVisible: mockSetShareModalVisible,
			})

			const call = mockSetShareFileInfo.mock.calls[0][0]
			expect(call.fileIds).toContain("file-1")
			expect(call.fileIds).toContain("file-2")
			expect(call.fileIds).not.toContain("file-3")
		})

		it("should include clicked item if not in selected items", () => {
			const allFiles: AttachmentItem[] = [
				{
					file_id: "file-1",
					name: "doc1.pdf",
					is_directory: false,
					source: AttachmentSource.DEFAULT,
				},
				{
					file_id: "file-2",
					name: "doc2.pdf",
					is_directory: false,
					source: AttachmentSource.DEFAULT,
				},
			]

			const selectedItems = new Set(["file-1"])

			createShareHandler({
				item: allFiles[1], // Clicking on file-2
				selectedItems,
				allFiles,
				getItemId: mockGetItemId,
				setShareFileInfo: mockSetShareFileInfo,
				setShareModalVisible: mockSetShareModalVisible,
			})

			const call = mockSetShareFileInfo.mock.calls[0][0]
			expect(call.fileIds).toContain("file-1")
			expect(call.fileIds).toContain("file-2")
		})
	})

	describe("edge cases", () => {
		it("should handle missing getItemId gracefully", () => {
			const allFiles: AttachmentItem[] = [
				{
					file_id: "file-1",
					name: "test.txt",
					is_directory: false,
					source: AttachmentSource.DEFAULT,
				},
			]

			createShareHandler({
				item: allFiles[0],
				selectedItems: new Set(),
				allFiles,
				getItemId: undefined as any,
				setShareFileInfo: mockSetShareFileInfo,
				setShareModalVisible: mockSetShareModalVisible,
			})

			expect(mockSetShareFileInfo).not.toHaveBeenCalled()
			expect(mockSetShareModalVisible).not.toHaveBeenCalled()
		})

		it("should handle item without file_id", () => {
			const allFiles: AttachmentItem[] = [
				{
					name: "test.txt",
					is_directory: false,
					source: AttachmentSource.DEFAULT,
				},
			]

			createShareHandler({
				item: allFiles[0],
				selectedItems: new Set(),
				allFiles,
				getItemId: mockGetItemId,
				setShareFileInfo: mockSetShareFileInfo,
				setShareModalVisible: mockSetShareModalVisible,
			})

			expect(mockSetShareFileInfo).not.toHaveBeenCalled()
			expect(mockSetShareModalVisible).not.toHaveBeenCalled()
		})
	})
})
