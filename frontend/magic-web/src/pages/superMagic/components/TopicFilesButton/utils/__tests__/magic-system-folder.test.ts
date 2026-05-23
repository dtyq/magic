import { describe, expect, test } from "vitest"
import type { AttachmentItem } from "../../hooks/types"
import {
	hasMagicSystemFolderInDeletionSelection,
	isMagicSystemFolder,
	isNodeUnderMagicSystemFolder,
	resolveBatchDeleteConfirmContentKey,
	resolveMagicDeleteWarningVariant,
	resolveSingleDeleteConfirmContentKey,
} from "../magic-system-folder"

describe("isMagicSystemFolder", () => {
	test("directory named .magic is system folder", () => {
		const item: AttachmentItem = {
			is_directory: true,
			name: ".magic",
		}
		expect(isMagicSystemFolder(item)).toBe(true)
	})

	test("regular directory is not magic", () => {
		const item: AttachmentItem = {
			is_directory: true,
			name: "docs",
		}
		expect(isMagicSystemFolder(item)).toBe(false)
	})

	test("non-directory named .magic is not magic folder", () => {
		const item: AttachmentItem = {
			is_directory: false,
			name: ".magic",
			file_extension: "magic",
		}
		expect(isMagicSystemFolder(item)).toBe(false)
	})

	test("path /.magic qualifies as magic directory", () => {
		const item: AttachmentItem = {
			is_directory: true,
			relative_file_path: "/.magic",
		}
		expect(isMagicSystemFolder(item)).toBe(true)
	})

	test("subfolder under .magic is not magic root (_leaf_ name differs)", () => {
		const item: AttachmentItem = {
			is_directory: true,
			name: "skills",
			relative_file_path: "/.magic/skills",
		}
		expect(isMagicSystemFolder(item)).toBe(false)
	})
})

describe("hasMagicSystemFolderInDeletionSelection", () => {
	const id = (x: AttachmentItem): string => x.file_id ?? ""

	test("detects directly selected .magic folder", () => {
		const magic: AttachmentItem = {
			file_id: "m1",
			is_directory: true,
			name: ".magic",
			children: [],
		}
		const plain: AttachmentItem = { file_id: "f1", name: "a.txt", is_directory: false }
		expect(hasMagicSystemFolderInDeletionSelection([magic, plain], new Set(["m1"]), id)).toBe(
			true,
		)
		expect(hasMagicSystemFolderInDeletionSelection([magic, plain], new Set(["f1"]), id)).toBe(
			false,
		)
	})

	test("detects ancestor selection whose subtree contains .magic", () => {
		const tree: AttachmentItem[] = [
			{
				file_id: "root",
				is_directory: true,
				name: "src",
				children: [
					{
						file_id: "magic",
						is_directory: true,
						name: ".magic",
						children: [],
					},
				],
			},
		]
		expect(hasMagicSystemFolderInDeletionSelection(tree, new Set(["root"]), id)).toBe(true)
		expect(hasMagicSystemFolderInDeletionSelection(tree, new Set(["magic"]), id)).toBe(true)
	})

	test("no selection spanning .magic yields false", () => {
		const tree: AttachmentItem[] = [
			{
				file_id: "root",
				is_directory: true,
				name: "src",
				children: [{ file_id: "other", is_directory: true, name: "lib", children: [] }],
			},
		]
		expect(hasMagicSystemFolderInDeletionSelection(tree, new Set(["other"]), id)).toBe(false)
	})

	test("detects cascade-selected files under .magic without selecting folder id", () => {
		const tree: AttachmentItem[] = [
			{
				file_id: "magic-dir",
				is_directory: true,
				name: ".magic",
				children: [
					{
						file_id: "memory-dir",
						is_directory: true,
						name: "memory",
						children: [
							{
								file_id: "mem-file",
								is_directory: false,
								name: "state.json",
								relative_file_path: "/.magic/memory/state.json",
							},
						],
					},
					{
						file_id: "cfg-file",
						is_directory: false,
						name: "config.json",
						relative_file_path: "/.magic/config.json",
					},
				],
			},
		]
		expect(hasMagicSystemFolderInDeletionSelection(tree, new Set(["mem-file"]), id)).toBe(true)
		expect(hasMagicSystemFolderInDeletionSelection(tree, new Set(["cfg-file", "mem-file"]), id)).toBe(
			true,
		)
		expect(hasMagicSystemFolderInDeletionSelection(tree, new Set(["magic-dir"]), id)).toBe(true)
	})
})

