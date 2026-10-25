import { describe, expect, it, vi } from "vitest"
import type { CanvasClipboardMessagePart } from "../../../../runtime/resources/clipboard/CanvasMessageClipboard"
import { CanvasUploadMentionController } from "../CanvasUploadMentionController"
import { applyRichMessageClipboardParts } from "../applyRichMessageClipboardParts"
import type { MessageEditorRef } from "../MessageEditor"

function createFile(name: string): File {
	return new File(["content"], name, { type: "image/png" })
}

function createEditor(): MessageEditorRef {
	return {
		getCurrentPrompt: () => "",
		getSessionId: () => "editor-session",
		insertClipboardParts: vi.fn(() => true),
		resolvePendingUploadMention: vi.fn(() => true),
		updatePendingUploadMention: vi.fn(),
		failPendingUploadMention: vi.fn(),
	} as unknown as MessageEditorRef
}

describe("applyRichMessageClipboardParts", () => {
	it("keeps pending chips and upload handles aligned when upload and resolving entries interleave", async () => {
		const fileA = createFile("A.png")
		const fileC = createFile("C.png")
		const parts: CanvasClipboardMessagePart[] = [
			{
				kind: "asset",
				occurrenceKey: "occ-a",
				fallbackText: "@A.png",
				asset: {
					type: "image",
					mimeType: "image/png",
					fileName: "A.png",
					origin: "external-file",
					file: fileA,
				},
			},
			{
				kind: "asset",
				occurrenceKey: "occ-b",
				fallbackText: "@B.png",
				asset: {
					type: "image",
					mimeType: "image/png",
					fileName: "B.png",
					origin: "message-reference",
					resourceIdentity: "file-b",
					sourceFileId: "file-b",
				},
			},
			{
				kind: "asset",
				occurrenceKey: "occ-c",
				fallbackText: "@C.png",
				asset: {
					type: "image",
					mimeType: "image/png",
					fileName: "C.png",
					origin: "external-file",
					file: fileC,
				},
			},
		]

		const editor = createEditor()
		const controller = new CanvasUploadMentionController({ current: editor })
		const uploadFiles = vi.fn(async (files: File[]) =>
			files.map((file) => ({
				path: `./images/${file.name}`,
				src: `./images/${file.name}`,
				fileName: file.name,
			})),
		)
		const resolveSpy = vi.spyOn(controller, "resolve")

		const session = await applyRichMessageClipboardParts({
			parts,
			editor,
			controller,
			isSessionCurrent: () => true,
			resolveAssetDestination: () => "prompt",
			uploadFiles,
		})

		expect(session).not.toBeNull()
		const inserted = vi.mocked(editor.insertClipboardParts).mock.calls[0]?.[0] ?? []
		expect(
			inserted
				.filter((part) => part.type === "pending")
				.map((part) => (part.type === "pending" ? part.item.fileName : "")),
		).toEqual(["A.png", "B.png", "C.png"])

		expect(uploadFiles).toHaveBeenCalledTimes(1)
		const [uploadedFiles, uploadOptions] = uploadFiles.mock.calls[0] ?? []
		expect(uploadedFiles).toEqual([fileA, fileC])
		expect(uploadOptions?.pendingMentionHandles?.map((handle) => handle?.fileName)).toEqual([
			"A.png",
			"C.png",
		])

		await session?.resolveOccurrence("occ-b", {
			key: "occ-b",
			type: "image",
			mimeType: "image/png",
			fileName: "B.png",
			origin: "message-reference",
			reference: {
				kind: "project",
				path: "./images/B.png",
				fileName: "B.png",
				resourceIdentity: "workspace:/canvas/images/B.png",
				fileId: "file-b",
			},
		})

		expect(resolveSpy).toHaveBeenCalledWith(
			expect.objectContaining({ fileName: "B.png" }),
			expect.objectContaining({ fileName: "B.png" }),
		)
	})
})
