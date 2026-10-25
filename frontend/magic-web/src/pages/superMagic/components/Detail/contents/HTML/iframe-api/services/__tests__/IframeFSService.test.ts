import { beforeEach, describe, expect, it, vi } from "vitest"
import { getIframeDownloadUrl } from "../../iframeApi"
import { FS_MESSAGE_TYPES } from "../../types"
import { IframeFSService, type FSFileItem, type IframeFSConfig } from "../IframeFSService"

vi.mock("../../iframeApi", () => ({
	getIframeDownloadUrl: vi.fn(),
}))

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
		verifyFileFn: vi.fn(async ({ file_id }) => {
			const item = cfg.fileList.find((f) => f.file_id === file_id)
			return { relative_file_path: item?.relative_file_path || "" }
		}),
		...overrides,
	}
	const service = new IframeFSService(cfg)
	return { service, postToIframe, cfg }
}

function file(
	file_id: string,
	relative_file_path: string,
	file_name?: string,
	options?: Pick<FSFileItem, "is_directory" | "updated_at">,
): FSFileItem {
	return { file_id, relative_file_path, file_name, ...options }
}

describe("IframeFSService", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("returns a temporary file URL for an app file", async () => {
		vi.mocked(getIframeDownloadUrl).mockResolvedValueOnce([
			{
				file_id: "image-id",
				url: "https://example.com/app/assets/image.png",
			},
		])
		const { service, postToIframe } = createService({
			fileList: [file("image-id", "app/assets/image.png", "image.png")],
		})

		await service.handleMessage(FS_MESSAGE_TYPES.GET_FILE_URL_REQUEST, {
			type: FS_MESSAGE_TYPES.GET_FILE_URL_REQUEST,
			requestId: "req-get-url",
			path: "./assets/image.png",
		})

		expect(getIframeDownloadUrl).toHaveBeenCalledWith(["image-id"], null)
		expect(postToIframe).toHaveBeenCalledWith({
			type: FS_MESSAGE_TYPES.GET_FILE_URL_RESPONSE,
			requestId: "req-get-url",
			success: true,
			url: "https://example.com/app/assets/image.png",
		})
	})

	it("requires fs.project.read before reading a project-root file", async () => {
		const authorizePermission = vi.fn().mockResolvedValue(false)
		const { service, postToIframe } = createService({
			fileList: [file("root-id", "shared.txt", "shared.txt")],
			authorizePermission,
		})

		await service.handleMessage(FS_MESSAGE_TYPES.READ_REQUEST, {
			type: FS_MESSAGE_TYPES.READ_REQUEST,
			requestId: "req-read-project-denied",
			path: "/shared.txt",
		})

		expect(authorizePermission).toHaveBeenCalledWith("fs.project.read")
		expect(getIframeDownloadUrl).not.toHaveBeenCalled()
		expect(postToIframe).toHaveBeenCalledWith(
			expect.objectContaining({
				type: FS_MESSAGE_TYPES.READ_RESPONSE,
				requestId: "req-read-project-denied",
				success: false,
			}),
		)
	})

	it("requires fs.project.write before writing a project-root file", async () => {
		const saveContentFn = vi.fn().mockResolvedValue(undefined)
		const confirmProjectDeleteFn = vi.fn().mockResolvedValue(true)
		const authorizePermission = vi.fn().mockResolvedValue(false)
		const { service, postToIframe } = createService({
			fileList: [file("root-id", "shared.txt", "shared.txt")],
			saveContentFn,
			confirmProjectDeleteFn,
			authorizePermission,
		})

		await service.handleMessage(FS_MESSAGE_TYPES.WRITE_REQUEST, {
			type: FS_MESSAGE_TYPES.WRITE_REQUEST,
			requestId: "req-write-project-denied",
			path: "/shared.txt",
			content: "updated",
		})

		expect(authorizePermission).toHaveBeenCalledWith("fs.project.write")
		expect(confirmProjectDeleteFn).not.toHaveBeenCalled()
		expect(saveContentFn).not.toHaveBeenCalled()
		expect(postToIframe).toHaveBeenCalledWith(
			expect.objectContaining({
				type: FS_MESSAGE_TYPES.WRITE_RESPONSE,
				requestId: "req-write-project-denied",
				success: false,
			}),
		)
	})

	it("returns a context error before authorization when project APIs are unavailable", async () => {
		const projectContextError = "Share mode does not support project APIs"
		const authorizePermission = vi.fn()
		const { service, postToIframe } = createService({
			fileList: [file("root-id", "shared.txt", "shared.txt")],
			projectId: undefined,
			projectContextUnavailableError: projectContextError,
			authorizePermission,
		})

		await service.handleMessage(FS_MESSAGE_TYPES.READ_REQUEST, {
			type: FS_MESSAGE_TYPES.READ_REQUEST,
			requestId: "req-share-context",
			path: "/shared.txt",
		})

		expect(authorizePermission).not.toHaveBeenCalled()
		expect(postToIframe).toHaveBeenCalledWith({
			type: FS_MESSAGE_TYPES.READ_RESPONSE,
			requestId: "req-share-context",
			success: false,
			error: projectContextError,
		})
	})

	it("requires fs.project.write before checking whether a project-root delete target exists", async () => {
		const deleteFn = vi.fn().mockResolvedValue(undefined)
		const authorizePermission = vi.fn().mockResolvedValue(false)
		const { service, postToIframe } = createService({
			deleteFn,
			authorizePermission,
		})

		await service.handleMessage(FS_MESSAGE_TYPES.DELETE_FILE_REQUEST, {
			type: FS_MESSAGE_TYPES.DELETE_FILE_REQUEST,
			requestId: "req-delete-project-missing-denied",
			path: "/missing.txt",
		})

		expect(authorizePermission).toHaveBeenCalledWith("fs.project.write")
		expect(deleteFn).not.toHaveBeenCalled()
		expect(postToIframe).toHaveBeenCalledWith({
			type: FS_MESSAGE_TYPES.DELETE_FILE_RESPONSE,
			requestId: "req-delete-project-missing-denied",
			success: false,
			error: "Permission denied: fs.project.write",
		})
	})

	it("rejects getFileUrl when the file is missing", async () => {
		const { service, postToIframe } = createService()

		await service.handleMessage(FS_MESSAGE_TYPES.GET_FILE_URL_REQUEST, {
			type: FS_MESSAGE_TYPES.GET_FILE_URL_REQUEST,
			requestId: "req-get-missing-url",
			path: "./missing.png",
		})

		expect(getIframeDownloadUrl).not.toHaveBeenCalled()
		expect(postToIframe).toHaveBeenCalledWith(
			expect.objectContaining({
				type: FS_MESSAGE_TYPES.GET_FILE_URL_RESPONSE,
				requestId: "req-get-missing-url",
				success: false,
			}),
		)
	})

	it("rejects getFileUrl when download URL is unavailable", async () => {
		vi.mocked(getIframeDownloadUrl).mockResolvedValueOnce([])
		const { service, postToIframe } = createService({
			fileList: [file("image-id", "app/assets/image.png", "image.png")],
		})

		await service.handleMessage(FS_MESSAGE_TYPES.GET_FILE_URL_REQUEST, {
			type: FS_MESSAGE_TYPES.GET_FILE_URL_REQUEST,
			requestId: "req-get-empty-url",
			path: "./assets/image.png",
		})

		expect(postToIframe).toHaveBeenCalledWith(
			expect.objectContaining({
				type: FS_MESSAGE_TYPES.GET_FILE_URL_RESPONSE,
				requestId: "req-get-empty-url",
				success: false,
			}),
		)
	})

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

	it.each([
		"",
		"   ",
		"../evil.txt",
		"subdir/file.txt",
		"subdir\\file.txt",
		"/tmp",
		"bad\u0000name.txt",
	])("rejects renameFile when newName is not a single file name: %s", async (newName) => {
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
	})

	it("lists project-root files by default without app manifest file scope", async () => {
		const { service, postToIframe } = createService({
			fileList: [
				file("root-id", "shared.txt", "shared.txt"),
				file("archive-id", "archive", "archive"),
				file("nested-id", "archive/a.txt", "a.txt"),
			],
		})

		await service.handleMessage(FS_MESSAGE_TYPES.LIST_REQUEST, {
			type: FS_MESSAGE_TYPES.LIST_REQUEST,
			requestId: "req-default-project-list-root",
			dir: "/",
		})

		expect(postToIframe).toHaveBeenCalledWith(
			expect.objectContaining({
				requestId: "req-default-project-list-root",
				success: true,
				files: ["shared.txt", "archive"],
			}),
		)
	})

	it("listDir returns direct structured entries without reading file content", async () => {
		const { service, postToIframe } = createService({
			fileList: [
				file(
					"task-id",
					"app/data/tasks/20260624153000__open__a8f3k2__follow-up.json",
					"20260624153000__open__a8f3k2__follow-up.json",
					{ updated_at: "2026-06-24T15:30:00Z" },
				),
				file("archive-id", "app/data/tasks/archive", "archive", { is_directory: true }),
				file("nested-id", "app/data/tasks/archive/old.json", "old.json"),
				file("other-id", "app/data/events/event.json", "event.json"),
			],
		})

		await service.handleMessage(FS_MESSAGE_TYPES.LIST_DIR_REQUEST, {
			type: FS_MESSAGE_TYPES.LIST_DIR_REQUEST,
			requestId: "req-list-dir",
			dir: "data/tasks/",
		})

		expect(postToIframe).toHaveBeenCalledWith({
			type: FS_MESSAGE_TYPES.LIST_DIR_RESPONSE,
			requestId: "req-list-dir",
			success: true,
			entries: [
				{
					name: "20260624153000__open__a8f3k2__follow-up.json",
					path: "data/tasks/20260624153000__open__a8f3k2__follow-up.json",
					isDirectory: false,
					updatedAt: "2026-06-24T15:30:00Z",
				},
				{
					name: "archive",
					path: "data/tasks/archive",
					isDirectory: true,
				},
			],
		})
	})

	it("watchDir reports added and removed direct entries from refreshed fileList snapshots", () => {
		vi.useFakeTimers()
		const { service, postToIframe } = createService({
			fileList: [
				file("old-id", "app/data/tasks/old.json", "old.json", {
					updated_at: "2026-06-24T10:00:00Z",
				}),
			],
		})

		service.handleMessage(FS_MESSAGE_TYPES.WATCH_DIR_REGISTER, {
			type: FS_MESSAGE_TYPES.WATCH_DIR_REGISTER,
			requestId: "watch-dir-1",
			dir: "data/tasks/",
		})
		postToIframe.mockClear()

		service.updateFileList([
			file("new-id", "app/data/tasks/new.json", "new.json", {
				updated_at: "2026-06-24T11:00:00Z",
			}),
		])
		vi.advanceTimersByTime(3000)

		expect(postToIframe).toHaveBeenCalledWith({
			type: FS_MESSAGE_TYPES.DIR_CHANGED,
			dir: "data/tasks/",
			timestamp: expect.any(Number),
			added: ["new.json"],
			removed: ["old.json"],
			entries: [
				{
					name: "new.json",
					path: "data/tasks/new.json",
					isDirectory: false,
					updatedAt: "2026-06-24T11:00:00Z",
				},
			],
		})

		service.destroy()
		vi.useRealTimers()
	})

	it("watchDir does not fire when only a direct entry updated_at changes", () => {
		vi.useFakeTimers()
		const { service, postToIframe } = createService({
			fileList: [
				file("task-id", "app/data/tasks/task.json", "task.json", {
					updated_at: "2026-06-24T10:00:00Z",
				}),
			],
		})

		service.handleMessage(FS_MESSAGE_TYPES.WATCH_DIR_REGISTER, {
			type: FS_MESSAGE_TYPES.WATCH_DIR_REGISTER,
			requestId: "watch-dir-1",
			dir: "data/tasks/",
		})
		postToIframe.mockClear()

		service.updateFileList([
			file("task-id", "app/data/tasks/task.json", "task.json", {
				updated_at: "2026-06-24T11:00:00Z",
			}),
		])
		vi.advanceTimersByTime(3000)

		expect(postToIframe).not.toHaveBeenCalledWith(
			expect.objectContaining({ type: FS_MESSAGE_TYPES.DIR_CHANGED }),
		)

		service.destroy()
		vi.useRealTimers()
	})

	it("watchDir reports rename as removed plus added so apps can match by shortId", () => {
		vi.useFakeTimers()
		const { service, postToIframe } = createService({
			fileList: [
				file(
					"task-id",
					"app/data/tasks/20260624100000__open__a8f3k2__old-title.json",
					"20260624100000__open__a8f3k2__old-title.json",
				),
			],
		})

		service.handleMessage(FS_MESSAGE_TYPES.WATCH_DIR_REGISTER, {
			type: FS_MESSAGE_TYPES.WATCH_DIR_REGISTER,
			requestId: "watch-dir-1",
			dir: "data/tasks/",
		})
		postToIframe.mockClear()

		service.updateFileList([
			file(
				"task-id",
				"app/data/tasks/20260624100000__done__a8f3k2__new-title.json",
				"20260624100000__done__a8f3k2__new-title.json",
			),
		])
		vi.advanceTimersByTime(3000)

		expect(postToIframe).toHaveBeenCalledWith(
			expect.objectContaining({
				type: FS_MESSAGE_TYPES.DIR_CHANGED,
				dir: "data/tasks/",
				added: ["20260624100000__done__a8f3k2__new-title.json"],
				removed: ["20260624100000__open__a8f3k2__old-title.json"],
			}),
		)

		service.destroy()
		vi.useRealTimers()
	})

	it("watchFile reports file changes after refreshed fileList updates updated_at", () => {
		vi.useFakeTimers()
		const { service, postToIframe } = createService({
			fileList: [
				file("task-id", "app/data/tasks/task.json", "task.json", {
					updated_at: "2026-06-24T10:00:00Z",
				}),
			],
		})

		service.handleMessage(FS_MESSAGE_TYPES.WATCH_REGISTER, {
			type: FS_MESSAGE_TYPES.WATCH_REGISTER,
			requestId: "watch-file-1",
			path: "./data/tasks/task.json",
		})
		postToIframe.mockClear()

		service.updateFileList([
			file("task-id", "app/data/tasks/task.json", "task.json", {
				updated_at: "2026-06-24T11:00:00Z",
			}),
		])
		vi.advanceTimersByTime(3000)

		expect(postToIframe).toHaveBeenCalledWith({
			type: FS_MESSAGE_TYPES.FILE_CHANGED,
			path: "./data/tasks/task.json",
			timestamp: expect.any(Number),
		})

		service.destroy()
		vi.useRealTimers()
	})

	it("watchFile unregister stops file change notifications", () => {
		vi.useFakeTimers()
		const { service, postToIframe } = createService({
			fileList: [
				file("task-id", "app/data/tasks/task.json", "task.json", {
					updated_at: "2026-06-24T10:00:00Z",
				}),
			],
		})

		service.handleMessage(FS_MESSAGE_TYPES.WATCH_REGISTER, {
			type: FS_MESSAGE_TYPES.WATCH_REGISTER,
			requestId: "watch-file-1",
			path: "./data/tasks/task.json",
		})
		service.handleMessage(FS_MESSAGE_TYPES.WATCH_UNREGISTER, {
			type: FS_MESSAGE_TYPES.WATCH_UNREGISTER,
			requestId: "watch-file-1",
			path: "./data/tasks/task.json",
		})
		postToIframe.mockClear()

		service.updateFileList([
			file("task-id", "app/data/tasks/task.json", "task.json", {
				updated_at: "2026-06-24T11:00:00Z",
			}),
		])
		vi.advanceTimersByTime(3000)

		expect(postToIframe).not.toHaveBeenCalledWith(
			expect.objectContaining({ type: FS_MESSAGE_TYPES.FILE_CHANGED }),
		)

		service.destroy()
		vi.useRealTimers()
	})

	it("requires confirmation before writing a project-root file outside the app root", async () => {
		const saveContentFn = vi.fn().mockResolvedValue(undefined)
		const confirmProjectDeleteFn = vi.fn().mockResolvedValue(false)
		const { service, postToIframe } = createService({
			fileList: [file("root-id", "shared.txt", "shared.txt")],
			saveContentFn,
			confirmProjectDeleteFn,
		})

		await service.handleMessage(FS_MESSAGE_TYPES.WRITE_REQUEST, {
			type: FS_MESSAGE_TYPES.WRITE_REQUEST,
			requestId: "req-confirm-project-write",
			path: "/shared.txt",
			content: "updated",
		})

		expect(confirmProjectDeleteFn).toHaveBeenCalledWith({
			path: "shared.txt",
			isDirectory: false,
			appRootDir: "app/",
			operation: "write",
		})
		expect(saveContentFn).not.toHaveBeenCalled()
		expect(postToIframe).toHaveBeenCalledWith(
			expect.objectContaining({ requestId: "req-confirm-project-write", success: false }),
		)
	})

	it("writes a project-root file outside the app root after confirmation", async () => {
		const saveContentFn = vi.fn().mockResolvedValue(undefined)
		const confirmProjectDeleteFn = vi.fn().mockResolvedValue(true)
		const { service } = createService({
			fileList: [file("root-id", "shared.txt", "shared.txt")],
			saveContentFn,
			confirmProjectDeleteFn,
		})

		await service.handleMessage(FS_MESSAGE_TYPES.WRITE_REQUEST, {
			type: FS_MESSAGE_TYPES.WRITE_REQUEST,
			requestId: "req-confirmed-project-write",
			path: "/shared.txt",
			content: "updated",
		})

		expect(saveContentFn).toHaveBeenCalledWith({
			file_id: "root-id",
			content: "updated",
		})
	})

	it("rejects deleting the project root directory", async () => {
		const deleteFilesFn = vi.fn().mockResolvedValue(undefined)
		const confirmProjectDeleteFn = vi.fn().mockResolvedValue(true)
		const { service, postToIframe } = createService({
			deleteFilesFn,
			confirmProjectDeleteFn,
		})

		await service.handleMessage(FS_MESSAGE_TYPES.DELETE_DIR_REQUEST, {
			type: FS_MESSAGE_TYPES.DELETE_DIR_REQUEST,
			requestId: "req-delete-project-root",
			path: "/",
		})

		expect(confirmProjectDeleteFn).not.toHaveBeenCalled()
		expect(deleteFilesFn).not.toHaveBeenCalled()
		expect(postToIframe).toHaveBeenCalledWith(
			expect.objectContaining({ requestId: "req-delete-project-root", success: false }),
		)
	})

	it("requires confirmation before deleting a project-scope file outside the app root", async () => {
		const deleteFn = vi.fn().mockResolvedValue(undefined)
		const confirmProjectDeleteFn = vi.fn().mockResolvedValue(false)
		const { service, postToIframe } = createService({
			fileList: [file("root-id", "shared.txt", "shared.txt")],
			deleteFn,
			confirmProjectDeleteFn,
		})

		await service.handleMessage(FS_MESSAGE_TYPES.DELETE_FILE_REQUEST, {
			type: FS_MESSAGE_TYPES.DELETE_FILE_REQUEST,
			requestId: "req-confirm-project-delete",
			path: "/shared.txt",
		})

		expect(confirmProjectDeleteFn).toHaveBeenCalledWith({
			path: "shared.txt",
			isDirectory: false,
			appRootDir: "app/",
		})
		expect(deleteFn).not.toHaveBeenCalled()
		expect(postToIframe).toHaveBeenCalledWith(
			expect.objectContaining({ requestId: "req-confirm-project-delete", success: false }),
		)
	})

	it("requires confirmation before deleting a project-scope directory outside the app root", async () => {
		const deleteFilesFn = vi.fn().mockResolvedValue(undefined)
		const confirmProjectDeleteFn = vi.fn().mockResolvedValue(false)
		const { service, postToIframe } = createService({
			fileList: [
				file("dir-id", "archive", "archive"),
				file("child-id", "archive/a.txt", "a.txt"),
			],
			deleteFilesFn,
			confirmProjectDeleteFn,
		})

		await service.handleMessage(FS_MESSAGE_TYPES.DELETE_DIR_REQUEST, {
			type: FS_MESSAGE_TYPES.DELETE_DIR_REQUEST,
			requestId: "req-confirm-project-delete-dir",
			path: "/archive",
		})

		expect(confirmProjectDeleteFn).toHaveBeenCalledWith({
			path: "archive",
			isDirectory: true,
			appRootDir: "app/",
		})
		expect(deleteFilesFn).not.toHaveBeenCalled()
		expect(postToIframe).toHaveBeenCalledWith(
			expect.objectContaining({
				requestId: "req-confirm-project-delete-dir",
				success: false,
			}),
		)
	})

	it("does not ask for confirmation when project-scope directory children fail server validation", async () => {
		const deleteFilesFn = vi.fn().mockResolvedValue(undefined)
		const confirmProjectDeleteFn = vi.fn().mockResolvedValue(true)
		const verifyFileFn = vi.fn(async ({ file_id }: { file_id: string }) => ({
			relative_file_path: file_id === "child-id" ? "other/a.txt" : "archive",
		}))
		const { service, postToIframe } = createService({
			fileList: [
				file("dir-id", "archive", "archive"),
				file("child-id", "archive/a.txt", "a.txt"),
			],
			deleteFilesFn,
			confirmProjectDeleteFn,
			verifyFileFn,
		})

		await service.handleMessage(FS_MESSAGE_TYPES.DELETE_DIR_REQUEST, {
			type: FS_MESSAGE_TYPES.DELETE_DIR_REQUEST,
			requestId: "req-project-dir-invalid-child",
			path: "/archive",
		})

		expect(confirmProjectDeleteFn).not.toHaveBeenCalled()
		expect(deleteFilesFn).not.toHaveBeenCalled()
		expect(postToIframe).toHaveBeenCalledWith(
			expect.objectContaining({ requestId: "req-project-dir-invalid-child", success: false }),
		)
	})

	it("deletes a project-scope file outside the app root after confirmation", async () => {
		const deleteFn = vi.fn().mockResolvedValue(undefined)
		const confirmProjectDeleteFn = vi.fn().mockResolvedValue(true)
		const { service } = createService({
			fileList: [file("root-id", "shared.txt", "shared.txt")],
			deleteFn,
			confirmProjectDeleteFn,
		})

		await service.handleMessage(FS_MESSAGE_TYPES.DELETE_FILE_REQUEST, {
			type: FS_MESSAGE_TYPES.DELETE_FILE_REQUEST,
			requestId: "req-confirmed-project-delete",
			path: "/shared.txt",
		})

		expect(deleteFn).toHaveBeenCalledWith({
			file_id: "root-id",
			project_id: "project-1",
		})
	})

	it("lists project-root files without app manifest file scope", async () => {
		const { service, postToIframe } = createService({
			fileList: [
				file("root-id", "shared.txt", "shared.txt"),
				file("archive-id", "archive", "archive"),
				file("nested-id", "archive/a.txt", "a.txt"),
			],
		})

		await service.handleMessage(FS_MESSAGE_TYPES.LIST_REQUEST, {
			type: FS_MESSAGE_TYPES.LIST_REQUEST,
			requestId: "req-project-list-root",
			dir: "/",
		})

		expect(postToIframe).toHaveBeenCalledWith(
			expect.objectContaining({
				requestId: "req-project-list-root",
				success: true,
				files: ["shared.txt", "archive"],
			}),
		)
	})

	it("resolves project-root source and target directories for moveFile by default", async () => {
		const moveFileFn = vi.fn().mockResolvedValue(undefined)
		const confirmProjectDeleteFn = vi.fn().mockResolvedValue(true)
		const { service } = createService({
			fileList: [
				file("root-id", "shared.txt", "shared.txt"),
				file("archive-id", "archive", "archive"),
			],
			moveFileFn,
			confirmProjectDeleteFn,
		})

		await service.handleMessage(FS_MESSAGE_TYPES.MOVE_FILE_REQUEST, {
			type: FS_MESSAGE_TYPES.MOVE_FILE_REQUEST,
			requestId: "req-project-move",
			path: "/shared.txt",
			targetDir: "/archive",
		})

		expect(moveFileFn).toHaveBeenCalledWith({
			file_id: "root-id",
			target_parent_id: "archive-id",
			project_id: "project-1",
		})
	})

	it("rejects project-scope destructive operations when server verification omits relative path", async () => {
		const deleteFn = vi.fn().mockResolvedValue(undefined)
		const confirmProjectDeleteFn = vi.fn().mockResolvedValue(true)
		const verifyFileFn = vi.fn(async () => ({
			file_name: "shared.txt",
		}))
		const { service, postToIframe } = createService({
			fileList: [file("root-id", "shared.txt", "shared.txt")],
			deleteFn,
			confirmProjectDeleteFn,
			verifyFileFn,
		})

		await service.handleMessage(FS_MESSAGE_TYPES.DELETE_FILE_REQUEST, {
			type: FS_MESSAGE_TYPES.DELETE_FILE_REQUEST,
			requestId: "req-delete-file-name-only",
			path: "/shared.txt",
		})

		expect(confirmProjectDeleteFn).not.toHaveBeenCalled()
		expect(deleteFn).not.toHaveBeenCalled()
		expect(postToIframe).toHaveBeenCalledWith(
			expect.objectContaining({ requestId: "req-delete-file-name-only", success: false }),
		)
	})

	it("rejects destructive operations when server verification returns no canonical path", async () => {
		const deleteFn = vi.fn().mockResolvedValue(undefined)
		const verifyFileFn = vi.fn(async () => ({
			file_name: "other.txt",
		}))
		const { service, postToIframe } = createService({
			fileList: [file("file-id", "app/data.txt", "data.txt")],
			deleteFn,
			verifyFileFn,
		})

		await service.handleMessage(FS_MESSAGE_TYPES.DELETE_FILE_REQUEST, {
			type: FS_MESSAGE_TYPES.DELETE_FILE_REQUEST,
			requestId: "req-delete-file-name-mismatch",
			path: "./data.txt",
		})

		expect(deleteFn).not.toHaveBeenCalled()
		expect(postToIframe).toHaveBeenCalledWith(
			expect.objectContaining({ requestId: "req-delete-file-name-mismatch", success: false }),
		)
	})

	it("requires confirmation before moving a project-scope file outside the app root", async () => {
		const moveFileFn = vi.fn().mockResolvedValue(undefined)
		const confirmProjectDeleteFn = vi.fn().mockResolvedValue(false)
		const { service, postToIframe } = createService({
			fileList: [
				file("root-id", "shared.txt", "shared.txt"),
				file("archive-id", "archive", "archive"),
			],
			moveFileFn,
			confirmProjectDeleteFn,
		})

		await service.handleMessage(FS_MESSAGE_TYPES.MOVE_FILE_REQUEST, {
			type: FS_MESSAGE_TYPES.MOVE_FILE_REQUEST,
			requestId: "req-confirm-project-move",
			path: "/shared.txt",
			targetDir: "/archive",
		})

		expect(confirmProjectDeleteFn).toHaveBeenCalledWith({
			path: "shared.txt",
			isDirectory: false,
			appRootDir: "app/",
			operation: "move",
		})
		expect(moveFileFn).not.toHaveBeenCalled()
		expect(postToIframe).toHaveBeenCalledWith(
			expect.objectContaining({ requestId: "req-confirm-project-move", success: false }),
		)
	})

	it("requires confirmation before renaming a project-scope file outside the app root", async () => {
		const renameFileFn = vi.fn().mockResolvedValue(undefined)
		const confirmProjectDeleteFn = vi.fn().mockResolvedValue(false)
		const { service, postToIframe } = createService({
			fileList: [file("root-id", "shared.txt", "shared.txt")],
			renameFileFn,
			confirmProjectDeleteFn,
		})

		await service.handleMessage(FS_MESSAGE_TYPES.RENAME_FILE_REQUEST, {
			type: FS_MESSAGE_TYPES.RENAME_FILE_REQUEST,
			requestId: "req-confirm-project-rename",
			path: "/shared.txt",
			newName: "renamed.txt",
		})

		expect(confirmProjectDeleteFn).toHaveBeenCalledWith({
			path: "shared.txt",
			isDirectory: false,
			appRootDir: "app/",
			operation: "rename",
		})
		expect(renameFileFn).not.toHaveBeenCalled()
		expect(postToIframe).toHaveBeenCalledWith(
			expect.objectContaining({ requestId: "req-confirm-project-rename", success: false }),
		)
	})

	it("rejects project-scope paths that try to escape the project root", async () => {
		const deleteFn = vi.fn().mockResolvedValue(undefined)
		const { service, postToIframe } = createService({
			fileList: [file("root-id", "shared.txt", "shared.txt")],
			deleteFn,
		})

		await service.handleMessage(FS_MESSAGE_TYPES.DELETE_FILE_REQUEST, {
			type: FS_MESSAGE_TYPES.DELETE_FILE_REQUEST,
			requestId: "req-project-escape",
			path: "/../shared.txt",
		})

		expect(deleteFn).not.toHaveBeenCalled()
		expect(postToIframe).toHaveBeenCalledWith(
			expect.objectContaining({ requestId: "req-project-escape", success: false }),
		)
	})

	it("rejects destructive operations when server file path is outside the app root", async () => {
		const deleteFn = vi.fn().mockResolvedValue(undefined)
		const deleteFilesFn = vi.fn().mockResolvedValue(undefined)
		const moveFileFn = vi.fn().mockResolvedValue(undefined)
		const renameFileFn = vi.fn().mockResolvedValue(undefined)
		const verifyFileFn = vi.fn(async ({ file_id }: { file_id: string }) => ({
			relative_file_path: file_id === "archive-id" ? "app/archive" : "other-app/leaked.txt",
		}))
		const { service, postToIframe } = createService({
			fileList: [
				file("file-id", "app/data.txt", "data.txt"),
				file("dir-id", "app/data", "data"),
				file("child-id", "app/data/a.txt", "a.txt"),
				file("archive-id", "app/archive", "archive"),
			],
			deleteFn,
			deleteFilesFn,
			moveFileFn,
			renameFileFn,
			verifyFileFn,
		})

		await service.handleMessage(FS_MESSAGE_TYPES.DELETE_FILE_REQUEST, {
			type: FS_MESSAGE_TYPES.DELETE_FILE_REQUEST,
			requestId: "req-delete-remote-outside",
			path: "./data.txt",
		})
		await service.handleMessage(FS_MESSAGE_TYPES.DELETE_DIR_REQUEST, {
			type: FS_MESSAGE_TYPES.DELETE_DIR_REQUEST,
			requestId: "req-delete-dir-remote-outside",
			path: "./data",
		})
		await service.handleMessage(FS_MESSAGE_TYPES.MOVE_FILE_REQUEST, {
			type: FS_MESSAGE_TYPES.MOVE_FILE_REQUEST,
			requestId: "req-move-remote-outside",
			path: "./data.txt",
			targetDir: "./archive",
		})
		await service.handleMessage(FS_MESSAGE_TYPES.RENAME_FILE_REQUEST, {
			type: FS_MESSAGE_TYPES.RENAME_FILE_REQUEST,
			requestId: "req-rename-remote-outside",
			path: "./data.txt",
			newName: "renamed.txt",
		})

		expect(deleteFn).not.toHaveBeenCalled()
		expect(deleteFilesFn).not.toHaveBeenCalled()
		expect(moveFileFn).not.toHaveBeenCalled()
		expect(renameFileFn).not.toHaveBeenCalled()
		expect(postToIframe).toHaveBeenCalledWith(
			expect.objectContaining({ requestId: "req-delete-remote-outside", success: false }),
		)
		expect(postToIframe).toHaveBeenCalledWith(
			expect.objectContaining({ requestId: "req-delete-dir-remote-outside", success: false }),
		)
		expect(postToIframe).toHaveBeenCalledWith(
			expect.objectContaining({ requestId: "req-move-remote-outside", success: false }),
		)
		expect(postToIframe).toHaveBeenCalledWith(
			expect.objectContaining({ requestId: "req-rename-remote-outside", success: false }),
		)
	})

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

describe("IframeFSService mutation visibility", () => {
	it("does not change the file list when upload or deletion fails", async () => {
		const original = file("existing", "app/existing.txt")
		const { service, postToIframe } = createService({
			fileList: [original],
			uploadFn: vi.fn().mockRejectedValue(new Error("Upload failed")),
			deleteFn: vi.fn().mockRejectedValue(new Error("Delete failed")),
		})
		await service.handleMessage(FS_MESSAGE_TYPES.WRITE_REQUEST, {
			requestId: "write",
			path: "new.txt",
			content: "new",
		})
		expect(postToIframe).toHaveBeenLastCalledWith(expect.objectContaining({ success: false }))
		await service.handleMessage(FS_MESSAGE_TYPES.DELETE_FILE_REQUEST, {
			requestId: "delete",
			path: "existing.txt",
		})
		expect(postToIframe).toHaveBeenLastCalledWith(expect.objectContaining({ success: false }))
		await service.handleMessage(FS_MESSAGE_TYPES.LIST_REQUEST, { requestId: "list", dir: "./" })
		expect(postToIframe).toHaveBeenLastCalledWith(
			expect.objectContaining({ files: ["existing.txt"] }),
		)
		service.destroy()
	})

	it.each(["text", "blob"])("exposes a new %s file before attachment refresh", async (kind) => {
		const created = file("new-id", "app/data/hello.txt")
		const { service, postToIframe, cfg } = createService({
			uploadFn: vi.fn().mockResolvedValue(created),
			mkdirFn: vi.fn(async ({ name }) => ({ file_id: `dir-${name}` })),
		})
		await service.handleMessage(
			kind === "text" ? FS_MESSAGE_TYPES.WRITE_REQUEST : FS_MESSAGE_TYPES.WRITE_BLOB_REQUEST,
			{
				requestId: "write",
				path: "data/hello.txt",
				content: "hello",
				blob: new Blob(["hello"]),
			},
		)
		expect(postToIframe).toHaveBeenLastCalledWith(
			expect.objectContaining({ requestId: "write", success: true }),
		)
		// A delayed unrelated attachment snapshot must not hide the successful write.
		service.updateFileList([])
		vi.mocked(getIframeDownloadUrl).mockResolvedValue([
			{ file_id: "new-id", url: "https://example.com/hello" },
		])
		const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("hello"))
		try {
			await service.handleMessage(FS_MESSAGE_TYPES.READ_REQUEST, {
				requestId: "read",
				path: "data/hello.txt",
			})
			expect(postToIframe).toHaveBeenLastCalledWith(
				expect.objectContaining({ requestId: "read", success: true, content: "hello" }),
			)
			await service.handleMessage(FS_MESSAGE_TYPES.WRITE_REQUEST, {
				requestId: "overwrite",
				path: "data/hello.txt",
				content: "again",
			})
			expect(cfg.saveContentFn).toHaveBeenCalledWith({ file_id: "new-id", content: "again" })
			expect(cfg.uploadFn).toHaveBeenCalledTimes(1)
		} finally {
			fetchMock.mockRestore()
			service.destroy()
		}
	})

	it("removes deleted directory children before replying and tolerates a stale snapshot", async () => {
		const initial = [
			file("dir", "app/data", "data", { is_directory: true }),
			file("child", "app/data/a.txt"),
		]
		const { service, postToIframe } = createService({
			fileList: initial,
			deleteFilesFn: vi.fn(),
		})
		await service.handleMessage(FS_MESSAGE_TYPES.DELETE_DIR_REQUEST, {
			requestId: "delete",
			path: "data",
		})
		expect(postToIframe).toHaveBeenLastCalledWith(expect.objectContaining({ success: true }))
		service.updateFileList(initial)
		await service.handleMessage(FS_MESSAGE_TYPES.LIST_DIR_REQUEST, {
			requestId: "list",
			dir: "data",
		})
		expect(postToIframe).toHaveBeenLastCalledWith(
			expect.objectContaining({ success: true, entries: [] }),
		)
		// Once acknowledged, subsequent external recreation must be visible again.
		service.updateFileList([])
		service.updateFileList(initial)
		await service.handleMessage(FS_MESSAGE_TYPES.LIST_DIR_REQUEST, {
			requestId: "list-again",
			dir: "data",
		})
		expect(postToIframe).toHaveBeenLastCalledWith(
			expect.objectContaining({ entries: [expect.objectContaining({ name: "a.txt" })] }),
		)
		service.destroy()
	})

	it("keeps rename results without mutating the host snapshot", async () => {
		const initial = [file("id", "app/a.txt", "a.txt")]
		const { service, postToIframe } = createService({
			fileList: initial,
			renameFileFn: vi.fn(),
			deleteFn: vi.fn(),
		})
		await service.handleMessage(FS_MESSAGE_TYPES.RENAME_FILE_REQUEST, {
			requestId: "rename",
			path: "a.txt",
			newName: "b.txt",
		})
		expect(postToIframe).toHaveBeenLastCalledWith(expect.objectContaining({ success: true }))
		expect(initial[0].relative_file_path).toBe("app/a.txt")
		service.updateFileList(initial)
		await service.handleMessage(FS_MESSAGE_TYPES.DELETE_FILE_REQUEST, {
			requestId: "delete",
			path: "b.txt",
		})
		expect(postToIframe).toHaveBeenLastCalledWith(expect.objectContaining({ success: true }))
		service.updateFileList(initial)
		await service.handleMessage(FS_MESSAGE_TYPES.LIST_REQUEST, { requestId: "list", dir: "./" })
		expect(postToIframe).toHaveBeenLastCalledWith(expect.objectContaining({ files: [] }))
		service.destroy()
	})
})
