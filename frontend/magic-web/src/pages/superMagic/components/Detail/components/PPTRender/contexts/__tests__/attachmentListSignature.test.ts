import { describe, expect, it } from "vitest"
import { getFolderScopedAttachmentSignature } from "../attachmentListSignature"

const templateA = {
	file_id: "folder-a",
	file_name: "SLIDE-a",
	is_directory: true,
	relative_file_path: "SLIDE-a",
	updated_at: "a-1",
	children: [
		{
			file_id: "slide-a-1",
			file_name: "1.html",
			relative_file_path: "SLIDE-a/slides/1.html",
			updated_at: "a-slide-1",
		},
	],
}

const templateB = {
	file_id: "folder-b",
	file_name: "SLIDE-b",
	is_directory: true,
	relative_file_path: "SLIDE-b",
	updated_at: "b-1",
	children: [
		{
			file_id: "slide-b-1",
			file_name: "1.html",
			relative_file_path: "SLIDE-b/slides/1.html",
			updated_at: "b-slide-1",
		},
	],
}

describe("getFolderScopedAttachmentSignature", () => {
	it("does not change when a sibling template is rewritten", () => {
		const before = getFolderScopedAttachmentSignature([templateA, templateB], "folder-b")
		const after = getFolderScopedAttachmentSignature(
			[
				{
					...templateA,
					updated_at: "a-2",
					children: [
						{
							...templateA.children[0],
							updated_at: "a-slide-rewritten",
						},
					],
				},
				templateB,
			],
			"folder-b",
		)

		expect(after).toBe(before)
	})

	it("changes when this template's own files change", () => {
		const before = getFolderScopedAttachmentSignature([templateA, templateB], "folder-b")
		const after = getFolderScopedAttachmentSignature(
			[
				templateA,
				{
					...templateB,
					children: [
						{
							...templateB.children[0],
							updated_at: "b-slide-rewritten",
						},
					],
				},
			],
			"folder-b",
		)

		expect(after).not.toBe(before)
	})

	it("changes when nested HTML without relative_file_path is rewritten", () => {
		const template = {
			file_id: "folder-b",
			file_name: "SLIDE-b",
			is_directory: true,
			relative_file_path: "SLIDE-b",
			updated_at: "b-1",
			children: [
				{
					file_id: "slides-dir",
					file_name: "slides",
					is_directory: true,
					children: [
						{
							file_id: "slide-b-1",
							file_name: "1.html",
							updated_at: "b-slide-1",
						},
					],
				},
			],
		}

		const before = getFolderScopedAttachmentSignature([template], "folder-b")
		const after = getFolderScopedAttachmentSignature(
			[
				{
					...template,
					children: [
						{
							...template.children[0],
							children: [
								{
									...template.children[0].children[0],
									updated_at: "b-slide-rewritten",
								},
							],
						},
					],
				},
			],
			"folder-b",
		)

		expect(after).not.toBe(before)
	})
})
