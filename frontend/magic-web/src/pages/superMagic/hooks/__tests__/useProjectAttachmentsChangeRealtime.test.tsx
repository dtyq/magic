import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { SuperMagicFileChangeItem } from "@/types/chat/intermediate_message"
import type { ProjectFilesStore } from "@/stores/projectFiles"
import { SuperMagicApi } from "@/apis"
import type { AttachmentItem } from "../../components/TopicFilesButton/hooks"
import { useProjectAttachmentsChangeRealtime } from "../useProjectAttachmentsChangeRealtime"
import { applyProjectAttachmentsChangesToTree } from "../../utils/projectAttachments/changeReducer"
import { flattenAttachmentTree } from "../../utils/projectAttachments/treeUtils"

const pubsubMock = vi.hoisted(() => ({
	subscribe: vi.fn(),
	unsubscribe: vi.fn(),
}))

vi.mock("@/utils/pubsub", () => ({
	default: pubsubMock,
	PubSubEvents: {
		Super_Magic_File_Change_Intermediate: "Super_Magic_File_Change_Intermediate",
	},
}))

vi.mock("@/stores/projectFiles", () => ({
	default: {},
	ProjectFilesStore: class ProjectFilesStore {},
}))

vi.mock("@/apis", () => ({
	SuperMagicApi: {
		getProjectAttachmentsV2Page: vi.fn(),
	},
}))

vi.mock("../../services/attachmentsTopicSync", () => ({
	resolveAttachmentsRefreshWaitersForProject: vi.fn(),
}))

vi.mock("../../services", () => ({
	loadProjectAttachments: vi.fn(),
}))

vi.mock("../../utils/projectAttachments/lastUpdatedCache", () => ({
	markProjectAttachmentsLastUpdated: vi.fn(),
}))

vi.mock("../../utils/projectAttachments/attachmentMutationWaiter", () => ({
	resolveProjectAttachmentMutationWaiters: vi.fn(),
}))

vi.mock("../../utils/projectAttachments/changeLogReporter", () => ({
	projectAttachmentsChangeLog: new Proxy(
		{},
		{
			get:
				() =>
				(...args: unknown[]) => {
					if (args.length === 0) return "trace-test"
					return undefined
				},
		},
	),
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
		type: "file",
		children: [],
		...overrides,
	} as AttachmentItem
}

class TestProjectFilesStore {
	workspaceFileTree: AttachmentItem[] = []
	workspaceFilesList: AttachmentItem[] = []

	setWorkspaceFileTree(tree: AttachmentItem[]) {
		this.workspaceFileTree = tree
		this.workspaceFilesList = flattenAttachmentTree(tree)
	}

	applyFileChanges(changes: SuperMagicFileChangeItem[]) {
		const result = applyProjectAttachmentsChangesToTree(this.workspaceFileTree, changes)
		if (!result.fallbackRequired) {
			this.workspaceFileTree = result.tree
			this.workspaceFilesList = result.list
		}
		return result
	}
}

function asProjectFilesStore(store: TestProjectFilesStore) {
	return store as unknown as ProjectFilesStore
}

function createStoreWithParentFolder() {
	const store = new TestProjectFilesStore()
	store.setWorkspaceFileTree([
		attachment({
			file_id: "folder",
			parent_id: "0",
			file_name: "Project",
			is_directory: true,
			type: "directory",
			updated_at: "parent-1",
			children: [
				attachment({
					file_id: "magic",
					parent_id: "folder",
					file_name: "magic.project.js",
					updated_at: "magic-1",
				}),
			],
		}),
	])
	return store
}

function createSeq(params: { operation: "add" | "update"; updatedAt: string; seqId: string }) {
	return {
		seq_id: params.seqId,
		message: {
			type: "super_magic_file_change",
			project_id: "project-1",
			workspace_id: "workspace-1",
			topic_id: "0",
			timestamp: params.updatedAt,
			refresh_parent_ids: ["folder"],
			changes: [
				{
					operation: params.operation,
					file_id: "magic",
					file: attachment({
						file_id: "magic",
						parent_id: "folder",
						file_name: "magic.project.js",
						updated_at: params.updatedAt,
					}) as SuperMagicFileChangeItem["file"],
				},
			],
		},
	} as never
}

describe("useProjectAttachmentsChangeRealtime", () => {
	beforeEach(() => {
		vi.useFakeTimers()
		vi.clearAllMocks()
		vi.mocked(SuperMagicApi.getProjectAttachmentsV2Page).mockResolvedValue({
			list: [
				attachment({
					file_id: "folder",
					parent_id: "0",
					file_name: "Project",
					is_directory: true,
					type: "directory",
					updated_at: "parent-2",
				}),
				attachment({
					file_id: "magic",
					parent_id: "folder",
					file_name: "magic.project.js",
					updated_at: "magic-3",
				}),
			],
			next_parent_ids: null,
			has_more: false,
		})
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	it("skips parent refresh api when ws carries explicit file payloads", async () => {
		const store = createStoreWithParentFolder()
		renderHook(() =>
			useProjectAttachmentsChangeRealtime({
				projectId: "project-1",
				store: asProjectFilesStore(store),
				debounceMs: 10,
				parentRefreshWindowMs: 100,
			}),
		)
		const handler = pubsubMock.subscribe.mock.calls[0]?.[1] as (seq: never) => void

		act(() => {
			handler(createSeq({ operation: "add", updatedAt: "magic-2", seqId: "seq-add" }))
		})
		await act(async () => {
			await vi.advanceTimersByTimeAsync(10)
		})

		act(() => {
			handler(createSeq({ operation: "update", updatedAt: "magic-3", seqId: "seq-update" }))
		})
		await act(async () => {
			await vi.advanceTimersByTimeAsync(200)
		})

		expect(SuperMagicApi.getProjectAttachmentsV2Page).not.toHaveBeenCalled()
	})

	it("still refreshes parent folders for refresh-only ws batches", async () => {
		const store = createStoreWithParentFolder()
		renderHook(() =>
			useProjectAttachmentsChangeRealtime({
				projectId: "project-1",
				store: asProjectFilesStore(store),
				debounceMs: 10,
				parentRefreshWindowMs: 100,
			}),
		)
		const handler = pubsubMock.subscribe.mock.calls[0]?.[1] as (seq: never) => void

		act(() => {
			handler({
				seq_id: "seq-refresh-only",
				message: {
					type: "super_magic_file_change",
					project_id: "project-1",
					workspace_id: "workspace-1",
					topic_id: "0",
					timestamp: "parent-2",
					refresh_parent_ids: ["folder"],
					changes: [],
				},
			} as never)
		})
		await act(async () => {
			await vi.advanceTimersByTimeAsync(10)
		})
		await act(async () => {
			await vi.advanceTimersByTimeAsync(100)
		})

		expect(SuperMagicApi.getProjectAttachmentsV2Page).toHaveBeenCalledTimes(1)
		expect(SuperMagicApi.getProjectAttachmentsV2Page).toHaveBeenCalledWith(
			expect.objectContaining({
				projectId: "project-1",
				parentId: "folder",
			}),
			expect.any(Object),
		)
	})
})
