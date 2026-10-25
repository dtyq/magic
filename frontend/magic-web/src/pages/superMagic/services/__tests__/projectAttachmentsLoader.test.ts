import { describe, expect, it, vi, afterEach, beforeEach } from "vitest"
import {
	createProjectAttachmentsBatchSnapshotScheduler,
	loadProjectAttachments,
} from "../projectAttachmentsLoader"
import {
	FILE_LIST_SCROLL_IDLE_MS,
	markProjectFileListScrollActivity,
	resetProjectFileListScrollActivity,
} from "../../utils/fileListScrollActivity"
import type { ProjectAttachmentsV2Snapshot } from "../../utils/projectAttachments/v2Adapter"

const superMagicApiMock = vi.hoisted(() => ({
	getAttachmentsByProjectId: vi.fn(),
	getProjectAttachmentsCount: vi.fn(),
	getProjectAttachmentsV2Page: vi.fn(),
}))

vi.mock("@/apis", () => ({
	SuperMagicApi: superMagicApiMock,
}))

function createSnapshot(level: number): ProjectAttachmentsV2Snapshot & {
	level: number
	projectId: string
} {
	return {
		tree: [{ file_id: `tree-${level}` }],
		list: [{ file_id: `list-${level}` }],
		total: 1,
		diagnostics: {
			rawRows: 1,
			normalizedRows: 1,
			hiddenFilteredCount: 0,
			dedupFileIdCount: 0,
			orphanCount: 0,
			adapterWarningCodes: [],
		},
		level,
		projectId: "project-1",
	}
}

describe("createProjectAttachmentsBatchSnapshotScheduler", () => {
	beforeEach(() => {
		vi.useFakeTimers()
		vi.clearAllMocks()
		window.history.replaceState({}, "", "/")
		resetProjectFileListScrollActivity()
	})

	afterEach(() => {
		resetProjectFileListScrollActivity()
		vi.useRealTimers()
	})

	it("commits first eagerly, coalesces middle snapshots, and guarantees final", async () => {
		const commits: Array<
			ReturnType<typeof createSnapshot> & { phase: string; isFinal: boolean }
		> = []
		const scheduler = createProjectAttachmentsBatchSnapshotScheduler(
			(payload) => commits.push(payload),
			{ middleMinGapMs: 0 },
		)

		scheduler.commitFirst(createSnapshot(0))
		scheduler.scheduleMiddle(createSnapshot(1))
		scheduler.scheduleMiddle(createSnapshot(2))

		expect(commits.map((payload) => payload.level)).toEqual([0])
		expect(commits[0].phase).toBe("first")

		await vi.runAllTimersAsync()

		expect(commits.map((payload) => payload.level)).toEqual([0, 2])
		expect(commits[1].phase).toBe("middle")

		scheduler.scheduleMiddle(createSnapshot(3))
		scheduler.commitFinal(createSnapshot(4))
		await vi.runAllTimersAsync()

		expect(commits.map((payload) => payload.level)).toEqual([0, 2, 4])
		expect(commits[2].phase).toBe("final")
		expect(commits[2].isFinal).toBe(true)
	})

	it("throttles middle snapshots by a minimum commit gap", async () => {
		const commits: Array<
			ReturnType<typeof createSnapshot> & { phase: string; isFinal: boolean }
		> = []
		const scheduler = createProjectAttachmentsBatchSnapshotScheduler(
			(payload) => commits.push(payload),
			{ middleMinGapMs: 100 },
		)

		scheduler.commitFirst(createSnapshot(0))
		scheduler.scheduleMiddle(createSnapshot(1))
		scheduler.scheduleMiddle(createSnapshot(2))

		await vi.advanceTimersByTimeAsync(99)
		expect(commits.map((payload) => payload.level)).toEqual([0])

		await vi.advanceTimersByTimeAsync(1)
		await vi.runOnlyPendingTimersAsync()

		expect(commits.map((payload) => payload.level)).toEqual([0, 2])
		expect(commits[1].phase).toBe("middle")
	})

	it("waits for file-list scroll idle before committing a middle snapshot", async () => {
		expect(FILE_LIST_SCROLL_IDLE_MS).toBe(1500)

		const commits: Array<
			ReturnType<typeof createSnapshot> & { phase: string; isFinal: boolean }
		> = []
		const scheduler = createProjectAttachmentsBatchSnapshotScheduler(
			(payload) => commits.push(payload),
			{ middleMinGapMs: 0 },
		)

		scheduler.commitFirst(createSnapshot(0))
		markProjectFileListScrollActivity()
		scheduler.scheduleMiddle(createSnapshot(1))

		await vi.runOnlyPendingTimersAsync()
		expect(commits.map((payload) => payload.level)).toEqual([0])

		await vi.advanceTimersByTimeAsync(FILE_LIST_SCROLL_IDLE_MS - 1)
		expect(commits.map((payload) => payload.level)).toEqual([0])

		await vi.advanceTimersByTimeAsync(1)
		await vi.runOnlyPendingTimersAsync()

		expect(commits.map((payload) => payload.level)).toEqual([0, 1])
		expect(commits[1].phase).toBe("middle")
	})
})

