import { describe, expect, it, vi } from "vitest"
import { DetailType } from "../../../../types"
import type { FileItem } from "../../types"
import { detectContentTypeRender } from "../preview"

// Keep this focused renderer test independent from the application cache bootstrap.
vi.mock("@/models/repository/Cache", () => ({
	Storage: {
		get: vi.fn(),
		getItem: vi.fn(),
		setItem: vi.fn(),
		removeItem: vi.fn(),
	},
}))

describe("detectContentTypeRender", () => {
	it("routes project template folders to the template PPT renderer", () => {
		const item: FileItem = {
			file_id: "template-folder",
			file_name: "产品发布模板",
			is_directory: true,
			children: [],
			display_config: {
				type: "slide-template",
			},
		}

		const config = detectContentTypeRender(item)

		expect(config?.detailType).toBe(DetailType.SlidesTemplate)
		expect(config?.dataTransformer?.(item)).toMatchObject({
			file_name: "产品发布模板",
			is_directory: true,
			display_config: { type: "slide-template" },
		})
	})

	it("treats slide project folders as PPT render entries", () => {
		const item: FileItem = {
			file_id: "deck-folder",
			file_name: "2026前沿UI设计盘点",
			is_directory: true,
			relative_file_path: "projects/deck",
			parent_id: "project-root",
			display_config: {
				type: "slide",
				slides: ["slides/slide-1.html"],
			},
			children: [],
		}

		const config = detectContentTypeRender(item)

		expect(config?.detailType).toBe(DetailType.Html)
		expect(config?.dataTransformer?.(item)).toMatchObject({
			file_name: "2026前沿UI设计盘点",
			is_directory: true,
			relative_file_path: "projects/deck",
			parent_id: "project-root",
			display_config: {
				type: "slide",
			},
		})
	})

	it("does not emit undefined PPT path metadata over a complete attachment node", () => {
		const item: FileItem = {
			file_id: "partial-deck-folder",
			file_name: "Partial deck",
			is_directory: true,
			display_config: {
				type: "slide",
				slides: ["slide-1.html"],
			},
		}

		const transformedData = detectContentTypeRender(item)?.dataTransformer?.(item)

		expect(transformedData).not.toHaveProperty("relative_file_path")
		expect(transformedData).not.toHaveProperty("parent_id")
	})

	it("routes audio folders to the recording HTML root renderer", () => {
		const item: FileItem = {
			file_id: "folder-audio",
			file_name: "录音资料",
			is_directory: true,
			relative_file_path: "uploads/录音资料",
			display_config: { type: "audio", name: "录音资料" },
		}

		const config = detectContentTypeRender(item)

		expect(config?.detailType).toBe(DetailType.Html)
		expect(config?.dataTransformer?.(item)).toMatchObject({
			file_name: "录音资料",
			is_directory: true,
			display_config: { type: "audio", name: "录音资料" },
		})
	})
})
