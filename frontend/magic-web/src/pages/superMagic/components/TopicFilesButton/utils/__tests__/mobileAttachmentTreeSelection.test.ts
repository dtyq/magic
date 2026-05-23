import { describe, expect, it } from "vitest"
import type { AttachmentItem } from "../../hooks/types"
import {
	buildDeleteConfirmHierarchyFromAttachments,
	collectCurrentViewSelectableKeys,
	collectDescendantFileKeys,
	getAttachmentNodeSelectionState,
	summarizeDeleteConfirmHierarchy,
	toggleAllInCurrentView,
	toggleAttachmentSelection,
} from "../mobileAttachmentTreeSelection"
import { getAttachmentKey } from "../getAttachmentKey"

function makeFile(id: string, name: string, parentPath?: string): AttachmentItem {
	return {
		file_id: id,
		file_name: name,
		is_directory: false,
		relative_file_path: parentPath ? `${parentPath}/${name}` : name,
	}
}

function makeFolder(id: string, name: string, children: AttachmentItem[] = []): AttachmentItem {
	return {
		file_id: id,
		file_name: name,
		is_directory: true,
		children,
		relative_file_path: name,
	}
}

describe("mobileAttachmentTreeSelection", () => {
	it("returns none/partial/all for non-empty folder descendant selection", () => {
		const tree = [
			makeFolder("folder-1", "Assets", [
				makeFile("file-1", "a.txt", "Assets"),
				makeFile("file-2", "b.txt", "Assets"),
			]),
		]
		const folder = tree[0]

		expect(getAttachmentNodeSelectionState(folder, new Set())).toBe("none")
		expect(getAttachmentNodeSelectionState(folder, new Set(["file-1"]))).toBe("partial")
		expect(getAttachmentNodeSelectionState(folder, new Set(["file-1", "file-2"]))).toBe("all")
	})

	it("returns none/all for file nodes", () => {
		const file = makeFile("file-1", "readme.md")
		expect(getAttachmentNodeSelectionState(file, new Set())).toBe("none")
		expect(getAttachmentNodeSelectionState(file, new Set(["file-1"]))).toBe("all")
	})

	it("returns none/all for empty folders via folder key", () => {
		const emptyFolder = makeFolder("empty-folder", "EmptyDir", [])
		const folderKey = getAttachmentKey(emptyFolder)

		expect(getAttachmentNodeSelectionState(emptyFolder, new Set())).toBe("none")
		expect(getAttachmentNodeSelectionState(emptyFolder, new Set([folderKey]))).toBe("all")
	})

	it("cascades folder toggle to descendant file keys", () => {
		const tree = [
			makeFolder("folder-1", "Assets", [
				makeFile("file-1", "a.txt", "Assets"),
				makeFile("file-2", "b.txt", "Assets"),
			]),
		]

		const selected = toggleAttachmentSelection(tree[0], new Set())
		expect(collectDescendantFileKeys(tree[0])).toEqual(["file-1", "file-2"])
		expect(selected.has("file-1")).toBe(true)
		expect(selected.has("file-2")).toBe(true)
	})

	it("builds hierarchy groups for folder selections", () => {
		const tree = [
			makeFolder("folder-1", "Assets", [
				makeFile("file-1", "a.txt", "Assets"),
				makeFile("file-2", "b.txt", "Assets"),
			]),
			makeFile("file-3", "readme.md"),
		]

		const selectedIds = new Set(["file-1", "file-2", "file-3"])
		const hierarchy = buildDeleteConfirmHierarchyFromAttachments(tree, selectedIds)
		const summary = summarizeDeleteConfirmHierarchy(hierarchy)

		expect(summary.totalCount).toBe(3)
		expect(summary.folderGroups).toHaveLength(1)
		expect(summary.folderGroups[0].folder.name).toBe("Assets")
		expect(summary.folderGroups[0].files).toHaveLength(2)
		expect(summary.rootFiles).toHaveLength(1)
	})

	it("includes empty folders in delete summary count", () => {
		const tree = [makeFolder("empty-folder", "EmptyDir", [])]
		const selectedIds = new Set([getAttachmentKey(tree[0])])
		const hierarchy = buildDeleteConfirmHierarchyFromAttachments(tree, selectedIds)
		const summary = summarizeDeleteConfirmHierarchy(hierarchy)

		expect(summary.emptyFolders).toHaveLength(1)
		expect(summary.totalCount).toBe(1)
	})

	it("cascades parent folder toggle to nested empty folder keys", () => {
		const memoryFolder = makeFolder("memory-dir", "memory", [])
		const magicFolder = makeFolder("magic-dir", ".magic", [
			memoryFolder,
			makeFile("file-1", "AGENTS.md", ".magic"),
		])

		const selected = toggleAttachmentSelection(magicFolder, new Set())
		const memoryKey = getAttachmentKey(memoryFolder)

		expect(selected.has("file-1")).toBe(true)
		expect(selected.has(memoryKey)).toBe(true)
		expect(getAttachmentNodeSelectionState(memoryFolder, selected)).toBe("all")
	})

	it("reports partial parent state when files but not empty subfolders are selected", () => {
		const memoryFolder = makeFolder("memory-dir", "memory", [])
		const magicFolder = makeFolder("magic-dir", ".magic", [
			memoryFolder,
			makeFile("file-1", "AGENTS.md", ".magic"),
		])
		const memoryKey = getAttachmentKey(memoryFolder)

		expect(getAttachmentNodeSelectionState(magicFolder, new Set(["file-1"]))).toBe("partial")
		expect(
			getAttachmentNodeSelectionState(magicFolder, new Set(["file-1", memoryKey])),
		).toBe("all")
	})

	it("select-all in current view includes sibling empty folders", () => {
		const memoryFolder = makeFolder("memory-dir", "memory", [])
		const currentView = [memoryFolder, makeFile("file-1", "AGENTS.md", ".magic")]
		const selectableKeys = collectCurrentViewSelectableKeys(currentView)
		const selected = toggleAllInCurrentView(selectableKeys, new Set())

		expect(getAttachmentNodeSelectionState(memoryFolder, selected)).toBe("all")
		expect(getAttachmentNodeSelectionState(currentView[1], selected)).toBe("all")
		expect(selectableKeys.every((key) => selected.has(key))).toBe(true)
	})
})
