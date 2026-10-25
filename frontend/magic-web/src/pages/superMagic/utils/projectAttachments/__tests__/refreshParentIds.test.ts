import { beforeEach, describe, expect, it, vi } from "vitest"
import type { SuperMagicFileChangeItem } from "@/types/chat/intermediate_message"
import type { ProjectFilesStore } from "@/stores/projectFiles"
import { SuperMagicApi } from "@/apis"
import type { AttachmentItem } from "../../../components/TopicFilesButton/hooks"
import { applyProjectAttachmentsChangesToTree } from "../changeReducer"
import {
	applyMergedParentRefresh,
	applyRefreshParentChildrenSubtree,
	applyRefreshParentFileItems,
	collectFileChangeParentRefreshIds,
	loadRefreshParentChildrenSubtreeFromV2,
	loadRefreshParentFileItemsFromV2,
	normalizeRefreshParentIds,
	resolveProjectAttachmentsChangeEvent,
	shouldSkipParentChildrenReconcileAfterWsApply,
} from "../changeRealtimeUtils"
import { flattenAttachmentTree } from "../treeUtils"

vi.mock("../../../services", () => ({
	loadProjectAttachments: vi.fn(),
}))

vi.mock("../../../services/attachmentsTopicSync", () => ({
	withAttachmentsRefreshWaitersResolved: vi.fn(
		(_projectId: string, request: Promise<unknown>) => request,
	),
}))

vi.mock("../changeLogReporter", () => ({
	projectAttachmentsChangeLog: new Proxy(
		{},
		{
			get: () => vi.fn(),
		},
	),
}))

