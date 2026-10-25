import { beforeEach, describe, expect, it, vi } from "vitest"
import type { AttachmentItem } from "../../../../TopicFilesButton/hooks/types"
import { buildSlidesTemplateProject, parseSlidesTemplateManifest } from "../templateProject"
import { createSlidesTemplateStructureAdapter } from "../templateStructureAdapter"

const mocks = vi.hoisted(() => ({
	createFile: vi.fn(),
	saveFileContent: vi.fn(),
	deleteFile: vi.fn(),
	renameFile: vi.fn(),
	getFileContentById: vi.fn(),
}))

vi.mock("@/apis", () => ({
	SuperMagicApi: {
		createFile: mocks.createFile,
		saveFileContent: mocks.saveFileContent,
		deleteFile: mocks.deleteFile,
		renameFile: mocks.renameFile,
	},
}))

vi.mock("@/pages/superMagic/utils/api", () => ({
	getFileContentById: mocks.getFileContentById,
}))

vi.mock("@/pages/superMagic/components/Detail/contents/HTML/utils/magicProjectUpdater", () => ({
	generateBlankSlideContent: ({ slideTitle }: { slideTitle?: string }) =>
		`<html>${slideTitle || "blank"}</html>`,
}))

function createRoot(): AttachmentItem {
	return {
		file_id: "root",
		file_name: "PPT-template",
		relative_file_path: "PPT-template",
		is_directory: true,
		children: [
			{ file_id: "manifest", file_name: "template.json" },
			{ file_id: "spec", file_name: "visual-spec.md" },
			{ file_id: "theme", file_name: "theme.css" },
			{
				file_id: "slides-dir",
				file_name: "slides",
				is_directory: true,
				children: [
					{ file_id: "slide-1", file_name: "slide-1.html" },
					{ file_id: "slide-2", file_name: "slide-2.html" },
				],
			},
		],
	}
}

function createProject() {
	const manifest = parseSlidesTemplateManifest(
		JSON.stringify({
			schema_version: "1.0",
			files: { slides_dir: "slides", theme_css: "theme.css" },
			slides: [
				{
					file: "slides/slide-1.html",
					title: "One",
					layout: "cover",
					description: "First",
				},
				{
					file: "slides/slide-2.html",
					title: "Two",
					layout: "content",
					description: "Second",
				},
			],
			unknown_field: { keep: true },
		}),
	)
	return buildSlidesTemplateProject(createRoot(), manifest)
}

function getSavedManifest(callIndex = -1) {
	const call =
		callIndex === -1
			? mocks.saveFileContent.mock.calls.at(-1)
			: mocks.saveFileContent.mock.calls[callIndex]
	return JSON.parse(call?.[0]?.[0]?.content)
}

