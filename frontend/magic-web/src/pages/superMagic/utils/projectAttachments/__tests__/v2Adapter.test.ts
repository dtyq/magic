import { beforeEach, describe, expect, it, vi } from "vitest"
import type { AttachmentItem } from "../../../components/TopicFilesButton/hooks"
import { createProjectAttachmentsV2Builder } from "../v2Adapter"

const manualPerfLoggerMock = vi.hoisted(() => ({
	now: vi.fn(() => 100),
	recordDuration: vi.fn(),
}))

vi.mock("@/utils/manualPerfLogger", () => ({
	manualPerfLogger: manualPerfLoggerMock,
}))

function attachment(overrides: Partial<AttachmentItem>): AttachmentItem {
	return {
		file_id: "",
		parent_id: "",
		file_name: "",
		filename: "",
		display_filename: "",
		name: "",
		is_directory: false,
		children: [],
		...overrides,
	} as AttachmentItem
}

describe("createProjectAttachmentsV2Builder", () => {
	beforeEach(() => {
		manualPerfLoggerMock.now.mockReturnValue(100)
		manualPerfLoggerMock.recordDuration.mockClear()
	})

	it("builds a V1-compatible tree/list from paged rows", () => {
		const builder = createProjectAttachmentsV2Builder()

		builder.mergeBatch([
			attachment({
				file_id: "root",
				parent_id: "0",
				file_name: "/",
				is_directory: true,
				file_type: "root",
			}),
			attachment({
				file_id: "folder",
				parent_id: "root",
				file_name: "Docs",
				is_directory: true,
			}),
			attachment({ file_id: "file", parent_id: "folder", file_name: "readme.md" }),
		])

		const snapshot = builder.snapshot()

		expect(snapshot.tree).toHaveLength(1)
		expect(snapshot.tree[0]).toMatchObject({
			file_id: "folder",
			relative_file_path: "/Docs",
			children: [
				expect.objectContaining({
					file_id: "file",
					relative_file_path: "/Docs/readme.md",
				}),
			],
		})
		expect(snapshot.list.map((item) => item.file_id)).toEqual(["folder", "file"])
		expect(snapshot.total).toBe(2)
		expect(snapshot.diagnostics).toMatchObject({
			rawRows: 3,
			normalizedRows: 3,
			hiddenFilteredCount: 0,
			dedupFileIdCount: 0,
			orphanCount: 0,
			adapterWarningCodes: [],
		})
	})

	it("uses hidden virtual root containers to resolve top-level nodes", () => {
		const builder = createProjectAttachmentsV2Builder()

		builder.mergeBatch([
			attachment({
				file_id: "hidden-root",
				parent_id: "",
				file_name: "/",
				is_directory: true,
				is_hidden: true,
			}),
			attachment({
				file_id: "folder",
				parent_id: "hidden-root",
				file_name: "Docs",
				is_directory: true,
			}),
			attachment({ file_id: "file", parent_id: "folder", file_name: "readme.md" }),
		])

		const snapshot = builder.snapshot()

		expect(snapshot.tree).toHaveLength(1)
		expect(snapshot.tree[0]).toMatchObject({
			file_id: "folder",
			relative_file_path: "/Docs",
			children: [
				expect.objectContaining({
					file_id: "file",
					relative_file_path: "/Docs/readme.md",
				}),
			],
		})
		expect(snapshot.list.map((item) => item.file_id)).toEqual(["folder", "file"])
		expect(snapshot.diagnostics).toMatchObject({
			rawRows: 3,
			normalizedRows: 2,
			hiddenFilteredCount: 1,
			dedupFileIdCount: 0,
			orphanCount: 0,
			adapterWarningCodes: [],
		})
	})

	it("filters hidden rows, deduplicates file ids, and reports orphans", () => {
		const builder = createProjectAttachmentsV2Builder()

		builder.mergeBatch([
			attachment({ file_id: "visible", parent_id: "0", file_name: "visible.txt" }),
			attachment({ file_id: "visible", parent_id: "0", file_name: "duplicate.txt" }),
			attachment({
				file_id: "hidden",
				parent_id: "0",
				file_name: "hidden.txt",
				is_hidden: true,
			}),
			attachment({ file_id: "orphan", parent_id: "missing", file_name: "orphan.txt" }),
		])

		const snapshot = builder.finalize()

		expect(snapshot.list.map((item) => item.file_id)).toEqual(["visible"])
		expect(snapshot.diagnostics).toMatchObject({
			rawRows: 4,
			normalizedRows: 2,
			hiddenFilteredCount: 1,
			dedupFileIdCount: 1,
			orphanCount: 1,
		})
		expect(snapshot.diagnostics.adapterWarningCodes).toContain("unexpected_orphan_after_bfs")
	})

	it("keeps hidden recording images when includeHidden is enabled", () => {
		const builder = createProjectAttachmentsV2Builder({ includeHidden: true })

		builder.mergeBatch([
			attachment({
				file_id: "hidden-root",
				parent_id: "",
				file_name: "/",
				is_directory: true,
				is_hidden: true,
			}),
			attachment({
				file_id: "session-folder",
				parent_id: "hidden-root",
				file_name: "session-folder",
				is_directory: true,
				is_hidden: true,
			}),
			attachment({
				file_id: "images-folder",
				parent_id: "session-folder",
				file_name: "images",
				is_directory: true,
				is_hidden: true,
			}),
			attachment({
				file_id: "image-1",
				parent_id: "images-folder",
				file_name: "image-1.png",
				is_hidden: true,
			}),
			attachment({
				file_id: "folder",
				parent_id: "hidden-root",
				file_name: "Docs",
				is_directory: true,
			}),
			attachment({ file_id: "file", parent_id: "folder", file_name: "readme.md" }),
		])

		const snapshot = builder.snapshot()

		expect(snapshot.tree.map((item) => item.file_id)).toEqual(["folder", "session-folder"])
		expect(snapshot.list.map((item) => item.file_id)).toEqual([
			"folder",
			"file",
			"session-folder",
			"images-folder",
			"image-1",
		])
		expect(snapshot.list.find((item) => item.file_id === "image-1")).toMatchObject({
			relative_file_path: "/session-folder/images/image-1.png",
			is_hidden: true,
		})
	})

	it("sorts directories first and then by natural name, without using sort fields", () => {
		const builder = createProjectAttachmentsV2Builder()

		builder.mergeBatch([
			attachment({ file_id: "file2", parent_id: "0", file_name: "file2.txt", sort: 1 }),
			attachment({ file_id: "file10", parent_id: "0", file_name: "file10.txt", sort: 0 }),
			attachment({
				file_id: "dir-b",
				parent_id: "0",
				file_name: "B",
				is_directory: true,
				sort: 0,
			}),
			attachment({
				file_id: "dir-a",
				parent_id: "0",
				file_name: "A",
				is_directory: true,
				sort: 99,
			}),
		])

		const snapshot = builder.snapshot()

		expect(snapshot.list.map((item) => item.file_id)).toEqual([
			"dir-a",
			"dir-b",
			"file2",
			"file10",
		])
	})

	it("normalizes JSON configs and missing display names", () => {
		const builder = createProjectAttachmentsV2Builder()

		builder.mergeBatch([
			attachment({
				file_id: 123 as unknown as string,
				parent_id: null as unknown as string,
				filename: "fallback-name.txt",
				display_config: '{"type":"custom"}',
				metadata: "{bad json",
			}),
		])

		const [item] = builder.snapshot().list

		expect(item).toMatchObject({
			file_id: "123",
			parent_id: "",
			file_name: "fallback-name.txt",
			name: "fallback-name.txt",
			display_config: { type: "custom" },
			metadata: null,
		})
	})

	it("reports unresolved roots when no top-level node can be found", () => {
		const builder = createProjectAttachmentsV2Builder()

		builder.mergeBatch([
			attachment({
				file_id: "orphan-a",
				parent_id: "missing",
				file_name: "A",
				is_directory: true,
			}),
			attachment({ file_id: "orphan-b", parent_id: "orphan-a", file_name: "B" }),
		])

		const snapshot = builder.snapshot()

		expect(snapshot.list).toEqual([])
		expect(snapshot.diagnostics.orphanCount).toBe(2)
		expect(snapshot.diagnostics.adapterWarningCodes).toEqual([
			"root_unresolved",
			"unexpected_orphan_after_bfs",
		])
	})

	it("records merge and snapshot durations", () => {
		const builder = createProjectAttachmentsV2Builder()

		builder.mergeBatch([attachment({ file_id: "file", parent_id: "0", file_name: "file.txt" })])
		builder.snapshot()

		expect(manualPerfLoggerMock.recordDuration).toHaveBeenCalledWith(
			"attachments_incremental_merge_ms",
			100,
			expect.objectContaining({ batch_size: 1, normalized_rows: 1 }),
		)
		expect(manualPerfLoggerMock.recordDuration).toHaveBeenCalledWith(
			"attachments_snapshot_build_ms",
			100,
			expect.objectContaining({ tree_count: 1, list_count: 1 }),
		)
	})
})
