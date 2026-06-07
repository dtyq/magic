import { describe, expect, it, vi } from "vitest"
import { FS_MESSAGE_TYPES } from "../../types"
import { IframeFSService, type FSFileItem, type IframeFSConfig } from "../IframeFSService"

function createService(overrides?: Partial<IframeFSConfig>) {
	const postToIframe = vi.fn()
	const cfg: IframeFSConfig = {
		postToIframe,
		entryPath: "app/index.html",
		fileList: [],
		appConfig: null,
		projectId: "project-1",
		uploadFn: vi.fn(),
		saveContentFn: vi.fn(),
		...overrides,
	}
	const service = new IframeFSService(cfg)
	return { service, postToIframe, cfg }
}

function file(file_id: string, relative_file_path: string, file_name?: string): FSFileItem {
	return { file_id, relative_file_path, file_name }
}

describe("IframeFSService", () => {
	it("deduplicates file_ids when deleteDir collects the directory and children", async () => {
		const deleteFilesFn = vi.fn().mockResolvedValue(undefined)
		const { service } = createService({
			fileList: [
				file("dir-id", "app/data/", "data"),
				file("child-id", "app/data/a.txt", "a.txt"),
				file("child-id", "app/data/a.txt", "a.txt"),
			],
			deleteFilesFn,
		})

		await service.handleMessage(FS_MESSAGE_TYPES.DELETE_DIR_REQUEST, {
			type: FS_MESSAGE_TYPES.DELETE_DIR_REQUEST,
			requestId: "req-delete-dir",
			path: "./data",
		})

		expect(deleteFilesFn).toHaveBeenCalledWith({
			file_ids: ["dir-id", "child-id"],
			project_id: "project-1",
		})
	})

	it("uses the moved file path for later operations in the same session", async () => {
		const moveFileFn = vi.fn().mockResolvedValue(undefined)
		const deleteFn = vi.fn().mockResolvedValue(undefined)
		const { service } = createService({
			fileList: [
				file("file-id", "app/old.json", "old.json"),
				file("archive-id", "app/archive", "archive"),
			],
			moveFileFn,
			deleteFn,
		})

		await service.handleMessage(FS_MESSAGE_TYPES.MOVE_FILE_REQUEST, {
			type: FS_MESSAGE_TYPES.MOVE_FILE_REQUEST,
			requestId: "req-move",
			path: "./old.json",
			targetDir: "./archive",
		})
		await service.handleMessage(FS_MESSAGE_TYPES.DELETE_FILE_REQUEST, {
			type: FS_MESSAGE_TYPES.DELETE_FILE_REQUEST,
			requestId: "req-delete",
			path: "./archive/old.json",
		})

		expect(deleteFn).toHaveBeenCalledWith({
			file_id: "file-id",
			project_id: "project-1",
		})
	})

	it("updates child paths when a directory is moved", async () => {
		const moveFileFn = vi.fn().mockResolvedValue(undefined)
		const deleteFn = vi.fn().mockResolvedValue(undefined)
		const { service } = createService({
			fileList: [
				file("dir-id", "app/data", "data"),
				file("child-id", "app/data/a.txt", "a.txt"),
				file("archive-id", "app/archive", "archive"),
			],
			moveFileFn,
			deleteFn,
		})

		await service.handleMessage(FS_MESSAGE_TYPES.MOVE_FILE_REQUEST, {
			type: FS_MESSAGE_TYPES.MOVE_FILE_REQUEST,
			requestId: "req-move-dir",
			path: "./data",
			targetDir: "./archive",
		})
		await service.handleMessage(FS_MESSAGE_TYPES.DELETE_FILE_REQUEST, {
			type: FS_MESSAGE_TYPES.DELETE_FILE_REQUEST,
			requestId: "req-delete-child",
			path: "./archive/data/a.txt",
		})

		expect(deleteFn).toHaveBeenCalledWith({
			file_id: "child-id",
			project_id: "project-1",
		})
	})

	it("uses the renamed file path for later operations in the same session", async () => {
		const renameFileFn = vi.fn().mockResolvedValue(undefined)
		const deleteFn = vi.fn().mockResolvedValue(undefined)
		const { service } = createService({
			fileList: [file("file-id", "app/draft.txt", "draft.txt")],
			renameFileFn,
			deleteFn,
		})

		await service.handleMessage(FS_MESSAGE_TYPES.RENAME_FILE_REQUEST, {
			type: FS_MESSAGE_TYPES.RENAME_FILE_REQUEST,
			requestId: "req-rename",
			path: "./draft.txt",
			newName: "final.txt",
		})
		await service.handleMessage(FS_MESSAGE_TYPES.DELETE_FILE_REQUEST, {
			type: FS_MESSAGE_TYPES.DELETE_FILE_REQUEST,
			requestId: "req-delete",
			path: "./final.txt",
		})

		expect(deleteFn).toHaveBeenCalledWith({
			file_id: "file-id",
			project_id: "project-1",
		})
	})

	it("updates child paths when a directory is renamed", async () => {
		const renameFileFn = vi.fn().mockResolvedValue(undefined)
		const deleteFn = vi.fn().mockResolvedValue(undefined)
		const { service } = createService({
			fileList: [
				file("dir-id", "app/data", "data"),
				file("child-id", "app/data/a.txt", "a.txt"),
			],
			renameFileFn,
			deleteFn,
		})

		await service.handleMessage(FS_MESSAGE_TYPES.RENAME_FILE_REQUEST, {
			type: FS_MESSAGE_TYPES.RENAME_FILE_REQUEST,
			requestId: "req-rename-dir",
			path: "./data",
			newName: "dataset",
		})
		await service.handleMessage(FS_MESSAGE_TYPES.DELETE_FILE_REQUEST, {
			type: FS_MESSAGE_TYPES.DELETE_FILE_REQUEST,
			requestId: "req-delete-child",
			path: "./dataset/a.txt",
		})

		expect(deleteFn).toHaveBeenCalledWith({
			file_id: "child-id",
			project_id: "project-1",
		})
	})

	it("rejects deleteDir when cached children escape the app root", async () => {
		const deleteFilesFn = vi.fn().mockResolvedValue(undefined)
		const { service, postToIframe } = createService({
			fileList: [
				file("dir-id", "app/data", "data"),
				file("child-id", "app/data/a.txt", "a.txt"),
				file("outside-child", "app/data/../../outside-app/leaked.txt", "leaked.txt"),
			],
			deleteFilesFn,
		})

		await service.handleMessage(FS_MESSAGE_TYPES.DELETE_DIR_REQUEST, {
			type: FS_MESSAGE_TYPES.DELETE_DIR_REQUEST,
			requestId: "req-delete-dir-outside-child",
			path: "./data",
		})

		expect(deleteFilesFn).not.toHaveBeenCalled()
		expect(postToIframe).toHaveBeenCalledWith(
			expect.objectContaining({ requestId: "req-delete-dir-outside-child", success: false }),
		)
	})

	it("rejects deleteDir when cached children canonicalize outside the requested directory", async () => {
		const deleteFilesFn = vi.fn().mockResolvedValue(undefined)
		const { service, postToIframe } = createService({
			fileList: [
				file("dir-id", "app/data", "data"),
				file("child-id", "app/data/a.txt", "a.txt"),
				file("sibling-id", "app/data/../private.txt", "private.txt"),
			],
			deleteFilesFn,
		})

		await service.handleMessage(FS_MESSAGE_TYPES.DELETE_DIR_REQUEST, {
			type: FS_MESSAGE_TYPES.DELETE_DIR_REQUEST,
			requestId: "req-delete-dir-sibling-child",
			path: "./data",
		})

		expect(deleteFilesFn).not.toHaveBeenCalled()
		expect(postToIframe).toHaveBeenCalledWith(
			expect.objectContaining({ requestId: "req-delete-dir-sibling-child", success: false }),
		)
	})


	it.each(["", "   ", "../evil.txt", "subdir/file.txt", "subdir\\file.txt", "/tmp", "bad\u0000name.txt"])(
		"rejects renameFile when newName is not a single file name: %s",
		async (newName) => {
			const renameFileFn = vi.fn().mockResolvedValue(undefined)
			const { service, postToIframe } = createService({
				fileList: [file("file-id", "app/draft.txt", "draft.txt")],
				renameFileFn,
			})

			await service.handleMessage(FS_MESSAGE_TYPES.RENAME_FILE_REQUEST, {
				type: FS_MESSAGE_TYPES.RENAME_FILE_REQUEST,
				requestId: "req-rename-invalid-name",
				path: "./draft.txt",
				newName,
			})

			expect(renameFileFn).not.toHaveBeenCalled()
			expect(postToIframe).toHaveBeenCalledWith(
				expect.objectContaining({ requestId: "req-rename-invalid-name", success: false }),
			)
		},
	)

	it("rejects destructive operations when projectId is missing", async () => {
		const deleteFn = vi.fn().mockResolvedValue(undefined)
		const deleteFilesFn = vi.fn().mockResolvedValue(undefined)
		const moveFileFn = vi.fn().mockResolvedValue(undefined)
		const renameFileFn = vi.fn().mockResolvedValue(undefined)
		const { service } = createService({
			projectId: "",
			fileList: [
				file("file-id", "app/data.txt", "data.txt"),
				file("dir-id", "app/data", "data"),
				file("child-id", "app/data/a.txt", "a.txt"),
				file("target-dir", "app/archive", "archive"),
			],
			deleteFn,
			deleteFilesFn,
			moveFileFn,
			renameFileFn,
		})

		await service.handleMessage(FS_MESSAGE_TYPES.DELETE_FILE_REQUEST, {
			type: FS_MESSAGE_TYPES.DELETE_FILE_REQUEST,
			requestId: "req-delete-no-project",
			path: "./data.txt",
		})
		await service.handleMessage(FS_MESSAGE_TYPES.DELETE_DIR_REQUEST, {
			type: FS_MESSAGE_TYPES.DELETE_DIR_REQUEST,
			requestId: "req-delete-dir-no-project",
			path: "./data",
		})
		await service.handleMessage(FS_MESSAGE_TYPES.MOVE_FILE_REQUEST, {
			type: FS_MESSAGE_TYPES.MOVE_FILE_REQUEST,
			requestId: "req-move-no-project",
			path: "./data.txt",
			targetDir: "./archive",
		})
		await service.handleMessage(FS_MESSAGE_TYPES.RENAME_FILE_REQUEST, {
			type: FS_MESSAGE_TYPES.RENAME_FILE_REQUEST,
			requestId: "req-rename-no-project",
			path: "./data.txt",
			newName: "renamed.txt",
		})

		expect(deleteFn).not.toHaveBeenCalled()
		expect(deleteFilesFn).not.toHaveBeenCalled()
		expect(moveFileFn).not.toHaveBeenCalled()
		expect(renameFileFn).not.toHaveBeenCalled()
	})

})