describe("slides template structure adapter", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mocks.saveFileContent.mockResolvedValue({})
		mocks.deleteFile.mockResolvedValue({})
		mocks.renameFile.mockResolvedValue({})
		mocks.getFileContentById.mockResolvedValue("<html>original</html>")
	})

	it("reorders only manifest.slides and keeps page metadata and unknown fields", async () => {
		const adapter = createSlidesTemplateStructureAdapter({ project: createProject() })

		await adapter.reorder(["slides/slide-2.html", "slides/slide-1.html"])

		const saved = getSavedManifest()
		expect(saved.slides.map((slide: { file: string }) => slide.file)).toEqual([
			"slides/slide-2.html",
			"slides/slide-1.html",
		])
		expect(saved.slides[0]).toMatchObject({ title: "Two", layout: "content" })
		expect(saved.unknown_field).toEqual({ keep: true })
	})

	it("inserts a blank HTML page in slides and updates template.json", async () => {
		mocks.createFile.mockResolvedValue({ file_id: "slide-3", file_name: "slide-3.html" })
		const adapter = createSlidesTemplateStructureAdapter({
			project: createProject(),
			projectId: "project-1",
		})

		const result = await adapter.insert({
			position: 0,
			direction: "after",
		})

		expect(mocks.createFile).toHaveBeenCalledWith({
			project_id: "project-1",
			parent_id: "slides-dir",
			file_name: "slide-3.html",
			is_directory: false,
		})
		expect(result.filePath).toBe("slides/slide-3.html")
		expect(result.content).toBe("<html>slide-3.html</html>")
		expect(getSavedManifest().slides.map((slide: { file: string }) => slide.file)).toEqual([
			"slides/slide-1.html",
			"slides/slide-3.html",
			"slides/slide-2.html",
		])
		expect(getSavedManifest().slides[1]).toMatchObject({
			file: "slides/slide-3.html",
			title: "slide-3.html",
		})
	})

	it("duplicates a slide and copies its content and manifest metadata", async () => {
		mocks.createFile.mockResolvedValue({ file_id: "slide-copy", file_name: "slide-1 (1).html" })
		mocks.getFileContentById.mockResolvedValue("<html>original</html>")
		const adapter = createSlidesTemplateStructureAdapter({
			project: createProject(),
			projectId: "project-1",
		})

		const result = await adapter.duplicate({
			slidePath: "slides/slide-1.html",
			position: 0,
		})

		expect(result).toEqual({
			filePath: "slides/slide-1 (1).html",
			fileId: "slide-copy",
			content: "<html>original</html>",
		})
		expect(mocks.createFile).toHaveBeenCalledWith({
			project_id: "project-1",
			parent_id: "slides-dir",
			file_name: "slide-1 (1).html",
			is_directory: false,
		})
		expect(mocks.saveFileContent).toHaveBeenNthCalledWith(1, [
			{ file_id: "slide-copy", content: "<html>original</html>", enable_shadow: true },
		])
		expect(getSavedManifest().slides).toEqual([
			{ file: "slides/slide-1.html", title: "One", layout: "cover", description: "First" },
			{
				file: "slides/slide-1 (1).html",
				title: "One",
				layout: "cover",
				description: "First",
			},
			{ file: "slides/slide-2.html", title: "Two", layout: "content", description: "Second" },
		])
	})

	it("cleans up the copied template file when manifest persistence fails", async () => {
		mocks.createFile.mockResolvedValue({ file_id: "slide-copy", file_name: "slide-1 (1).html" })
		mocks.saveFileContent
			.mockResolvedValueOnce({})
			.mockRejectedValueOnce(new Error("save failed"))
		const adapter = createSlidesTemplateStructureAdapter({
			project: createProject(),
			projectId: "project-1",
		})

		await expect(
			adapter.duplicate({ slidePath: "slides/slide-1.html", position: 0 }),
		).rejects.toThrow("save failed")
		expect(mocks.deleteFile).toHaveBeenCalledWith("slide-copy")
	})

	it("renames the HTML file first and then updates the manifest path", async () => {
		const adapter = createSlidesTemplateStructureAdapter({ project: createProject() })

		const result = await adapter.rename("slides/slide-1.html", "新的封面")

		expect(mocks.renameFile).toHaveBeenCalledWith({
			file_id: "slide-1",
			target_name: "新的封面.html",
		})
		expect(result).toBe("slides/新的封面.html")
		expect(getSavedManifest().slides[0]).toMatchObject({
			file: "slides/新的封面.html",
			title: "One",
		})
	})

	it("restores the file name when saving template.json fails after rename", async () => {
		mocks.saveFileContent.mockRejectedValueOnce(new Error("save failed"))
		const adapter = createSlidesTemplateStructureAdapter({ project: createProject() })

		await expect(adapter.rename("slides/slide-1.html", "renamed")).rejects.toThrow(
			"save failed",
		)

		expect(mocks.renameFile).toHaveBeenNthCalledWith(2, {
			file_id: "slide-1",
			target_name: "slide-1.html",
		})
	})

	it("deletes the HTML file and removes the manifest page", async () => {
		const adapter = createSlidesTemplateStructureAdapter({
			project: createProject(),
			projectId: "project-1",
		})

		await adapter.remove("slides/slide-2.html")

		expect(mocks.deleteFile).toHaveBeenCalledWith("slide-2")
		expect(getSavedManifest().slides).toHaveLength(1)
		expect(getSavedManifest().slides[0].file).toBe("slides/slide-1.html")
	})

	it("requires a project ID before deleting so rollback can restore the file", async () => {
		const adapter = createSlidesTemplateStructureAdapter({ project: createProject() })

		await expect(adapter.remove("slides/slide-2.html")).rejects.toThrow("Missing project ID")
		expect(mocks.deleteFile).not.toHaveBeenCalled()
	})

	it("exposes the replacement file ID after a delete rollback", async () => {
		mocks.createFile.mockResolvedValueOnce({
			file_id: "restored-slide-2",
			file_name: "slide-2.html",
		})
		mocks.saveFileContent.mockRejectedValueOnce(new Error("save failed"))
		const adapter = createSlidesTemplateStructureAdapter({
			project: createProject(),
			projectId: "project-1",
		})

		await expect(adapter.remove("slides/slide-2.html")).rejects.toThrow("save failed")
		expect(adapter.getFileId?.("slides/slide-2.html")).toBe("restored-slide-2")
	})
})
