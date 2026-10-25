import { describe, expect, it, vi } from "vitest"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"
import { buildAiCanvasMention, findAiCanvasFolder, resolveAiCanvasFolderName } from "../aiCanvas"

vi.mock("@/pages/superMagic/components/Detail/contents/Design/utils/designProjectCreation", () => ({
	createDesignProjectFiles: vi.fn(),
}))

function canvasFolder(id: string, createdAt?: string): AttachmentItem {
	return {
		file_id: id,
		file_name: `Canvas ${id}`,
		relative_file_path: `/Canvas ${id}/`,
		is_directory: true,
		display_config: { type: "design", version: 3 },
		created_at: createdAt,
	}
}

describe("findAiCanvasFolder", () => {
	it("ignores files, plain folders and nested canvases", () => {
		const nestedCanvas = canvasFolder("nested", "2026-01-01 00:00:00")
		const tree: AttachmentItem[] = [
			{ file_id: "file", file_name: "notes.md", is_directory: false },
			{
				file_id: "folder",
				file_name: "assets",
				is_directory: true,
				children: [nestedCanvas],
			},
		]

		expect(findAiCanvasFolder(tree)).toBeNull()
	})

	it("picks the earliest created root canvas", () => {
		const later = canvasFolder("later", "2026-10-20 10:00:00")
		const earlier = canvasFolder("earlier", "2026-10-19 10:00:00")
		const undated = canvasFolder("undated")

		expect(findAiCanvasFolder([undated, later, earlier])?.file_id).toBe("earlier")
	})

	it("keeps tree order when no canvas has a creation time", () => {
		expect(findAiCanvasFolder([canvasFolder("a"), canvasFolder("b")])?.file_id).toBe("a")
	})
})

describe("buildAiCanvasMention", () => {
	it("builds the same folder mention a user gets by @-referencing the canvas", () => {
		expect(buildAiCanvasMention(canvasFolder("1"))).toEqual({
			type: "mention",
			attrs: {
				type: "project_directory",
				data: {
					directory_id: "1",
					directory_name: "Canvas 1",
					directory_path: "Canvas 1/",
					directory_metadata: { type: "design", version: 3 },
				},
			},
		})
	})
})

describe("resolveAiCanvasFolderName", () => {
	it("follows the trimmed project name", () => {
		expect(resolveAiCanvasFolderName("  小狗沙滩奔跑  ")).toBe("小狗沙滩奔跑")
	})

	it("keeps the default name while the project has none", () => {
		expect(resolveAiCanvasFolderName("")).toBeNull()
		expect(resolveAiCanvasFolderName("   ")).toBeNull()
		expect(resolveAiCanvasFolderName(undefined)).toBeNull()
	})

	it("replaces path separators, which a folder name cannot contain", () => {
		expect(resolveAiCanvasFolderName("海报/分镜\\草稿")).toBe("海报-分镜-草稿")
	})
})
