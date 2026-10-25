import { describe, expect, it } from "vitest"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks"
import {
	collectHtmlFiles,
	collectRootHtmlFiles,
	getMicroAppPreviewPath,
	isSamePreviewEntryFile,
	resolveDefaultHtmlEntry,
	resolveSelectedHtmlEntry,
} from "../microAppFiles"

function file(overrides: Partial<AttachmentItem>): AttachmentItem {
	return {
		type: "file",
		file_id: "file-id",
		file_name: "index.html",
		...overrides,
	}
}

describe("microAppFiles", () => {
	it("collects all visible html files for preview switching", () => {
		const result = collectHtmlFiles([
			file({ file_id: "root", file_name: "index.html" }),
			file({
				file_id: "nested",
				file_name: "admin.htm",
				relative_file_path: "pages/admin.htm",
			}),
			file({ file_id: "markdown", file_name: "readme.md" }),
			file({ file_id: "hidden", file_name: "hidden.html", is_hidden: true }),
			file({ file_id: "folder", file_name: "pages", is_directory: true, type: "directory" }),
		])

		expect(result.map((item) => item.file_id)).toEqual(["root", "nested"])
	})

	it("collects only root html files", () => {
		const result = collectRootHtmlFiles([
			file({ file_id: "root-html", file_name: "index.html" }),
			file({ file_id: "root-htm", file_name: "home.htm" }),
			file({
				file_id: "root-with-parent-id",
				file_name: "preview.html",
				parent_id: "0",
				relative_file_path: "preview.html",
			}),
			file({
				file_id: "nested",
				file_name: "page.html",
				relative_file_path: "pages/page.html",
			}),
			file({ file_id: "child", file_name: "child.html", parent_id: "folder-id" }),
			file({ file_id: "markdown", file_name: "readme.md" }),
			file({ file_id: "folder", file_name: "assets", is_directory: true, type: "directory" }),
			file({ file_id: "hidden", file_name: "hidden.html", is_hidden: true }),
		])

		expect(result.map((item) => item.file_id)).toEqual([
			"root-html",
			"root-htm",
			"root-with-parent-id",
		])
	})

	it("prefers index.html, then index.htm, then the first root html file", () => {
		expect(
			resolveDefaultHtmlEntry([
				file({ file_id: "page", file_name: "page.html" }),
				file({ file_id: "index", file_name: "index.html" }),
			])?.file_id,
		).toBe("index")

		expect(
			resolveDefaultHtmlEntry([
				file({ file_id: "page", file_name: "page.html" }),
				file({ file_id: "index-htm", file_name: "index.htm" }),
			])?.file_id,
		).toBe("index-htm")

		expect(
			resolveDefaultHtmlEntry([
				file({ file_id: "first", file_name: "first.html" }),
				file({ file_id: "second", file_name: "second.html" }),
			])?.file_id,
		).toBe("first")
	})

	it("collects nested children without duplicating flat entries and resolves a nested homepage", () => {
		const nested = file({ file_id: "nested", relative_file_path: "pages/index.html" })
		const items = [file({ file_id: "folder", type: "directory", children: [nested] }), nested]
		expect(collectHtmlFiles(items)).toEqual([nested])
		expect(resolveSelectedHtmlEntry({ items, selectedFileId: "nested" })).toBe(nested)
	})

	it("keeps a valid selected entry", () => {
		const selected = resolveSelectedHtmlEntry({
			selectedFileId: "second",
			items: [
				file({ file_id: "first", file_name: "index.html" }),
				file({ file_id: "second", file_name: "preview.html" }),
			],
		})

		expect(selected?.file_id).toBe("second")
	})

	it("matches persisted numeric and string file ids", () => {
		const selected = resolveSelectedHtmlEntry({
			selectedFileId: "42",
			items: [
				file({ file_id: 42 as unknown as string, file_name: "custom.html" }),
				file({ file_id: "index", file_name: "index.html" }),
			],
		})

		expect(selected?.file_id).toBe(42)
	})

	it("falls back when the persisted entry is missing or no longer valid", () => {
		const selected = resolveSelectedHtmlEntry({
			selectedFileId: "missing",
			items: [
				file({
					file_id: "nested",
					file_name: "nested.html",
					relative_file_path: "pages/nested.html",
				}),
				file({ file_id: "fallback", file_name: "fallback.htm" }),
			],
		})

		expect(selected?.file_id).toBe("fallback")
	})

	it("compares preview entries by file id and update time", () => {
		expect(
			isSamePreviewEntryFile(
				file({ file_id: "entry", updated_at: "2026-08-03T05:30:00Z" }),
				file({ file_id: "entry", updated_at: "2026-08-03T05:30:00Z" }),
			),
		).toBe(true)
		expect(
			isSamePreviewEntryFile(
				file({ file_id: "entry", updated_at: "2026-08-03T05:30:00Z" }),
				file({ file_id: "entry", updated_at: "2026-08-03T05:31:00Z" }),
			),
		).toBe(false)
	})

	it("returns full normalized paths for navigation bar preview path", () => {
		expect(getMicroAppPreviewPath(null)).toBe("/")
		expect(
			getMicroAppPreviewPath(
				file({ file_name: "index.html", relative_file_path: "index.html" }),
			),
		).toBe("/index.html")
		expect(
			getMicroAppPreviewPath(
				file({ file_name: "index.htm", relative_file_path: "index.htm" }),
			),
		).toBe("/index.htm")
		expect(
			getMicroAppPreviewPath(
				file({ file_name: "admin.html", relative_file_path: "pages/admin.html" }),
			),
		).toBe("/pages/admin.html")
	})
})
