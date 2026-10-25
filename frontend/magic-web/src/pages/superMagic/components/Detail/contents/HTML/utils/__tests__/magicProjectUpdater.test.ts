import { beforeEach, describe, expect, it, vi } from "vitest"
import {
	duplicateSlide,
	findMagicProjectJsFile,
	generateUpdatedMagicProjectJs,
	renameSlide,
	updateSlidesOrder,
} from "../magicProjectUpdater"

const mockState = vi.hoisted(() => ({
	getFileContentById: vi.fn(),
	createFile: vi.fn(),
	saveFileContent: vi.fn(),
	deleteFile: vi.fn(),
	getFileInfo: vi.fn(),
	renameFile: vi.fn(),
	contents: new Map<string, string>(),
	versions: new Map<string, number>(),
}))

vi.mock("@/apis", () => ({
	SuperMagicApi: {
		createFile: mockState.createFile,
		saveFileContent: mockState.saveFileContent,
		deleteFile: mockState.deleteFile,
		renameFile: mockState.renameFile,
	},
	MagicFSApi: { getFileInfo: mockState.getFileInfo },
}))

vi.mock("@/pages/superMagic/fileAccess/fileApi", () => ({
	createFileApi: () => ({
		identityKey: "session:project:topic",
		getFileContentById: mockState.getFileContentById,
	}),
}))

vi.mock("@/pages/superMagic/utils/api", () => ({
	getFileContentById: mockState.getFileContentById,
}))

vi.mock("@/infrastructure/logger", () => ({
	logger: {
		createLogger: () => ({
			info: vi.fn(),
			warn: vi.fn(),
			error: vi.fn(),
			debug: vi.fn(),
		}),
	},
}))

vi.mock("i18next", () => ({
	t: (key: string) => key,
}))

