import { describe, expect, it, vi } from "vitest"
import { PPTPathMappingService } from "../PPTPathMappingService"

function createLogger() {
	return {
		debug: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		logOperationStart: vi.fn(),
		logOperationSuccess: vi.fn(),
		logOperationError: vi.fn(),
		updateConfig: vi.fn(),
	} as any
}

describe("PPTPathMappingService", () => {
	it("resolves slide files when the PPT entry is a project folder", () => {
		const service = new PPTPathMappingService(
			{
				mainFileId: "deck-folder",
				mainFileName: "2026前沿UI设计盘点",
				attachmentList: [
					{
						file_id: "deck-folder",
						file_name: "2026前沿UI设计盘点",
						is_directory: true,
						relative_file_path: "deck",
						children: [
							{
								file_id: "cover-file",
								file_name: "cover.html",
								relative_file_path: "deck/cover.html",
							},
						],
					},
				],
			},
			createLogger(),
		)

		expect(service.extractFileIdFromPath("cover.html")).toBe("cover-file")
		expect(service.extractFileIdFromPath("./cover.html")).toBe("cover-file")
		expect(service.getFullRelativePath("cover.html")).toBe("deck/cover.html")
	})

	it("resolves nested template slides that only have file names", () => {
		const service = new PPTPathMappingService(
			{
				mainFileId: "template-root",
				mainFileName: "SLIDE-aurora",
				attachmentList: [
					{
						file_id: "template-root",
						file_name: "SLIDE-aurora",
						is_directory: true,
						relative_file_path: "SLIDE-aurora",
						children: [
							{ file_id: "theme-file", file_name: "theme.css" },
							{
								file_id: "slides-dir",
								file_name: "slides",
								is_directory: true,
								children: [
									{
										file_id: "slide-1",
										file_name: "1.html",
										updated_at: "1",
									},
								],
							},
						],
					},
				],
			},
			createLogger(),
		)

		expect(service.extractFileIdFromPath("slides/1.html")).toBe("slide-1")
		expect(service.getPPTFolderFileIds().has("slide-1")).toBe(true)
		expect(service.getAttachmentByFileIdInPPTFolder("slide-1")?.file_name).toBe("1.html")
	})

	it("uses the mapped slide path when copied attachment metadata has a different root", () => {
		const service = new PPTPathMappingService(
			{
				mainFileId: "template-root",
				attachmentList: [
					{
						file_id: "template-root",
						file_name: "PPT-soft-pink-midyear-review",
						is_directory: true,
						relative_file_path: "/PPT-soft-pink-midyear-review",
						children: [
							{
								file_id: "slides-dir",
								file_name: "slides",
								is_directory: true,
								relative_file_path: "/PPT-soft-pink-midyear-review/slides",
								children: [
									{
										file_id: "copied-slide",
										file_name: "contents (1).html",
										relative_file_path: "slides/contents (1).html",
									},
								],
							},
						],
					},
				],
			},
			createLogger(),
		)

		service.setPathFileIdMapping("slides/contents (1).html", "copied-slide")

		expect(service.getRelativeFilePathByFileId("copied-slide")).toBe(
			"/PPT-soft-pink-midyear-review/slides/",
		)
	})
})
