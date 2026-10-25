import { describe, expect, it, vi } from "vitest"
import type { SuperMagicFileChangeItem } from "@/types/chat/intermediate_message"
import type { FileItem } from "../../../components/Detail/components/FilesViewer/types"
import type { AttachmentItem } from "../../../components/TopicFilesButton/hooks"
import { applyProjectAttachmentsChangesToTree } from "../changeReducer"
import { flattenAttachmentTree } from "../treeUtils"

vi.mock("../../attachmentDataProcessor", () => ({
	AttachmentDataProcessor: {
		processAttachmentData: vi.fn(({ tree }: { tree: AttachmentItem[] }) => ({
			tree,
			list: flattenAttachmentTree(tree),
		})),
	},
}))

import { AttachmentDataProcessor } from "../../attachmentDataProcessor"

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
		operation: "add",
		file_id: "",
		...overrides,
	} as SuperMagicFileChangeItem
}

describe("applyProjectAttachmentsChangesToTree", () => {
	it("adds files under an existing parent and keeps directory-first natural sorting", () => {
		const tree = [
			attachment({
				file_id: "folder",
				file_name: "Docs",
				is_directory: true,
				type: "directory",
				children: [
					attachment({ file_id: "file10", parent_id: "folder", file_name: "file10.txt" }),
				],
			}),
		]

		const result = applyProjectAttachmentsChangesToTree(tree, [
			change({
				operation: "add",
				file_id: "file2",
				file: attachment({
					file_id: "file2",
					parent_id: "folder",
					file_name: "file2.txt",
				}) as unknown as FileItem,
			}),
		])

		expect(result.fallbackRequired).toBe(false)
		expect(result.tree[0].children?.map((item) => item.file_id)).toEqual(["file2", "file10"])
		expect(result.list.map((item) => item.file_id)).toEqual(["folder", "file2", "file10"])
	})

	it("skips display_config reprocess for regular file move updates", () => {
		vi.mocked(AttachmentDataProcessor.processAttachmentData).mockClear()
		const tree = [
			attachment({
				file_id: "folder",
				file_name: "Docs",
				is_directory: true,
				type: "directory",
				children: [
					attachment({ file_id: "file1", parent_id: "folder", file_name: "a.txt" }),
				],
			}),
		]

		const result = applyProjectAttachmentsChangesToTree(tree, [
			change({
				operation: "update",
				file_id: "file1",
				file: attachment({
					file_id: "file1",
					parent_id: "folder",
					file_name: "a.txt",
					updated_at: "2",
				}) as unknown as FileItem,
			}),
		])

		expect(result.fallbackRequired).toBe(false)
		expect(AttachmentDataProcessor.processAttachmentData).not.toHaveBeenCalled()
	})

	it("updates an existing file without changing siblings", () => {
		const tree = [
			attachment({ file_id: "a", file_name: "a.txt", updated_at: "1" }),
			attachment({ file_id: "b", file_name: "b.txt", updated_at: "1" }),
		]

		const result = applyProjectAttachmentsChangesToTree(tree, [
			change({
				operation: "update",
				file_id: "b",
				file: attachment({
					file_id: "b",
					file_name: "b.txt",
					updated_at: "2",
				}) as unknown as FileItem,
			}),
		])

		expect(result.fallbackRequired).toBe(false)
		expect(result.list.find((item) => item.file_id === "b")?.updated_at).toBe("2")
		expect(result.list.map((item) => item.file_id)).toEqual(["a", "b"])
	})

	it("applies repeated updates without duplicating the node", () => {
		const tree = [
			attachment({ file_id: "a", file_name: "a.txt", updated_at: "1" }),
			attachment({ file_id: "b", file_name: "b.txt", updated_at: "1" }),
		]

		const result = applyProjectAttachmentsChangesToTree(tree, [
			change({
				operation: "update",
				file_id: "b",
				file: attachment({
					file_id: "b",
					file_name: "b.txt",
					updated_at: "2",
				}) as unknown as FileItem,
			}),
			change({
				operation: "update",
				file_id: "b",
				file: attachment({
					file_id: "b",
					file_name: "b.txt",
					updated_at: "3",
				}) as unknown as FileItem,
			}),
		])

		expect(result.fallbackRequired).toBe(false)
		expect(result.list.filter((item) => item.file_id === "b")).toHaveLength(1)
		expect(result.list.find((item) => item.file_id === "b")?.updated_at).toBe("3")
		expect(result.list.map((item) => item.file_id)).toEqual(["a", "b"])
	})

	it("keeps directory children when only directory metadata changes", () => {
		const tree = [
			attachment({
				file_id: "folder",
				file_name: "Docs",
				is_directory: true,
				type: "directory",
				updated_at: "1",
				children: [
					attachment({ file_id: "file", parent_id: "folder", file_name: "file.txt" }),
				],
			}),
		]

		const result = applyProjectAttachmentsChangesToTree(tree, [
			change({
				operation: "update",
				file_id: "folder",
				file: attachment({
					file_id: "folder",
					file_name: "Docs",
					is_directory: true,
					type: "directory",
					updated_at: "2",
				}) as unknown as FileItem,
			}),
		])

		expect(result.fallbackRequired).toBe(false)
		expect(result.tree[0].updated_at).toBe("2")
		expect(result.tree[0].children?.map((item) => item.file_id)).toEqual(["file"])
		expect(result.list.map((item) => item.file_id)).toEqual(["folder", "file"])
	})

	it("applies parent and child additions from the same batch", () => {
		const result = applyProjectAttachmentsChangesToTree(
			[],
			[
				change({
					operation: "add",
					file_id: "folder",
					file: attachment({
						file_id: "folder",
						file_name: "Docs",
						is_directory: true,
						type: "directory",
					}) as unknown as FileItem,
				}),
				change({
					operation: "add",
					file_id: "file",
					file: attachment({
						file_id: "file",
						parent_id: "folder",
						file_name: "file.txt",
					}) as unknown as FileItem,
				}),
			],
		)

		expect(result.fallbackRequired).toBe(false)
		expect(result.tree[0].children?.map((item) => item.file_id)).toEqual(["file"])
		expect(result.list.map((item) => item.file_id)).toEqual(["folder", "file"])
	})

	it("deletes files without requiring the optional file payload", () => {
		const tree = [
			attachment({
				file_id: "folder",
				is_directory: true,
				type: "directory",
				children: [
					attachment({ file_id: "file", parent_id: "folder", file_name: "file.txt" }),
				],
			}),
		]

		const result = applyProjectAttachmentsChangesToTree(tree, [
			change({ operation: "delete", file_id: "file" }),
		])

		expect(result.fallbackRequired).toBe(false)
		expect(result.list.map((item) => item.file_id)).toEqual(["folder"])
	})

	it("removes an item when an update marks it hidden", () => {
		const tree = [attachment({ file_id: "file", file_name: "file.txt" })]

		const result = applyProjectAttachmentsChangesToTree(tree, [
			change({
				operation: "update",
				file_id: "file",
				file: attachment({
					file_id: "file",
					file_name: "file.txt",
					is_hidden: true,
				}) as unknown as FileItem,
			}),
		])

		expect(result.fallbackRequired).toBe(false)
		expect(result.tree).toEqual([])
		expect(result.list).toEqual([])
	})

	it("deletes a directory subtree from a batch delete change", () => {
		const tree = [
			attachment({
				file_id: "folder",
				is_directory: true,
				type: "directory",
				children: [
					attachment({ file_id: "file", parent_id: "folder", file_name: "file.txt" }),
				],
			}),
			attachment({ file_id: "keep", file_name: "keep.txt" }),
		]

		const result = applyProjectAttachmentsChangesToTree(tree, [
			change({ operation: "delete", file_id: "folder" }),
		])

		expect(result.fallbackRequired).toBe(false)
		expect(result.list.map((item) => item.file_id)).toEqual(["keep"])
	})

	it("requires fallback when an add references a missing parent", () => {
		const tree = [attachment({ file_id: "existing", file_name: "existing.txt" })]

		const result = applyProjectAttachmentsChangesToTree(tree, [
			change({
				operation: "add",
				file_id: "file",
				file: attachment({
					file_id: "file",
					parent_id: "missing",
					file_name: "file.txt",
				}) as unknown as FileItem,
			}),
		])

		expect(result.fallbackRequired).toBe(true)
		expect(result.fallbackReason).toBe("parent_missing")
		expect(result.list.map((item) => item.file_id)).toEqual(["existing"])
	})

	it("adds root files when parent_id points to the hidden root container", () => {
		const tree = [
			attachment({
				file_id: "existing",
				parent_id: "hidden-root",
				file_name: "existing.txt",
			}),
		]

		const result = applyProjectAttachmentsChangesToTree(tree, [
			change({
				operation: "add",
				file_id: "new-file",
				file: attachment({
					file_id: "new-file",
					parent_id: "hidden-root",
					file_name: "new-file.txt",
				}) as unknown as FileItem,
			}),
		])

		expect(result.fallbackRequired).toBe(false)
		expect(result.tree.map((item) => item.file_id)).toEqual(["existing", "new-file"])
	})

	it("updates a renamed directory and rewrites descendant paths without fallback", () => {
		const tree = [
			attachment({
				file_id: "folder",
				file_name: "Old",
				relative_file_path: "Old",
				is_directory: true,
				type: "directory",
				children: [
					attachment({
						file_id: "file",
						parent_id: "folder",
						file_name: "file.txt",
						relative_file_path: "Old/file.txt",
					}),
				],
			}),
		]

		const result = applyProjectAttachmentsChangesToTree(tree, [
			change({
				operation: "update",
				file_id: "folder",
				file: attachment({
					file_id: "folder",
					file_name: "New",
					relative_file_path: "New",
					is_directory: true,
					type: "directory",
				}) as unknown as FileItem,
			}),
		])

		expect(result.fallbackRequired).toBe(false)
		expect(result.list.find((item) => item.file_id === "folder")?.relative_file_path).toBe(
			"New",
		)
		expect(result.list.find((item) => item.file_id === "file")?.relative_file_path).toBe(
			"New/file.txt",
		)
		expect(result.list.map((item) => item.file_id)).toEqual(["folder", "file"])
	})

	it("does not treat a missing incoming directory path as a structural update", () => {
		const tree = [
			attachment({
				file_id: "folder",
				file_name: "Docs",
				relative_file_path: "Docs",
				is_directory: true,
				type: "directory",
				updated_at: "1",
				children: [
					attachment({
						file_id: "file",
						parent_id: "folder",
						file_name: "file.txt",
						relative_file_path: "Docs/file.txt",
					}),
				],
			}),
		]

		const result = applyProjectAttachmentsChangesToTree(tree, [
			change({
				operation: "update",
				file_id: "folder",
				file: attachment({
					file_id: "folder",
					file_name: "Docs",
					is_directory: true,
					type: "directory",
					updated_at: "2",
				}) as unknown as FileItem,
			}),
		])

		expect(result.fallbackRequired).toBe(false)
		expect(result.list.find((item) => item.file_id === "folder")?.updated_at).toBe("2")
		expect(result.list.find((item) => item.file_id === "file")?.relative_file_path).toBe(
			"Docs/file.txt",
		)
	})

	it("moves a directory to another parent and rewrites descendant paths", () => {
		const tree = [
			attachment({
				file_id: "source",
				file_name: "Source",
				relative_file_path: "Source",
				is_directory: true,
				type: "directory",
				children: [
					attachment({
						file_id: "folder",
						parent_id: "source",
						file_name: "Folder",
						relative_file_path: "Source/Folder",
						is_directory: true,
						type: "directory",
						children: [
							attachment({
								file_id: "file",
								parent_id: "folder",
								file_name: "file.txt",
								relative_file_path: "Source/Folder/file.txt",
							}),
						],
					}),
				],
			}),
			attachment({
				file_id: "target",
				file_name: "Target",
				relative_file_path: "Target",
				is_directory: true,
				type: "directory",
			}),
		]

		const result = applyProjectAttachmentsChangesToTree(tree, [
			change({
				operation: "update",
				file_id: "folder",
				file: attachment({
					file_id: "folder",
					parent_id: "target",
					file_name: "Folder",
					is_directory: true,
					type: "directory",
				}) as unknown as FileItem,
			}),
		])

		expect(result.fallbackRequired).toBe(false)
		expect(result.tree.find((item) => item.file_id === "source")?.children).toEqual([])
		expect(
			result.tree
				.find((item) => item.file_id === "target")
				?.children?.map((item) => item.file_id),
		).toEqual(["folder"])
		expect(result.list.find((item) => item.file_id === "folder")?.relative_file_path).toBe(
			"Target/Folder",
		)
		expect(result.list.find((item) => item.file_id === "file")?.relative_file_path).toBe(
			"Target/Folder/file.txt",
		)
	})

	it("orders same-batch parent and child additions by dependency", () => {
		const result = applyProjectAttachmentsChangesToTree(
			[],
			[
				change({
					operation: "add",
					file_id: "file",
					file: attachment({
						file_id: "file",
						parent_id: "folder",
						file_name: "file.txt",
					}) as unknown as FileItem,
				}),
				change({
					operation: "add",
					file_id: "folder",
					file: attachment({
						file_id: "folder",
						file_name: "Docs",
						is_directory: true,
						type: "directory",
					}) as unknown as FileItem,
				}),
			],
		)

		expect(result.fallbackRequired).toBe(false)
		expect(result.tree[0].children?.map((item) => item.file_id)).toEqual(["file"])
		expect(result.list.map((item) => item.file_id)).toEqual(["folder", "file"])
	})
})
