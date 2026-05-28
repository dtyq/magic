import { describe, expect, it } from "vitest"
import type { AttachmentItem } from "../../hooks/types"
import { getAttachmentKey } from "../getAttachmentKey"
import { normalizeSelectionIdsForShare } from "../normalizeSelectionIdsForShare"
import { toggleAttachmentSelection } from "../mobileAttachmentTreeSelection"

function makeFile(fileId: string, name: string): AttachmentItem {
	return {
		file_id: fileId,
		name,
		file_name: name,
		is_directory: false,
	}
}

function makeFolder(
	fileId: string,
	name: string,
	children: AttachmentItem[] = [],
): AttachmentItem {
	return {
		file_id: fileId,
		name,
		file_name: name,
		is_directory: true,
		children,
	}
}

describe("normalizeSelectionIdsForShare", () => {
	it("collapses a fully selected folder into its folder id", () => {
		const tree = [
			makeFolder("folder-1", "Assets", [
				makeFile("file-1", "a.html"),
				makeFile("file-2", "b.html"),
			]),
		]

		const selectedKeys = toggleAttachmentSelection(tree[0], new Set())
		const normalized = normalizeSelectionIdsForShare(tree, selectedKeys)

		expect(normalized).toEqual(["folder-1"])
	})

	it("keeps partial folder selection as individual file ids", () => {
		const tree = [
			makeFolder("folder-1", "Assets", [
				makeFile("file-1", "a.html"),
				makeFile("file-2", "b.html"),
			]),
		]

		const normalized = normalizeSelectionIdsForShare(tree, new Set(["file-1"]))

		expect(normalized).toEqual(["file-1"])
	})

	it("collapses nested folders independently", () => {
		const tree = [
			makeFolder("folder-1", "Root", [
				makeFolder("folder-2", "Nested", [makeFile("file-1", "inner.html")]),
				makeFile("file-2", "outer.html"),
			]),
		]

		const selectedKeys = toggleAttachmentSelection(tree[0], new Set())
		const normalized = normalizeSelectionIdsForShare(tree, selectedKeys)

		expect(normalized).toEqual(["folder-1"])
	})

	it("returns empty folder id when only the empty folder is selected", () => {
		const tree = [makeFolder("empty-folder", "Empty", [])]
		const folderKey = getAttachmentKey(tree[0])
		const normalized = normalizeSelectionIdsForShare(tree, new Set([folderKey]))

		expect(normalized).toEqual(["empty-folder"])
	})

	it("merges root file with a fully selected sibling folder", () => {
		const tree = [
			makeFile("file-root", "readme.md"),
			makeFolder("folder-1", "Assets", [makeFile("file-1", "a.html")]),
		]

		const folderSelected = toggleAttachmentSelection(tree[1], new Set(["file-root"]))
		const normalized = normalizeSelectionIdsForShare(tree, folderSelected)

		expect(normalized).toEqual(["file-root", "folder-1"])
	})
})
