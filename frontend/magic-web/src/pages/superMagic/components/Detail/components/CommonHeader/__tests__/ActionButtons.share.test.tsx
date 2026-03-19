import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useState, useCallback } from "react"
import { AttachmentSource } from "../../../../TopicFilesButton/hooks/types"
import {
	isAppEntryFile,
	findParentFolder,
	collectFolderFiles,
} from "../../../../TopicFilesButton/utils/collectFolderFiles"

// Mock the share handler logic from ActionButtons
function useShareHandler(currentFile: any, attachments: any[]) {
	const [shareFileIds, setShareFileIds] = useState<string[] | undefined>(undefined)
	const [shareModalVisible, setShareModalVisible] = useState(false)

	const handleShare = useCallback(() => {
		// 检查当前文件是否是入口文件
		if (currentFile && attachments) {
			const currentFileItem = {
				file_id: currentFile.id,
				name: currentFile.name,
				file_name: currentFile.name,
				is_directory: false,
				source: currentFile.source || AttachmentSource.DEFAULT,
				metadata: currentFile.metadata,
			}

			// 如果是入口文件，获取整个文件夹的文件
			if (isAppEntryFile(currentFileItem)) {
				const parentFolder = findParentFolder(attachments, currentFile.id)
				if (parentFolder) {
					const allFileIds = collectFolderFiles(parentFolder)
					setShareFileIds(allFileIds)
					setShareModalVisible(true)
					return
				}
			}
		}

		// 普通文件，只分享当前文件
		setShareFileIds(currentFile?.id ? [currentFile.id] : undefined)
		setShareModalVisible(true)
	}, [currentFile, attachments])

	return { shareFileIds, shareModalVisible, handleShare, setShareModalVisible }
}

describe("ActionButtons Share Handler", () => {
	describe("Entry file sharing", () => {
		it("should share entire folder when sharing an entry file", () => {
			const attachments = [
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
			]

			const currentFile = {
				id: "file-1",
				name: "index.html",
				type: "html",
				source: AttachmentSource.DEFAULT,
				metadata: { type: "webapp" },
			}

			const { result } = renderHook(() => useShareHandler(currentFile, attachments))

			act(() => {
				result.current.handleShare()
			})

			expect(result.current.shareModalVisible).toBe(true)
			expect(result.current.shareFileIds).toEqual(
				expect.arrayContaining(["folder-1", "file-1", "file-2"]),
			)
		})

		it("should share only current file for normal index.html without metadata", () => {
			const attachments = [
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

			const currentFile = {
				id: "file-1",
				name: "index.html",
				type: "html",
				source: AttachmentSource.DEFAULT,
			}

			const { result } = renderHook(() => useShareHandler(currentFile, attachments))

			act(() => {
				result.current.handleShare()
			})

			expect(result.current.shareModalVisible).toBe(true)
			expect(result.current.shareFileIds).toEqual(["file-1"])
		})

		it("should share only current file for non-entry files", () => {
			const attachments = [
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
			]

			const currentFile = {
				id: "file-2",
				name: "style.css",
				type: "css",
				source: AttachmentSource.DEFAULT,
			}

			const { result } = renderHook(() => useShareHandler(currentFile, attachments))

			act(() => {
				result.current.handleShare()
			})

			expect(result.current.shareModalVisible).toBe(true)
			expect(result.current.shareFileIds).toEqual(["file-2"])
		})

		it("should handle slideshow entry file", () => {
			const attachments = [
				{
					file_id: "folder-1",
					name: "slides",
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
						{
							file_id: "file-3",
							name: "slide2.png",
							is_directory: false,
							source: AttachmentSource.DEFAULT,
						},
					],
				},
			]

			const currentFile = {
				id: "file-1",
				name: "index.html",
				type: "html",
				source: AttachmentSource.DEFAULT,
				metadata: { type: "slide" },
			}

			const { result } = renderHook(() => useShareHandler(currentFile, attachments))

			act(() => {
				result.current.handleShare()
			})

			expect(result.current.shareModalVisible).toBe(true)
			expect(result.current.shareFileIds).toEqual(
				expect.arrayContaining(["folder-1", "file-1", "file-2", "file-3"]),
			)
			expect(result.current.shareFileIds?.length).toBe(4)
		})

		it("should handle nested folder structure", () => {
			const attachments = [
				{
					file_id: "folder-1",
					name: "project",
					is_directory: true,
					source: AttachmentSource.DEFAULT,
					children: [
						{
							file_id: "folder-2",
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
									name: "app.js",
									is_directory: false,
									source: AttachmentSource.DEFAULT,
								},
							],
						},
					],
				},
			]

			const currentFile = {
				id: "file-1",
				name: "index.html",
				type: "html",
				source: AttachmentSource.DEFAULT,
				metadata: { type: "webapp" },
			}

			const { result } = renderHook(() => useShareHandler(currentFile, attachments))

			act(() => {
				result.current.handleShare()
			})

			expect(result.current.shareModalVisible).toBe(true)
			// Should include the direct parent folder (webapp) and its children
			expect(result.current.shareFileIds).toEqual(
				expect.arrayContaining(["folder-2", "file-1", "file-2"]),
			)
			expect(result.current.shareFileIds?.length).toBe(3)
		})
	})
})
