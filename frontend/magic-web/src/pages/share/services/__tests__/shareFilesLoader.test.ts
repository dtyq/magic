import { beforeEach, describe, expect, it, vi } from "vitest"
import { loadShareFilesV2 } from "../shareFilesLoader"

const mocks = vi.hoisted(() => ({
	getShareResourceFilesV2Page: vi.fn(),
}))

vi.mock("@/apis", () => ({
	SuperMagicApi: {
		getShareResourceFilesV2Page: mocks.getShareResourceFilesV2Page,
	},
}))

vi.mock("@/utils/manualPerfLogger", () => ({
	manualPerfLogger: {
		now: vi.fn(() => 100),
		isEnabled: vi.fn(() => false),
		ensureSession: vi.fn(),
		recordDuration: vi.fn(),
		logError: vi.fn(),
		count: vi.fn(),
		recordMetric: vi.fn(),
		snapshotHeap: vi.fn(),
	},
}))

function attachment(overrides: Record<string, unknown>) {
	return {
		file_id: "",
		parent_id: "0",
		file_name: "",
		is_directory: false,
		display_config: {},
		metadata: {},
		...overrides,
	}
}

describe("loadShareFilesV2", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("forwards every opaque cursor and builds one cross-page tree", async () => {
		const nextParentIds = [
			{
				parent_id: "folder-1",
				after_sort: 0,
				after_file_id: "file-1",
				extra_cursor_field: "keep-me",
			},
		]
		mocks.getShareResourceFilesV2Page
			.mockResolvedValueOnce({
				list: [
					attachment({
						file_id: "folder-1",
						parent_id: "0",
						file_name: "Docs",
						is_directory: true,
					}),
				],
				next_parent_ids: nextParentIds,
				has_more: true,
			})
			.mockResolvedValueOnce({
				list: [
					attachment({
						file_id: "file-1",
						parent_id: "folder-1",
						file_name: "README.md",
					}),
				],
				next_parent_ids: [],
				has_more: false,
			})

		const result = await loadShareFilesV2({
			resourceId: "share-1",
			password: "secret",
			pageSize: 100,
		})

		expect(mocks.getShareResourceFilesV2Page).toHaveBeenNthCalledWith(
			1,
			{
				resourceId: "share-1",
				password: "secret",
				pageSize: 100,
				nextParentIds: [],
			},
			{ signal: undefined },
		)
		expect(mocks.getShareResourceFilesV2Page).toHaveBeenNthCalledWith(
			2,
			{
				resourceId: "share-1",
				password: "secret",
				pageSize: 100,
				nextParentIds,
			},
			{ signal: undefined },
		)
		expect(result.tree).toMatchObject([
			{
				file_id: "folder-1",
				relative_file_path: "/Docs",
				children: [
					{
						file_id: "file-1",
						relative_file_path: "/Docs/README.md",
					},
				],
			},
		])
		expect(result.list.map((item) => item.file_id)).toEqual(["folder-1", "file-1"])
	})

	it("reuses project batch scheduling: first paints immediately, final commits complete tree", async () => {
		mocks.getShareResourceFilesV2Page
			.mockResolvedValueOnce({
				list: [
					attachment({
						file_id: "folder-1",
						parent_id: "0",
						file_name: "Docs",
						is_directory: true,
					}),
				],
				next_parent_ids: [
					{ parent_id: "folder-1", after_sort: 0, after_file_id: "file-1" },
				],
				has_more: true,
			})
			.mockResolvedValueOnce({
				list: [
					attachment({
						file_id: "file-1",
						parent_id: "folder-1",
						file_name: "README.md",
					}),
				],
				next_parent_ids: [],
				has_more: false,
			})

		const onBatchSnapshot = vi.fn()
		const result = await loadShareFilesV2({
			resourceId: "share-1",
			onBatchSnapshot,
		})

		expect(onBatchSnapshot).toHaveBeenCalledTimes(2)
		expect(onBatchSnapshot.mock.calls[0][0]).toMatchObject({
			phase: "first",
			isFinal: false,
			list: [{ file_id: "folder-1" }],
		})
		expect(onBatchSnapshot.mock.calls[1][0]).toMatchObject({
			phase: "final",
			isFinal: true,
		})
		expect(
			onBatchSnapshot.mock.calls[1][0].list.map((item: { file_id: string }) => item.file_id),
		).toEqual(["folder-1", "file-1"])
		expect(result.list.map((item) => item.file_id)).toEqual(["folder-1", "file-1"])
	})

	it("coalesces middle pages instead of committing every cursor page", async () => {
		vi.useFakeTimers()
		try {
			mocks.getShareResourceFilesV2Page
				.mockResolvedValueOnce({
					list: [
						attachment({
							file_id: "folder-1",
							parent_id: "0",
							file_name: "Docs",
							is_directory: true,
						}),
					],
					next_parent_ids: [{ parent_id: "a", after_sort: 0, after_file_id: "1" }],
					has_more: true,
				})
				.mockResolvedValueOnce({
					list: [
						attachment({
							file_id: "file-1",
							parent_id: "folder-1",
							file_name: "a.md",
						}),
					],
					next_parent_ids: [{ parent_id: "b", after_sort: 0, after_file_id: "2" }],
					has_more: true,
				})
				.mockResolvedValueOnce({
					list: [
						attachment({
							file_id: "file-2",
							parent_id: "folder-1",
							file_name: "b.md",
						}),
					],
					next_parent_ids: [],
					has_more: false,
				})

			const onBatchSnapshot = vi.fn()
			const resultPromise = loadShareFilesV2({
				resourceId: "share-1",
				onBatchSnapshot,
			})
			const result = await resultPromise

			// First + final only: the middle page is cancelled by commitFinal before idle flush.
			expect(onBatchSnapshot).toHaveBeenCalledTimes(2)
			expect(onBatchSnapshot.mock.calls.map((call) => call[0].phase)).toEqual([
				"first",
				"final",
			])
			expect(result.list.map((item) => item.file_id)).toEqual([
				"folder-1",
				"file-1",
				"file-2",
			])
		} finally {
			vi.useRealTimers()
		}
	})

	it("rejects has_more without a next cursor", async () => {
		mocks.getShareResourceFilesV2Page.mockResolvedValue({
			list: [],
			next_parent_ids: [],
			has_more: true,
		})

		await expect(loadShareFilesV2({ resourceId: "share-1" })).rejects.toThrow(
			"share_files_v2_empty_cursor",
		)
	})

	it("rejects a repeated cursor instead of requesting forever", async () => {
		const repeatedCursor = [
			{
				parent_id: "folder-1",
				after_sort: 0,
				after_file_id: "file-1",
			},
		]
		mocks.getShareResourceFilesV2Page.mockResolvedValue({
			list: [],
			next_parent_ids: repeatedCursor,
			has_more: true,
		})

		await expect(loadShareFilesV2({ resourceId: "share-1" })).rejects.toThrow(
			"share_files_v2_repeated_cursor",
		)
		expect(mocks.getShareResourceFilesV2Page).toHaveBeenCalledTimes(2)
	})
})
