import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { Editor } from "@/infrastructure/editors/tiptap/core"
import Document from "@/infrastructure/editors/tiptap/extension-document"
import Paragraph from "@/infrastructure/editors/tiptap/extension-paragraph"
import Text from "@/infrastructure/editors/tiptap/extension-text"
import type { ProjectImageStorageInterface } from "@/services/tiptap-image-project"
import { ProjectImageNode } from "../project-image-node-extension"
import { SaveImageToProjectExtension } from "../save-image-to-project-extension"

function createUploadResult() {
	return {
		file_id: "file-1",
		file_key: "key-1",
		file_name: "photo.png",
		relative_file_path: "images/photo.png",
		file_size: 4,
	}
}

function createEditor(options: {
	resolveImagesFolderParentId: (folderPath: string) => Promise<string | undefined>
	requireImagesFolderParentId?: boolean
	uploadImage: ProjectImageStorageInterface["uploadImage"]
	onError?: (error: Error) => void
}) {
	const imageStorage: ProjectImageStorageInterface = {
		uploadImage: options.uploadImage,
		checkAvailability: vi.fn().mockResolvedValue(true),
		getImageUrl: vi.fn(),
		deleteImage: vi.fn(),
	}

	return new Editor({
		extensions: [
			Document,
			Paragraph,
			Text,
			ProjectImageNode.configure({
				urlResolver: (path) => path,
			}),
			SaveImageToProjectExtension.configure({
				imageStorage,
				projectId: "proj-1",
				resolveImagesFolderParentId: options.resolveImagesFolderParentId,
				requireImagesFolderParentId: options.requireImagesFolderParentId,
				onError: options.onError,
			}),
		],
	})
}

describe("SaveImageToProjectExtension folder resolution", () => {
	let editor: Editor | null = null

	afterEach(() => {
		editor?.destroy()
		editor = null
		vi.restoreAllMocks()
	})

	beforeEach(() => {
		vi.spyOn(console, "log").mockImplementation(() => {})
	})

	it("uploads to the project root when folder resolve rejects without require", async () => {
		const uploadImage = vi.fn().mockResolvedValue(createUploadResult())
		const resolveImagesFolderParentId = vi
			.fn()
			.mockRejectedValue(new Error("folder resolve failed"))
		const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})

		editor = createEditor({
			resolveImagesFolderParentId,
			requireImagesFolderParentId: false,
			uploadImage,
		})

		const file = new File(["img"], "photo.png", { type: "image/png" })
		editor.commands.insertProjectImageFromFile(file)

		await vi.waitFor(() => {
			expect(uploadImage).toHaveBeenCalledTimes(1)
		})

		expect(uploadImage).toHaveBeenCalledWith(
			expect.any(File),
			"proj-1",
			"images",
			expect.objectContaining({ parentFolderId: undefined }),
		)
		expect(consoleError).toHaveBeenCalled()
	})

	it("fails the upload when folder resolve rejects and require is enabled", async () => {
		const uploadImage = vi.fn().mockResolvedValue(createUploadResult())
		const onError = vi.fn()
		const resolveImagesFolderParentId = vi
			.fn()
			.mockRejectedValue(new Error("folder resolve failed"))

		editor = createEditor({
			resolveImagesFolderParentId,
			requireImagesFolderParentId: true,
			uploadImage,
			onError,
		})

		const file = new File(["img"], "photo.png", { type: "image/png" })
		editor.commands.insertProjectImageFromFile(file)

		await vi.waitFor(() => {
			expect(onError).toHaveBeenCalledTimes(1)
		})

		expect(uploadImage).not.toHaveBeenCalled()
		expect(onError.mock.calls[0]?.[0]?.message).toBe("folder resolve failed")
	})
})
