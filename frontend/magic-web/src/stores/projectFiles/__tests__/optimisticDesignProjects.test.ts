import { describe, expect, it } from "vitest"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"
import type { SuperMagicFileChangeItem } from "@/types/chat/intermediate_message"
import { ProjectFilesStore } from "../index"
import {
	applyOptimisticDesignProjects,
	createOptimisticDesignProject,
	reconcileOptimisticDesignProjectSnapshot,
} from "../optimisticDesignProjects"

function directory(fileId: string, name: string, children: AttachmentItem[] = []): AttachmentItem {
	return {
		file_id: fileId,
		file_name: name,
		name,
		parent_id: "",
		type: "directory",
		is_directory: true,
		relative_file_path: name,
		children,
	}
}

function entry(overrides: Partial<ReturnType<typeof createOptimisticDesignProject>> = {}) {
	return {
		...createOptimisticDesignProject({
			workspaceKind: "project",
			projectId: "project-1",
			folderId: "canvas-1",
			configFileId: "config-1",
			parentId: "",
			folderName: "Canvas",
			status: "confirmed",
			createdAt: 1,
		}),
		...overrides,
	}
}

function register(store: ProjectFilesStore, status: "confirmed" | "ambiguous" = "confirmed") {
	store.registerCreatedDesignProject({
		projectId: "project-1",
		folderId: "canvas-1",
		configFileId: "config-1",
		parentId: "",
		folderName: "Canvas",
		status,
	})
}

function configFile(): AttachmentItem {
	return {
		file_id: "config-1",
		file_name: "magic.project.js",
		parent_id: "canvas-1",
		type: "file",
		is_directory: false,
	}
}

describe("optimistic Canvas display_config overlay", () => {
	it("atomically inserts a root Canvas and magic.project.js into tree and list", () => {
		const result = applyOptimisticDesignProjects([], [entry()], 2)

		expect(result.tree[0]).toMatchObject({
			file_id: "canvas-1",
			type: "directory",
			display_config: { type: "design", name: "Canvas" },
		})
		expect(result.list?.map((item) => item.file_id)).toEqual(["canvas-1", "config-1"])
		expect(result.tree[0].children?.[0]).toMatchObject({
			file_id: "config-1",
			parent_id: "canvas-1",
			type: "file",
			relative_file_path: "Canvas/magic.project.js",
		})
	})

	it("inserts under a stable nested parent and derives child paths", () => {
		const parent = directory("parent-1", "Parent")
		const result = applyOptimisticDesignProjects([parent], [entry({ parentId: "parent-1" })], 2)

		const canvas = result.tree[0].children?.find((item) => item.file_id === "canvas-1")
		expect(canvas?.relative_file_path).toBe("Parent/Canvas")
		expect(canvas?.children?.[0].relative_file_path).toBe("Parent/Canvas/magic.project.js")
	})

	it("upserts an existing server folder without duplicating ids", () => {
		const serverFolder = directory("canvas-1", "Renamed")
		serverFolder.parent_id = "parent-2"
		serverFolder.display_config = { description: "server-owned" }
		const result = applyOptimisticDesignProjects([serverFolder], [entry()], 2)

		expect(result.list?.filter((item) => item.file_id === "canvas-1")).toHaveLength(1)
		expect(result.tree[0]).toMatchObject({
			file_name: "Renamed",
			parent_id: "parent-2",
			display_config: {
				type: "design",
				name: "Renamed",
				description: "server-owned",
			},
		})
	})

	it("deduplicates config ids and requires magic.project.js to be a direct child", () => {
		const nestedConfig = configFile()
		const nestedFolder = directory("nested", "Nested", [nestedConfig])
		const serverFolder = directory("canvas-1", "Canvas", [nestedFolder])
		serverFolder.display_config = { type: "design", name: "Canvas" }

		const result = applyOptimisticDesignProjects([serverFolder], [entry()], 2)
		const directConfigs = result.tree[0].children?.filter((item) => item.file_id === "config-1")

		expect(directConfigs).toHaveLength(1)
		expect(reconcileOptimisticDesignProjectSnapshot(entry(), [serverFolder], 2)).toBe("pending")

		const duplicateConfigFolder = directory("canvas-1", "Canvas", [configFile(), configFile()])
		const deduplicated = applyOptimisticDesignProjects([duplicateConfigFolder], [entry()], 2)
		expect(
			deduplicated.tree[0].children?.filter((item) => item.file_id === "config-1"),
		).toHaveLength(1)
	})

	it("never overrides a conflicting server content type", () => {
		const serverFolder = directory("canvas-1", "Canvas")
		serverFolder.display_config = { type: "custom" }
		const result = applyOptimisticDesignProjects([serverFolder], [entry()], 2)

		expect(result.tree[0].display_config).toEqual({ type: "custom" })
	})

	it("does not render an ambiguous creation before server confirmation", () => {
		const result = applyOptimisticDesignProjects([], [entry({ status: "ambiguous" })], 2)

		expect(result.changed).toBe(false)
		expect(result.tree).toEqual([])
	})

	it("releases the overlay only after folder metadata and config child are both present", () => {
		const optimistic = entry()
		const folderWithoutChild = directory("canvas-1", "Canvas")
		folderWithoutChild.display_config = { type: "design", name: "Canvas" }
		expect(reconcileOptimisticDesignProjectSnapshot(optimistic, [folderWithoutChild], 2)).toBe(
			"pending",
		)

		folderWithoutChild.children = [
			{
				file_id: "config-1",
				file_name: "magic.project.js",
				parent_id: "canvas-1",
				is_directory: false,
			},
		]
		expect(reconcileOptimisticDesignProjectSnapshot(optimistic, [folderWithoutChild], 2)).toBe(
			"server-confirmed",
		)
	})
})