vi.mock("@/apis", () => ({
	SuperMagicApi: {
		getProjectAttachmentsV2Page: vi.fn(),
	},
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

function change(overrides: Partial<SuperMagicFileChangeItem>): SuperMagicFileChangeItem {
	return {
		operation: "update",
		file_id: "",
		...overrides,
	} as SuperMagicFileChangeItem
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

function createStoreWithParentSubtree() {
	const store = new TestProjectFilesStore()
	store.setWorkspaceFileTree([
		attachment({
			file_id: "folder",
			parent_id: "0",
			file_name: "Project",
			is_directory: true,
			type: "directory",
			relative_file_path: "Project",
			children: [
				attachment({
					file_id: "file-existing",
					parent_id: "folder",
					file_name: "existing.txt",
					relative_file_path: "Project/existing.txt",
					updated_at: "file-1",
				}),
				attachment({
					file_id: "file-deleted",
					parent_id: "folder",
					file_name: "deleted.txt",
					relative_file_path: "Project/deleted.txt",
					updated_at: "deleted-1",
				}),
			],
		}),
	])
	return store
}

describe("refresh_parent_ids realtime helpers", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("normalizes and dedupes refresh parent IDs", () => {
		expect(normalizeRefreshParentIds(["folder", "", null, "folder", 123])).toEqual([
			"folder",
			"123",
		])
	})

	it("loads parent fileItems through v2 attachments parent_id", async () => {
		vi.mocked(SuperMagicApi.getProjectAttachmentsV2Page).mockResolvedValueOnce({
			list: [
				attachment({
					file_id: "folder",
					parent_id: "0",
					file_name: "Project",
					is_directory: true,
					updated_at: "parent-2",
				}),
			],
			next_parent_ids: null,
			has_more: false,
		})

		const parents = await loadRefreshParentFileItemsFromV2({
			projectId: "project-1",
			parentIds: ["folder"],
			temporaryToken: "token",
		})

		expect(SuperMagicApi.getProjectAttachmentsV2Page).toHaveBeenCalledWith(
			expect.objectContaining({
				projectId: "project-1",
				parentId: "folder",
				temporaryToken: "token",
			}),
			expect.any(Object),
		)
		expect(parents).toEqual([
			expect.objectContaining({
				file_id: "folder",
				updated_at: "parent-2",
			}),
		])
	})

	it("skips children reconcile when ws changes carry explicit file payloads", () => {
		expect(
			shouldSkipParentChildrenReconcileAfterWsApply([
				change({
					operation: "update",
					file_id: "magic",
					file: attachment({
						file_id: "magic",
						parent_id: "folder-b",
						file_name: "magic.project.js",
					}) as SuperMagicFileChangeItem["file"],
				}),
			]),
		).toBe(true)
		expect(
			shouldSkipParentChildrenReconcileAfterWsApply([
				change({ operation: "delete", file_id: "magic" }),
			]),
		).toBe(false)
	})

	it("skips merged parent refresh when only parent updated_at differs", () => {
		const store = createStoreWithParentFolder()
		store.applyFileChanges([
			change({
				file_id: "magic",
				file: attachment({
					file_id: "magic",
					parent_id: "folder",
					file_name: "magic.project.js",
					updated_at: "magic-2",
				}) as SuperMagicFileChangeItem["file"],
			}),
		])

		const result = applyMergedParentRefresh({
			projectId: "project-1",
			parentItemIds: ["folder"],
			parentFileItems: [
				attachment({
					file_id: "folder",
					parent_id: "0",
					file_name: "Project",
					is_directory: true,
					type: "directory",
					updated_at: "parent-2",
				}),
			],
			childrenParentIds: [],
			serverItems: [],
			store: asProjectFilesStore(store),
		})

		expect(result).toBeNull()
		expect(store.workspaceFilesList.find((item) => item.file_id === "folder")?.updated_at).toBe(
			"parent-1",
		)
	})

	it("applies merged parent refresh when parent display config changes", () => {
		const store = createStoreWithParentFolder()
		const result = applyMergedParentRefresh({
			projectId: "project-1",
			parentItemIds: ["folder"],
			parentFileItems: [
				attachment({
					file_id: "folder",
					parent_id: "0",
					file_name: "Project",
					is_directory: true,
					type: "directory",
					updated_at: "parent-1",
					display_config: { icon: "folder-open" },
				}),
			],
			childrenParentIds: [],
			serverItems: [],
			store: asProjectFilesStore(store),
		})

		expect(result?.list.find((item) => item.file_id === "folder")?.display_config).toEqual({
			icon: "folder-open",
		})
	})

	it("collects parent IDs only from file changes", () => {
		const beforeList = [
			attachment({
				file_id: "deleted-file",
				parent_id: "folder-before",
				file_name: "deleted.txt",
			}),
			attachment({
				file_id: "deleted-folder",
				parent_id: "folder-before",
				file_name: "deleted-folder",
				is_directory: true,
			}),
		]

		expect(
			collectFileChangeParentRefreshIds(
				[
					change({
						operation: "add",
						file_id: "new-file",
						file: attachment({
							file_id: "new-file",
							parent_id: "folder",
							file_name: "new.txt",
						}) as SuperMagicFileChangeItem["file"],
					}),
					change({
						operation: "update",
						file_id: "directory",
						file: attachment({
							file_id: "directory",
							parent_id: "folder",
							file_name: "directory",
							is_directory: true,
						}) as SuperMagicFileChangeItem["file"],
					}),
					change({ operation: "delete", file_id: "deleted-file" }),
					change({ operation: "delete", file_id: "deleted-folder" }),
				],
				beforeList,
			),
		).toEqual(["folder", "folder-before"])
	})

	it("recursively loads parent children with v2 next_parent_ids", async () => {
		vi.mocked(SuperMagicApi.getProjectAttachmentsV2Page)
			.mockResolvedValueOnce({
				list: [
					attachment({
						file_id: "folder",
						parent_id: "0",
						file_name: "Project",
						is_directory: true,
					}),
					attachment({
						file_id: "child-folder",
						parent_id: "folder",
						file_name: "Child",
						is_directory: true,
					}),
				],
				next_parent_ids: [
					{
						parent_id: "child-folder",
						after_sort: null,
						after_file_id: null,
					},
				],
				has_more: true,
			})
			.mockResolvedValueOnce({
				list: [
					attachment({
						file_id: "nested-file",
						parent_id: "child-folder",
						file_name: "nested.txt",
					}),
				],
				next_parent_ids: null,
				has_more: false,
			})

		const items = await loadRefreshParentChildrenSubtreeFromV2({
			projectId: "project-1",
			parentIds: ["folder"],
			temporaryToken: "token",
		})

		expect(SuperMagicApi.getProjectAttachmentsV2Page).toHaveBeenNthCalledWith(
			1,
			expect.objectContaining({
				parentId: "folder",
				nextParentIds: undefined,
			}),
			expect.any(Object),
		)
		expect(SuperMagicApi.getProjectAttachmentsV2Page).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({
				parentId: "folder",
				nextParentIds: [
					expect.objectContaining({
						parent_id: "child-folder",
					}),
				],
			}),
			expect.any(Object),
		)
		expect(items.map((item) => item.file_id)).toEqual(["folder", "child-folder", "nested-file"])
	})

	it("accepts refresh-only realtime events", () => {
		const store = createStoreWithParentFolder()
		const resolved = resolveProjectAttachmentsChangeEvent({
			seq: {
				message: {
					type: "super_magic_file_change",
					project_id: "project-1",
					workspace_id: "workspace-1",
					topic_id: "0",
					timestamp: "2026-06-17T10:39:35+08:00",
					changes: [],
					refresh_parent_ids: ["folder"],
				},
			} as never,
			projectId: "project-1",
			enabled: true,
			store: asProjectFilesStore(store),
		})

		expect(resolved).toEqual(
			expect.objectContaining({
				projectId: "project-1",
				messageData: expect.objectContaining({ refresh_parent_ids: ["folder"] }),
			}),
		)
	})

	it("skips merged parent refresh when server parent items match local signatures", () => {
		const store = createStoreWithParentFolder()
		const folder = store.workspaceFilesList.find((item) => item.file_id === "folder")!

		const result = applyMergedParentRefresh({
			projectId: "project-1",
			parentItemIds: ["folder"],
			parentFileItems: [
				attachment({
					file_id: "folder",
					parent_id: "0",
					file_name: "Project",
					is_directory: true,
					type: "directory",
					updated_at: folder.updated_at,
					display_config: folder.display_config,
					metadata: folder.metadata,
				}),
			],
			childrenParentIds: [],
			serverItems: [],
			store: asProjectFilesStore(store),
		})

		expect(result).toBeNull()
	})

	it("applies refreshed parent fileItems without dropping existing children", () => {
		const store = createStoreWithParentFolder()
		store.applyFileChanges([
			change({
				file_id: "magic",
				file: attachment({
					file_id: "magic",
					parent_id: "folder",
					file_name: "magic.project.js",
					updated_at: "magic-2",
				}) as SuperMagicFileChangeItem["file"],
			}),
		])

		const result = applyRefreshParentFileItems({
			projectId: "project-1",
			parentIds: ["folder"],
			parentFileItems: [
				attachment({
					file_id: "folder",
					parent_id: "0",
					file_name: "Project",
					is_directory: true,
					type: "directory",
					updated_at: "parent-2",
					display_config: { icon: "folder-open" },
				}),
			],
			store: asProjectFilesStore(store),
		})

		expect(result?.fallbackRequired).toBe(false)
		expect(
			store.workspaceFilesList.find((item) => item.file_id === "folder")?.display_config,
		).toEqual({ icon: "folder-open" })
		expect(store.workspaceFilesList.find((item) => item.file_id === "magic")?.updated_at).toBe(
			"magic-2",
		)
	})

	it("applies parent children subtree diffs from server snapshot", () => {
		const store = createStoreWithParentSubtree()

		const result = applyRefreshParentChildrenSubtree({
			projectId: "project-1",
			parentIds: ["folder"],
			serverItems: [
				attachment({
					file_id: "folder",
					parent_id: "0",
					file_name: "Project",
					is_directory: true,
					display_config: { type: "design", name: "Project" },
					metadata: { type: "design", name: "Project" },
					updated_at: "parent-2",
				}),
				attachment({
					file_id: "file-existing",
					parent_id: "folder",
					file_name: "existing.txt",
					updated_at: "file-2",
				}),
				attachment({
					file_id: "file-added",
					parent_id: "folder",
					file_name: "added.txt",
					updated_at: "added-1",
				}),
			],
			store: asProjectFilesStore(store),
		})

		expect(result?.fallbackRequired).toBe(false)
		expect(
			store.workspaceFilesList.find((item) => item.file_id === "folder")?.display_config,
		).toEqual({
			type: "design",
			name: "Project",
		})
		expect(store.workspaceFilesList.find((item) => item.file_id === "folder")?.updated_at).toBe(
			"parent-2",
		)
		expect(
			store.workspaceFilesList.find((item) => item.file_id === "file-existing")?.updated_at,
		).toBe("file-2")
		expect(store.workspaceFilesList.some((item) => item.file_id === "file-added")).toBe(true)
		expect(store.workspaceFilesList.some((item) => item.file_id === "file-deleted")).toBe(false)
		expect(
			store.workspaceFilesList.find((item) => item.file_id === "file-added")
				?.relative_file_path,
		).toBe("Project/added.txt")
	})
})
