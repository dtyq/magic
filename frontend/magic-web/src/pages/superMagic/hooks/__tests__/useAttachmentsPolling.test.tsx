import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { SuperMagicApi } from "@/apis"
import type { ProjectFilesStore } from "@/stores/projectFiles"
import type { AttachmentItem } from "../../components/TopicFilesButton/hooks"
import { loadProjectAttachments } from "../../services/projectAttachmentsLoader"
import {
	getProjectAttachmentsLastUpdated,
	markProjectAttachmentsLastUpdated,
} from "../../utils/projectAttachments/lastUpdatedCache"
import { useAttachmentsPolling } from "../useAttachmentsPolling"

vi.mock("@/apis", () => ({
	SuperMagicApi: {
		getProjectAttachmentsCount: vi.fn(),
		getLastFileUpdateTime: vi.fn(),
	},
}))

vi.mock("@/stores/projectFiles", () => ({
	default: {
		workspaceFilesList: [],
	},
	ProjectFilesStore: class ProjectFilesStore {},
}))

vi.mock("@/utils/manualPerfLogger", () => ({
	measureManualPerfAsyncOperation: (_metric: string, callback: () => Promise<unknown>) =>
		callback(),
}))

vi.mock("../../utils/attachmentPerf", () => ({
	measureAttachmentFetch: (_source: string, callback: () => Promise<unknown>) => callback(),
}))

vi.mock("../../services/projectAttachmentsLoader", () => ({
	loadProjectAttachments: vi.fn(),
}))

vi.mock("../../utils/projectAttachments/lastUpdatedCache", () => ({
	clearProjectAttachmentsLastUpdated: vi.fn(),
	getProjectAttachmentsLastUpdated: vi.fn(),
	markProjectAttachmentsLastUpdated: vi.fn(),
	subscribeProjectAttachmentsLastUpdated: vi.fn(() => vi.fn()),
}))

function attachment(overrides: Partial<AttachmentItem> = {}): AttachmentItem {
	return {
		file_id: "",
		parent_id: "",
		file_name: "",
		filename: "",
		display_filename: "",
		name: "",
		is_directory: false,
		is_hidden: false,
		type: "file",
		children: [],
		...overrides,
	} as AttachmentItem
}

function createStore(files: AttachmentItem[]) {
	return {
		workspaceFilesList: files,
	} as Pick<ProjectFilesStore, "workspaceFilesList">
}

describe("useAttachmentsPolling", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		vi.mocked(getProjectAttachmentsLastUpdated).mockReturnValue("")
		vi.mocked(loadProjectAttachments).mockResolvedValue({
			tree: [attachment({ file_id: "file-1" })],
			list: [attachment({ file_id: "file-1" })],
		})
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	it("does not start interval checks by default", async () => {
		vi.useFakeTimers()
		const store = createStore([attachment({ file_id: "file-1" })])

		renderHook(() =>
			useAttachmentsPolling({
				projectId: "project-1",
				store,
			}),
		)

		await act(async () => {
			await vi.advanceTimersByTimeAsync(6000)
		})

		expect(SuperMagicApi.getProjectAttachmentsCount).not.toHaveBeenCalled()
	})

	it("refreshes immediately when server count differs from local visible count", async () => {
		const store = createStore([attachment({ file_id: "file-1" })])
		const onAttachmentsChange = vi.fn()
		vi.mocked(SuperMagicApi.getProjectAttachmentsCount).mockResolvedValue({ total: 2 })
		vi.mocked(SuperMagicApi.getLastFileUpdateTime).mockResolvedValue({
			last_updated_at: "updated-2",
		})

		const { result } = renderHook(() =>
			useAttachmentsPolling({
				projectId: "project-1",
				store,
				autoStart: false,
				onAttachmentsChange,
			}),
		)

		await act(async () => {
			await result.current.checkNow()
		})

		expect(SuperMagicApi.getProjectAttachmentsCount).toHaveBeenCalledTimes(1)
		expect(loadProjectAttachments).toHaveBeenCalledTimes(1)
		expect(SuperMagicApi.getLastFileUpdateTime).toHaveBeenCalledTimes(1)
		expect(vi.mocked(loadProjectAttachments).mock.invocationCallOrder[0]).toBeLessThan(
			vi.mocked(SuperMagicApi.getLastFileUpdateTime).mock.invocationCallOrder[0],
		)
		expect(markProjectAttachmentsLastUpdated).toHaveBeenCalledWith("project-1", "updated-2")
		expect(onAttachmentsChange).toHaveBeenCalledWith(
			expect.objectContaining({
				last_updated_at: "updated-2",
				projectId: "project-1",
			}),
		)
	})

	it("checks last_updated_at only after local count matches and skips refresh when unchanged", async () => {
		const store = createStore([
			attachment({ file_id: "file-1" }),
			attachment({ file_id: "hidden-file", is_hidden: true }),
		])
		const onAttachmentsChange = vi.fn()
		vi.mocked(getProjectAttachmentsLastUpdated).mockReturnValue("updated-1")
		vi.mocked(SuperMagicApi.getProjectAttachmentsCount).mockResolvedValue({ total: 2 })
		vi.mocked(SuperMagicApi.getLastFileUpdateTime).mockResolvedValue({
			last_updated_at: "updated-1",
		})

		const { result } = renderHook(() =>
			useAttachmentsPolling({
				projectId: "project-1",
				store,
				autoStart: false,
				onAttachmentsChange,
			}),
		)

		await act(async () => {
			await result.current.checkNow()
		})

		expect(SuperMagicApi.getProjectAttachmentsCount).toHaveBeenCalledTimes(1)
		expect(SuperMagicApi.getLastFileUpdateTime).toHaveBeenCalledTimes(1)
		expect(loadProjectAttachments).not.toHaveBeenCalled()
		expect(onAttachmentsChange).not.toHaveBeenCalled()
	})

	it("refreshes when count matches but last_updated_at changed", async () => {
		const store = createStore([attachment({ file_id: "file-1" })])
		const onAttachmentsChange = vi.fn()
		vi.mocked(getProjectAttachmentsLastUpdated).mockReturnValue("updated-1")
		vi.mocked(SuperMagicApi.getProjectAttachmentsCount).mockResolvedValue({ total: 1 })
		vi.mocked(SuperMagicApi.getLastFileUpdateTime).mockResolvedValue({
			last_updated_at: "updated-2",
		})

		const { result } = renderHook(() =>
			useAttachmentsPolling({
				projectId: "project-1",
				store,
				autoStart: false,
				onAttachmentsChange,
			}),
		)

		await act(async () => {
			await result.current.checkNow()
		})

		expect(SuperMagicApi.getProjectAttachmentsCount).toHaveBeenCalledTimes(1)
		expect(SuperMagicApi.getLastFileUpdateTime).toHaveBeenCalledTimes(1)
		expect(loadProjectAttachments).toHaveBeenCalledTimes(1)
		expect(markProjectAttachmentsLastUpdated).toHaveBeenCalledWith("project-1", "updated-2")
		expect(onAttachmentsChange).toHaveBeenCalledWith(
			expect.objectContaining({
				last_updated_at: "updated-2",
				projectId: "project-1",
			}),
		)
	})
})
