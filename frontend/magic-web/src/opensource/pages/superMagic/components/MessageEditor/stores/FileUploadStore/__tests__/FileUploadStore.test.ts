import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/opensource/utils/log", () => ({
	logger: {
		createLogger: () => ({
			error: vi.fn(),
			warn: vi.fn(),
			info: vi.fn(),
		}),
	},
}))

vi.mock("@/opensource/stores/projectFiles", () => ({
	default: {
		getFileNamesInFolder: vi.fn(() => []),
	},
}))

vi.mock("../../../services/UploadService", () => ({
	UploadService: class {
		upload() {
			return Promise.resolve({ rejected: [] })
		}
	},
}))

vi.mock("../../../services/UploadTokenService", () => ({
	superMagicUploadTokenService: {
		getUploadToken: vi.fn().mockResolvedValue(undefined),
		getUploadTokenUrl: "/mock-upload-token",
	},
}))

import { FileUploadStore } from "../index"
import type { FileData } from "../../../types"

function createMockFileData(id: string): FileData {
	return {
		id,
		name: `${id}.txt`,
		file: new File(["test"], `${id}.txt`, { type: "text/plain" }),
		status: "done",
		cancel: vi.fn(),
	}
}

describe("FileUploadStore", () => {
	let store: FileUploadStore
	let onFileRemoved: ReturnType<typeof vi.fn>
	let onFileUpload: ReturnType<typeof vi.fn>
	let onChange: ReturnType<typeof vi.fn>

	beforeEach(() => {
		onFileRemoved = vi.fn()
		onFileUpload = vi.fn()
		onChange = vi.fn()
		store = new FileUploadStore({
			onFileRemoved,
			onFileUpload,
			onChange,
		})
	})

	describe("clearFiles", () => {
		it("should remove files and trigger removal callbacks", () => {
			store.files = [createMockFileData("file-1"), createMockFileData("file-2")]

			store.clearFiles()

			expect(store.files).toEqual([])
			expect(onFileRemoved).toHaveBeenCalledTimes(2)
			expect(onFileRemoved).toHaveBeenNthCalledWith(1, "file-1")
			expect(onFileRemoved).toHaveBeenNthCalledWith(2, "file-2")
			expect(onFileUpload).toHaveBeenLastCalledWith([])
			expect(onChange).toHaveBeenLastCalledWith([])
		})
	})

	describe("clearFilesLocalOnly", () => {
		it("should clear local files without triggering removal callbacks", () => {
			const firstFile = createMockFileData("file-1")
			const secondFile = createMockFileData("file-2")
			store.files = [firstFile, secondFile]

			store.clearFilesLocalOnly()

			expect(store.files).toEqual([])
			expect(firstFile.cancel).toHaveBeenCalledTimes(1)
			expect(secondFile.cancel).toHaveBeenCalledTimes(1)
			expect(onFileRemoved).not.toHaveBeenCalled()
			expect(onFileUpload).toHaveBeenLastCalledWith([])
			expect(onChange).toHaveBeenLastCalledWith([])
		})
	})

	describe("removeUploadedFile", () => {
		it("should remove file by saved project file id", () => {
			store.files = [
				{
					...createMockFileData("local-file-1"),
					saveResult: {
						file_id: "project-file-1",
					} as FileData["saveResult"],
				},
				createMockFileData("local-file-2"),
			]

			store.removeUploadedFile("project-file-1")

			expect(store.files).toHaveLength(1)
			expect(store.files[0].id).toBe("local-file-2")
		})

		it("should clear current session project file tracking", () => {
			store.files = [
				{
					...createMockFileData("local-file-1"),
					saveResult: {
						file_id: "project-file-1",
					} as FileData["saveResult"],
				},
			]
			const internalStore = store as unknown as Record<string, Set<string>>
			internalStore.sessionSavedProjectFileIds.add("project-file-1")
			internalStore.sessionUploadFileIds.add("local-file-1")

			store.removeUploadedFile("project-file-1")

			expect(store.isCurrentSessionProjectFile("project-file-1")).toBe(false)
			expect(store.isCurrentSessionUploadFile("local-file-1")).toBe(false)
		})
	})

	describe("current session tracking", () => {
		it("should track files added in current session", async () => {
			const file = new File(["hello"], "hello.txt", { type: "text/plain" })

			const addedFiles = await store.addFiles([file])

			expect(addedFiles).toHaveLength(1)
			expect(store.isCurrentSessionUploadFile(addedFiles?.[0].id || "")).toBe(true)
		})
	})
})