describe("ProjectFilesStore optimistic Canvas reconciliation", () => {
	it("registers the folder and config file into the same tree/list commit", () => {
		const store = new ProjectFilesStore()

		register(store)

		expect(store.workspaceFileTree[0]).toMatchObject({
			file_id: "canvas-1",
			display_config: { type: "design", name: "Canvas" },
		})
		expect(store.workspaceFilesList.map((item) => item.file_id)).toEqual([
			"canvas-1",
			"config-1",
		])
	})

	it("keeps a confirmed overlay across stale snapshots, then expires after three refreshes", () => {
		const store = new ProjectFilesStore()
		register(store)

		store.setWorkspaceFileTree([], { source: "test-refresh-1" })
		store.setWorkspaceFileTree([], { source: "test-refresh-2" })
		expect(store.workspaceFilesList.some((item) => item.file_id === "canvas-1")).toBe(true)

		store.setWorkspaceFileTree([], { source: "test-refresh-3" })
		expect(store.workspaceFileTree).toEqual([])
		expect(store.workspaceFilesList).toEqual([])
	})

	it("does not mistake optimistic children for server confirmation after an unrelated WS update", () => {
		const store = new ProjectFilesStore()
		register(store)

		store.applyFileChanges(
			[
				{
					operation: "update",
					file_id: "canvas-1",
					file: {
						file_id: "canvas-1",
						file_name: "Renamed Canvas",
						parent_id: "",
						is_directory: true,
						type: "directory",
					} as SuperMagicFileChangeItem["file"],
				},
			],
			{ applySource: "ws_realtime" },
		)
		store.setWorkspaceFileTree([], { source: "test-refresh-1" })

		expect(store.workspaceFileTree[0]).toMatchObject({
			file_id: "canvas-1",
			file_name: "Renamed Canvas",
			display_config: { type: "design", name: "Renamed Canvas" },
		})
		expect(store.workspaceFilesList.some((item) => item.file_id === "config-1")).toBe(true)
	})

	it("keeps registry ownership across a local rename projection", () => {
		const store = new ProjectFilesStore()
		register(store)
		const locallyRenamed = {
			...store.workspaceFileTree[0],
			file_name: "Locally Renamed",
			name: "Locally Renamed",
		}

		store.setWorkspaceFileTree([locallyRenamed], {
			source: "test-local-mutation",
			authoritative: false,
		})
		store.setWorkspaceFileTree([], { source: "test-refresh-1" })

		expect(store.workspaceFileTree[0]).toMatchObject({
			file_name: "Locally Renamed",
			display_config: { type: "design", name: "Locally Renamed" },
		})
	})

	it.each(["canvas-1", "config-1"])(
		"clears the overlay after an explicit delete of %s",
		(fileId) => {
			const store = new ProjectFilesStore()
			register(store)

			store.applyFileChanges([{ operation: "delete", file_id: fileId }], {
				applySource: "ws_realtime",
			})

			const folder = store.workspaceFilesList.find((item) => item.file_id === "canvas-1")
			if (fileId === "canvas-1") {
				expect(folder).toBeUndefined()
			} else {
				expect(folder?.display_config?.type).toBeUndefined()
				expect(store.workspaceFilesList.some((item) => item.file_id === "config-1")).toBe(
					false,
				)
			}
		},
	)

	it("hands off to a complete server Canvas and no longer restores an older missing snapshot", () => {
		const store = new ProjectFilesStore()
		register(store)
		const serverFolder = directory("canvas-1", "Server Canvas", [configFile()])
		serverFolder.display_config = { type: "design", name: "Server Canvas" }

		store.setWorkspaceFileTree([serverFolder], { source: "test-server-confirmation" })
		expect(store.workspaceFileTree[0]).toBe(serverFolder)

		store.setWorkspaceFileTree([], { source: "test-older-snapshot" })
		expect(store.workspaceFileTree).toEqual([])
	})

	it("does not overlay an ambiguous result and releases recovery after server confirmation", () => {
		const store = new ProjectFilesStore()
		register(store, "ambiguous")
		expect(store.workspaceFileTree).toEqual([])

		const serverFolder = directory("canvas-1", "Server Canvas", [configFile()])
		serverFolder.display_config = { type: "design", name: "Server Canvas" }
		store.setWorkspaceFileTree([serverFolder], { source: "test-server-confirmation" })
		expect(store.workspaceFileTree[0]).toBe(serverFolder)

		store.setWorkspaceFileTree([], { source: "test-older-snapshot" })
		expect(store.workspaceFileTree).toEqual([])
	})

	it("keeps a conflicting server type authoritative and stops restoring Canvas metadata", () => {
		const store = new ProjectFilesStore()
		register(store)
		const serverFolder = directory("canvas-1", "Server Folder")
		serverFolder.display_config = { type: "custom" }

		store.setWorkspaceFileTree([serverFolder], { source: "test-conflict" })
		expect(store.workspaceFileTree[0].display_config).toEqual({ type: "custom" })

		store.setWorkspaceFileTree([], { source: "test-older-snapshot" })
		expect(store.workspaceFileTree).toEqual([])
	})
})
