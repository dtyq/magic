import { describe, expect, it } from "vitest"
import type { AttachmentItem } from "../../hooks/types"
import {
	buildDeleteConfirmHierarchyFromAttachments,
	collectDescendantFileKeys,
	summarizeDeleteConfirmHierarchy,
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
})
