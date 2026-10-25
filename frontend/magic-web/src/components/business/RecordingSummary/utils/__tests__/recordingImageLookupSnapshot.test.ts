import { describe, expect, it } from "vitest"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks"
import {
	findRecordingImagesFolderId,
	getVisibleRecordingAttachmentTree,
	selectRecordingImageLookupTree,
	shouldMarkRecordingAttachmentsReady,
} from "../recordingImageLookupSnapshot"

/** Builds a fake attachment node for lookup/store split tests. */
function attachment(overrides: Partial<AttachmentItem>): AttachmentItem {
	return {
		file_id: "",
		file_name: "",
		children: [],
		...overrides,
	} as AttachmentItem
}

describe("shouldMarkRecordingAttachmentsReady", () => {
	it("does not mark ready for an empty websocket snapshot", () => {
		expect(
			shouldMarkRecordingAttachmentsReady({
				treeLength: 0,
				source: "ws",
			}),
		).toBe(false)
	})

	it("does not mark ready for an empty fallback snapshot", () => {
		expect(
			shouldMarkRecordingAttachmentsReady({
				treeLength: 0,
				source: "fallback",
			}),
		).toBe(false)
	})

	it("marks ready when a non-empty realtime snapshot arrives", () => {
		expect(
			shouldMarkRecordingAttachmentsReady({
				treeLength: 1,
				source: "fallback",
			}),
		).toBe(true)
	})
})

describe("selectRecordingImageLookupTree", () => {
	const hiddenImageTree = [
		attachment({
			file_id: "session-folder",
			file_name: "session-folder",
			is_hidden: true,
			children: [
				attachment({
					file_id: "image-1",
					file_name: "image-1.png",
					is_hidden: true,
					relative_file_path: "/session-folder/images/image-1.png",
				}),
			],
		}),
	]
	const visibleTree = [
		attachment({
			file_id: "visible",
			file_name: "visible.png",
		}),
	]

	it("replaces the lookup snapshot when incoming tree contains hidden files", () => {
		expect(
			selectRecordingImageLookupTree({
				current: visibleTree,
				incoming: hiddenImageTree,
				source: "http",
			}),
		).toBe(hiddenImageTree)
	})

	it("keeps the hidden lookup snapshot when a filtered websocket tree arrives", () => {
		expect(
			selectRecordingImageLookupTree({
				current: hiddenImageTree,
				incoming: visibleTree,
				source: "ws",
			}),
		).toBe(hiddenImageTree)
	})

	it("keeps the current snapshot when websocket applies an empty tree", () => {
		expect(
			selectRecordingImageLookupTree({
				current: hiddenImageTree,
				incoming: [],
				source: "ws",
			}),
		).toBe(hiddenImageTree)
	})
})

describe("getVisibleRecordingAttachmentTree", () => {
	it("drops nested hidden files under a visible folder", () => {
		const tree = [
			attachment({
				file_id: "docs",
				file_name: "Docs",
				children: [
					attachment({ file_id: "readme", file_name: "readme.md" }),
					attachment({
						file_id: "image-1",
						file_name: "image-1.png",
						is_hidden: true,
					}),
				],
			}),
		]

		const visibleTree = getVisibleRecordingAttachmentTree(tree)

		expect(visibleTree).toHaveLength(1)
		expect(visibleTree[0].file_id).toBe("docs")
		expect(visibleTree[0].children?.map((item) => item.file_id)).toEqual(["readme"])
	})
})

describe("findRecordingImagesFolderId", () => {
	it("matches the folder by parent id and name", () => {
		const tree = [
			attachment({
				file_id: "session",
				file_name: "session",
				is_hidden: true,
				children: [
					attachment({
						file_id: "wrong-images",
						file_name: "images",
						is_directory: true,
						parent_id: "other-session",
					}),
					attachment({
						file_id: "recording-images",
						file_name: "images",
						is_directory: true,
						parent_id: "session",
					}),
				],
			}),
		]

		expect(findRecordingImagesFolderId(tree, "session", "images")).toBe("recording-images")
	})

	it("does not fall back to a same-named folder under another parent", () => {
		const tree = [
			attachment({
				file_id: "wrong-images",
				file_name: "images",
				is_directory: true,
				parent_id: "other-session",
			}),
		]

		expect(findRecordingImagesFolderId(tree, "session", "images")).toBeUndefined()
	})
})
