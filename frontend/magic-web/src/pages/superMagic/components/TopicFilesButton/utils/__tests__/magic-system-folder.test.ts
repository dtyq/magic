import { describe, expect, test } from "vitest"
import type { AttachmentItem } from "../../hooks/types"
import {
	hasMagicSystemFolderInDeletionSelection,
	isMagicSystemFolder,
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
})