describe("isNodeUnderMagicSystemFolder", () => {
	test("file under .magic path is under magic subtree", () => {
		const file: AttachmentItem = {
			file_id: "f1",
			is_directory: false,
			name: "state.json",
			relative_file_path: "/.magic/memory/state.json",
		}
		expect(isNodeUnderMagicSystemFolder(file)).toBe(true)
	})

	test("sibling folder outside .magic is not under magic subtree", () => {
		const folder: AttachmentItem = {
			file_id: "n1",
			is_directory: true,
			name: "Notes",
			relative_file_path: "/Notes",
		}
		expect(isNodeUnderMagicSystemFolder(folder)).toBe(false)
	})
})

describe("resolveMagicDeleteWarningVariant", () => {
	const id = (x: AttachmentItem): string => x.file_id ?? ""

	const magicTree: AttachmentItem[] = [
		{
			file_id: "magic-dir",
			is_directory: true,
			name: ".magic",
			children: [
				{
					file_id: "f1",
					is_directory: false,
					name: "a.json",
					relative_file_path: "/.magic/a.json",
				},
			],
		},
		{
			file_id: "notes",
			is_directory: true,
			name: "Notes",
			children: [{ file_id: "n1", is_directory: false, name: "readme.md" }],
		},
	]

	test("returns none when selection does not touch .magic", () => {
		expect(resolveMagicDeleteWarningVariant(magicTree, new Set(["n1"]), id)).toBe("none")
	})

	test("returns single when only files under .magic are selected", () => {
		expect(resolveMagicDeleteWarningVariant(magicTree, new Set(["f1"]), id)).toBe("single")
	})

	test("returns multi when .magic contents are mixed with other folders", () => {
		expect(resolveMagicDeleteWarningVariant(magicTree, new Set(["f1", "n1"]), id)).toBe("multi")
	})
})

describe("resolveSingleDeleteConfirmContentKey", () => {
	test("prefers magic-folder warning over generic folder delete copy", () => {
		expect(
			resolveSingleDeleteConfirmContentKey({
				isFolder: true,
				isMagicFolder: true,
			}),
		).toBe("topicFiles.contextMenu.deleteMagicFolderContent")
	})

	test("uses folder copy for non-magic folders", () => {
		expect(
			resolveSingleDeleteConfirmContentKey({
				isFolder: true,
				isMagicFolder: false,
			}),
		).toBe("topicFiles.contextMenu.deleteFolderContent")
	})

	test("uses file copy for files", () => {
		expect(
			resolveSingleDeleteConfirmContentKey({
				isFolder: false,
				isMagicFolder: false,
			}),
		).toBe("topicFiles.contextMenu.deleteFileDescription")
	})
})

describe("resolveBatchDeleteConfirmContentKey", () => {
	test("prefers magic-folder warning over generic batch copy", () => {
		expect(
			resolveBatchDeleteConfirmContentKey({
				containsFolders: true,
				touchesMagicFolder: true,
			}),
		).toBe("topicFiles.contextMenu.confirmBatchDeleteWithMagicSystemFolder")
	})

	test("uses folder batch copy when selection contains folders", () => {
		expect(
			resolveBatchDeleteConfirmContentKey({
				containsFolders: true,
				touchesMagicFolder: false,
			}),
		).toBe("topicFiles.contextMenu.confirmBatchDeleteWithFolders")
	})

	test("uses generic batch copy for file-only selection", () => {
		expect(
			resolveBatchDeleteConfirmContentKey({
				containsFolders: false,
				touchesMagicFolder: false,
			}),
		).toBe("topicFiles.contextMenu.confirmBatchDelete")
	})
})