describe("loadProjectAttachments scope", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		window.history.replaceState({}, "", "/")
	})

	it("forwards memory scope to count and V1 requests", async () => {
		superMagicApiMock.getProjectAttachmentsCount.mockResolvedValue({ total: 1 })
		superMagicApiMock.getAttachmentsByProjectId.mockResolvedValue({
			tree: [],
			list: [],
			total: 0,
		})

		await loadProjectAttachments({
			projectId: "project-id",
			scope: "memory",
			temporaryToken: null,
			threshold: 1000,
		})

		expect(superMagicApiMock.getProjectAttachmentsCount).toHaveBeenCalledWith(
			expect.objectContaining({ projectId: "project-id", scope: "memory" }),
			expect.any(Object),
		)
		expect(superMagicApiMock.getAttachmentsByProjectId).toHaveBeenCalledWith(
			expect.objectContaining({ projectId: "project-id", scope: "memory" }),
			expect.any(Object),
		)
	})

	it("does not inherit window share token for workspace attachment loads", async () => {
		;(window as Window & { temporary_token?: string }).temporary_token = "share-token"
		superMagicApiMock.getProjectAttachmentsCount.mockResolvedValue({ total: 0 })
		superMagicApiMock.getProjectAttachmentsV2Page.mockResolvedValue({
			list: [],
			next_parent_ids: null,
			has_more: false,
		})

		await loadProjectAttachments({ projectId: "host-project" })

		expect(superMagicApiMock.getProjectAttachmentsCount).toHaveBeenCalledWith(
			expect.objectContaining({
				projectId: "host-project",
				temporaryToken: "",
			}),
			expect.any(Object),
		)
		expect(superMagicApiMock.getProjectAttachmentsV2Page).toHaveBeenCalledWith(
			expect.objectContaining({
				projectId: "host-project",
				temporaryToken: "",
			}),
			expect.any(Object),
		)
		delete (window as Window & { temporary_token?: string }).temporary_token
	})

	it("uses V2 by default and forwards memory scope to every page request", async () => {
		superMagicApiMock.getProjectAttachmentsCount.mockResolvedValue({ total: 0 })
		superMagicApiMock.getProjectAttachmentsV2Page.mockResolvedValue({
			list: [],
			next_parent_ids: null,
			has_more: false,
		})

		await loadProjectAttachments({
			projectId: "project-id",
			scope: "memory",
			temporaryToken: null,
		})

		expect(superMagicApiMock.getProjectAttachmentsV2Page).toHaveBeenCalledWith(
			expect.objectContaining({ projectId: "project-id", scope: "memory" }),
			expect.any(Object),
		)
		expect(superMagicApiMock.getAttachmentsByProjectId).not.toHaveBeenCalled()
	})

	it("keeps hidden recording images in the V2 tree only when includeHidden is true", async () => {
		const hiddenImagePage = {
			list: [
				{
					file_id: "hidden-root",
					parent_id: "",
					file_name: "/",
					is_directory: true,
					is_hidden: true,
				},
				{
					file_id: "session-folder",
					parent_id: "hidden-root",
					file_name: "session-folder",
					is_directory: true,
					is_hidden: true,
				},
				{
					file_id: "image-1",
					parent_id: "session-folder",
					file_name: "image-1.png",
					is_hidden: true,
				},
			],
			next_parent_ids: null,
			has_more: false,
		}
		superMagicApiMock.getProjectAttachmentsCount.mockResolvedValue({ total: 3 })
		superMagicApiMock.getProjectAttachmentsV2Page.mockResolvedValue(hiddenImagePage)

		const defaultResult = await loadProjectAttachments({
			projectId: "project-id",
			temporaryToken: null,
		})
		const includeHiddenResult = await loadProjectAttachments({
			projectId: "project-id",
			temporaryToken: null,
			includeHidden: true,
		})

		expect(defaultResult.list.map((item) => item.file_id)).toEqual([])
		expect(includeHiddenResult.list.map((item) => item.file_id)).toEqual([
			"session-folder",
			"image-1",
		])
		expect(includeHiddenResult.list.find((item) => item.file_id === "image-1")).toMatchObject({
			relative_file_path: "/session-folder/image-1.png",
			is_hidden: true,
		})
	})
})
