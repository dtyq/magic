import { describe, expect, it, vi } from "vitest"
import { CanvasUploadMentionController } from "../CanvasUploadMentionController"
import type { MessageEditorRef } from "../MessageEditor"

function createFile(name: string): File {
	return new File(["content"], name, { type: "image/png" })
}

function createEditorRef() {
	return {
		current: {
			insertPendingUploadMentions: vi.fn(() => true),
			updatePendingUploadMention: vi.fn(),
			resolvePendingUploadMention: vi.fn(() => true),
			failPendingUploadMention: vi.fn(),
		} as unknown as MessageEditorRef,
	}
}

describe("CanvasUploadMentionController", () => {
	it("maps progress and completion to the same pending id", () => {
		const editorRef = createEditorRef()
		const controller = new CanvasUploadMentionController(editorRef)
		const [handle] = controller.beginBatch([createFile("cat.png")])

		controller.updateProgress(handle, 42)
		controller.resolve(handle, {
			path: "./images/cat.png",
			src: "https://example.test/cat.png",
			fileName: "cat.png",
		})

		expect(editorRef.current?.insertPendingUploadMentions).toHaveBeenCalledTimes(1)
		expect(editorRef.current?.updatePendingUploadMention).toHaveBeenCalledWith(
			handle?.pendingId,
			expect.objectContaining({ status: "uploading", progress: 42 }),
		)
		expect(editorRef.current?.resolvePendingUploadMention).toHaveBeenCalledWith(
			handle?.pendingId,
			expect.objectContaining({
				data: expect.objectContaining({ file_path: "./images/cat.png" }),
			}),
		)
	})

	it("ignores callbacks after the editor session is invalidated", () => {
		const editorRef = createEditorRef()
		const controller = new CanvasUploadMentionController(editorRef)
		const [handle] = controller.beginBatch([createFile("stale.png")])

		controller.invalidateSession()
		controller.updateProgress(handle, 80)
		controller.resolve(handle, {
			path: "./images/stale.png",
			src: "https://example.test/stale.png",
			fileName: "stale.png",
		})

		expect(editorRef.current?.updatePendingUploadMention).not.toHaveBeenCalled()
		expect(editorRef.current?.resolvePendingUploadMention).not.toHaveBeenCalled()
	})

	it("does not resolve into a newly mounted editor instance", () => {
		const editorRef = createEditorRef()
		let sessionId = "editor-1"
		editorRef.current!.getSessionId = () => sessionId
		const controller = new CanvasUploadMentionController(editorRef)
		const [handle] = controller.beginBatch([createFile("reopened.png")])

		sessionId = "editor-2"
		controller.resolve(handle, {
			path: "./images/reopened.png",
			src: "https://example.test/reopened.png",
			fileName: "reopened.png",
		})

		expect(editorRef.current?.resolvePendingUploadMention).not.toHaveBeenCalled()
	})

	it("reports an abandoned upload when its pending node was removed", () => {
		const editorRef = createEditorRef()
		vi.mocked(editorRef.current!.resolvePendingUploadMention).mockReturnValue(false)
		const controller = new CanvasUploadMentionController(editorRef)
		const [handle] = controller.beginBatch([createFile("removed.png")])

		const resolved = controller.resolve(handle, {
			path: "./images/removed.png",
			src: "https://example.test/removed.png",
			fileName: "removed.png",
		})

		expect(resolved).toBe(false)
		expect(editorRef.current?.resolvePendingUploadMention).toHaveBeenCalledTimes(1)
	})

	it("allocates pending ids without inserting, and fails with a short chip label", () => {
		const editorRef = createEditorRef()
		const controller = new CanvasUploadMentionController(editorRef)
		const { handles, pendingItems } = controller.allocateBatch([
			createFile("a.png"),
			createFile("b.png"),
		])

		expect(editorRef.current?.insertPendingUploadMentions).not.toHaveBeenCalled()
		expect(handles).toHaveLength(2)
		expect(pendingItems.map((item) => item.fileName)).toEqual(["a.png", "b.png"])

		controller.fail(handles[0], new Error("network boom"))
		expect(editorRef.current?.failPendingUploadMention).toHaveBeenCalledWith(
			handles[0]?.pendingId,
			"上传失败",
		)
	})
})
