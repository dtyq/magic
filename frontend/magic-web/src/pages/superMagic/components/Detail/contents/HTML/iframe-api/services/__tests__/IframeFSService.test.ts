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
})