describe("findMagicProjectJsFile", () => {
	beforeEach(() => {
		mockState.getFileContentById.mockReset()
		mockState.createFile.mockReset()
		mockState.saveFileContent.mockReset()
		mockState.deleteFile.mockReset()
		mockState.getFileInfo.mockReset()
		mockState.renameFile.mockReset()
		mockState.contents.clear()
		mockState.versions.clear()
		mockState.getFileContentById.mockImplementation(async (fileId: string) =>
			mockState.contents.get(fileId),
		)
		mockState.getFileInfo.mockImplementation(async (fileId: string) => ({
			file: {
				id: fileId,
				parent_id: "actual-source-dir",
				version: mockState.versions.get(fileId) ?? 1,
				size: 0,
				is_directory: false,
			},
		}))
		mockState.saveFileContent.mockImplementation(async ([{ file_id, content }]) => {
			mockState.contents.set(file_id, content)
			const revision = (mockState.versions.get(file_id) ?? 1) + 1
			mockState.versions.set(file_id, revision)
			return { success_files: [{ file_id, data: { revision } }], error_files: [] }
		})
		mockState.deleteFile.mockResolvedValue({})
	})

	it("finds the matching magic.project.js for a directory among multiple projects", async () => {
		mockState.getFileContentById.mockImplementation(async (fileId: string) => {
			return `window.magicProjectConfig = { fileId: '${fileId}' }`
		})

		const result = await findMagicProjectJsFile({
			currentFileId: "deck-folder",
			currentFileName: "2026前沿UI设计盘点",
			attachments: [
				{
					file_id: "deck-folder",
					file_name: "2026前沿UI设计盘点",
					is_directory: true,
					relative_file_path: "deck",
					children: [
						{
							file_id: "magic-project-file",
							file_name: "magic.project.js",
							relative_file_path: "deck/magic.project.js",
						},
					],
				},
				{
					file_id: "other-deck-folder",
					file_name: "其他演示文稿",
					is_directory: true,
					relative_file_path: "other-deck",
					children: [
						{
							file_id: "other-magic-project-file",
							file_name: "magic.project.js",
							relative_file_path: "other-deck/magic.project.js",
						},
					],
				},
			],
		})

		expect(mockState.getFileContentById).toHaveBeenCalledWith("magic-project-file", {
			responseType: "text",
		})
		expect(mockState.getFileContentById).toHaveBeenCalledTimes(1)
		expect(result).toEqual({
			fileId: "magic-project-file",
			content: "window.magicProjectConfig = { fileId: 'magic-project-file' }",
		})
	})

	it("falls back to the only magic.project.js when the current slide is missing from attachments", async () => {
		mockState.getFileContentById.mockResolvedValue(
			"window.magicProjectConfig = { slides: ['missing.html'] }",
		)

		const result = await findMagicProjectJsFile({
			attachments: [
				{
					file_id: "magic-file",
					file_name: "magic.project.js",
					relative_file_path: "deck/magic.project.js",
					parent_id: "deck-folder",
					is_directory: false,
				},
			],
			currentFileId: "missing-slide-file",
			currentFileName: "missing.html",
		})

		expect(result?.fileId).toBe("magic-file")
		expect(result?.content).toContain("missing.html")
		expect(mockState.getFileContentById).toHaveBeenCalledWith("magic-file", {
			responseType: "text",
		})
	})

	it("duplicates a slide with the next available numbered filename", async () => {
		mockState.createFile.mockResolvedValue({ file_id: "slide-copy" })
		mockState.contents.set("source-slide", "<html>source</html>")
		mockState.contents.set(
			"magic-project",
			'window.magicProjectConfig = {"slides":["slides/intro.html","slides/intro (1).html"],"hidden_slides":["slides/intro.html"]}',
		)

		const result = await duplicateSlide({
			projectId: "project-1",
			parentId: "slides-dir",
			slidePath: "slides/intro.html",
			position: 0,
			currentSlides: ["slides/intro.html", "slides/intro (1).html"],
			magicProjectFileId: "magic-project",
			sourceFileId: "source-slide",
			attachments: [
				{ file_name: "intro (2).html", relative_file_path: "other/intro (2).html" },
			],
		})

		expect(result).toMatchObject({
			newFilePath: "slides/intro (2).html",
			newFileId: "slide-copy",
			insertIndex: 1,
		})
		expect(mockState.createFile).toHaveBeenCalledWith({
			project_id: "project-1",
			parent_id: "actual-source-dir",
			file_name: "intro (2).html",
			is_directory: false,
			ignore_duplicate: false,
		})
		expect(mockState.saveFileContent).toHaveBeenNthCalledWith(1, [
			{ file_id: "slide-copy", content: "<html>source</html>", expected_revision: 1 },
		])
		expect(mockState.saveFileContent).toHaveBeenNthCalledWith(2, [
			expect.objectContaining({
				file_id: "magic-project",
				content: expect.stringContaining(
					'"slides": [\n        "slides/intro.html",\n        "slides/intro (2).html"',
				),
			}),
		])
		expect(mockState.contents.get("magic-project")).toContain(
			'"hidden_slides": [\n        "slides/intro.html",\n        "slides/intro (2).html"',
		)
	})

	it("preserves the copied file when project order persistence is unknown", async () => {
		mockState.createFile.mockResolvedValue({ file_id: "slide-copy" })
		mockState.contents.set("source-slide", "<html>source</html>")
		mockState.contents.set(
			"magic-project",
			'window.magicProjectConfig = {"slides":["intro.html"]}',
		)
		mockState.saveFileContent
			.mockResolvedValueOnce({
				success_files: [{ file_id: "slide-copy", data: { revision: 2 } }],
				error_files: [],
			})
			.mockRejectedValueOnce(new Error("save failed"))

		await expect(
			duplicateSlide({
				projectId: "project-1",
				parentId: "slides-dir",
				slidePath: "intro.html",
				position: 0,
				currentSlides: ["intro.html"],
				magicProjectFileId: "magic-project",
				sourceFileId: "source-slide",
			}),
		).rejects.toMatchObject({ kind: "unknown", retainedFileId: "slide-copy" })
		expect(mockState.deleteFile).not.toHaveBeenCalled()
	})

	it("does not overwrite a manifest whose slides changed", async () => {
		mockState.contents.set(
			"magic-project",
			'window.magicProjectConfig = {"slides":["intro.html","ai.html"]}',
		)
		await expect(
			updateSlidesOrder({
				fileId: "magic-project",
				newSlidesOrder: ["replacement.html"],
				expectedSlides: ["intro.html"],
			}),
		).rejects.toMatchObject({ kind: "conflict" })
		expect(mockState.saveFileContent).not.toHaveBeenCalled()
	})

	it("cleans removed hidden paths while preserving unrelated config", () => {
		const content = generateUpdatedMagicProjectJs(
			{ slides: ["a.html", "b.html"], hidden_slides: ["a.html", "b.html"], title: "Title" },
			["b.html"],
		)
		expect(content).toContain('"hidden_slides": [\n        "b.html"')
		expect(content).toContain('"title": "Title"')
	})

	it("keeps the original directory and hidden flag when renaming", async () => {
		mockState.contents.set(
			"magic-project",
			'window.magicProjectConfig = {"slides":["../slides/a.html"],"hidden_slides":["../slides/a.html"]}',
		)
		const result = await renameSlide({
			oldPath: "../slides/a.html",
			newFileName: "renamed",
			currentSlides: ["../slides/a.html"],
			magicProjectFileId: "magic-project",
			fileId: "source-slide",
		})
		expect(result.newFilePath).toBe("../slides/renamed.html")
		expect(mockState.contents.get("magic-project")).toContain(
			'"hidden_slides": [\n        "../slides/renamed.html"',
		)
	})

	it("does not register a copy whose body save failed", async () => {
		mockState.createFile.mockResolvedValue({ file_id: "slide-copy" })
		mockState.contents.set("source-slide", "<html>source</html>")
		mockState.saveFileContent.mockResolvedValueOnce({
			success_files: [],
			error_files: [{ file_id: "slide-copy", error_code: 51152 }],
		})
		await expect(
			duplicateSlide({
				projectId: "project",
				slidePath: "a.html",
				position: 0,
				currentSlides: ["a.html"],
				magicProjectFileId: "magic-project",
				sourceFileId: "source-slide",
			}),
		).rejects.toMatchObject({ kind: "conflict", retainedFileId: "slide-copy" })
		expect(mockState.saveFileContent).toHaveBeenCalledTimes(1)
		expect(mockState.deleteFile).not.toHaveBeenCalled()
	})
})
