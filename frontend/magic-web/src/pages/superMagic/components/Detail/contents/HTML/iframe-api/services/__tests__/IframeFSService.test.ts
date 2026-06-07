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
		verifyFileFn: vi.fn(async ({ file_id }) => {
			const item = cfg.fileList.find((f) => f.file_id === file_id)
			return { relative_file_path: item?.relative_file_path || "" }
		}),
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

	it("rejects project-root style paths in the default app scope", async () => {
		const deleteFn = vi.fn().mockResolvedValue(undefined)
		const { service, postToIframe } = createService({
			fileList: [
				file("app-id", "app/shared.txt", "shared.txt"),
				file("root-id", "shared.txt", "shared.txt"),
			],
			deleteFn,
		})

		await service.handleMessage(FS_MESSAGE_TYPES.DELETE_FILE_REQUEST, {
			type: FS_MESSAGE_TYPES.DELETE_FILE_REQUEST,
			requestId: "req-default-project-path",
			path: "/shared.txt",
		})

		expect(deleteFn).not.toHaveBeenCalled()
		expect(postToIframe).toHaveBeenCalledWith(
			expect.objectContaining({ requestId: "req-default-project-path", success: false }),
		)
	})

	it("rejects deleting the project root directory when project file scope is declared", async () => {
		const deleteFilesFn = vi.fn().mockResolvedValue(undefined)
		const confirmProjectDeleteFn = vi.fn().mockResolvedValue(true)
		const { service, postToIframe } = createService({
			appConfig: {
				permissions: {
					files: { scope: "project" },
				},
			},
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
			appConfig: {
				permissions: {
					files: { scope: "project" },
				},
			},
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
			appConfig: {
				permissions: {
					files: { scope: "project" },
				},
			},
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
			expect.objectContaining({ requestId: "req-confirm-project-delete-dir", success: false }),
		)
	})

	it("does not ask for confirmation when project-scope directory children fail server validation", async () => {
		const deleteFilesFn = vi.fn().mockResolvedValue(undefined)
		const confirmProjectDeleteFn = vi.fn().mockResolvedValue(true)
		const verifyFileFn = vi.fn(async ({ file_id }: { file_id: string }) => ({
			relative_file_path: file_id === "child-id" ? "other/a.txt" : "archive",
		}))
		const { service, postToIframe } = createService({
			appConfig: {
				permissions: {
					files: { scope: "project" },
				},
			},
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
			appConfig: {
				permissions: {
					files: { scope: "project" },
				},
			},
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

	it("lists project-root files only when app manifest declares project file scope", async () => {
		const { service, postToIframe } = createService({
			appConfig: {
				permissions: {
					files: { scope: "project" },
				},
			},
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

		it("resolves project-root source and target directories for moveFile when project file scope is declared", async () => {
			const moveFileFn = vi.fn().mockResolvedValue(undefined)
			const confirmProjectDeleteFn = vi.fn().mockResolvedValue(true)
			const { service } = createService({
				appConfig: {
					permissions: {
						files: { scope: "project" },
				},
			},
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

		it("allows destructive operations when server verification omits relative path but confirms file name", async () => {
			const deleteFn = vi.fn().mockResolvedValue(undefined)
			const verifyFileFn = vi.fn(async () => ({
				file_name: "data.txt",
			}))
			const { service } = createService({
				fileList: [file("file-id", "app/data.txt", "data.txt")],
				deleteFn,
				verifyFileFn,
			})

			await service.handleMessage(FS_MESSAGE_TYPES.DELETE_FILE_REQUEST, {
				type: FS_MESSAGE_TYPES.DELETE_FILE_REQUEST,
				requestId: "req-delete-file-name-only",
				path: "./data.txt",
			})

			expect(deleteFn).toHaveBeenCalledWith({
				file_id: "file-id",
				project_id: "project-1",
			})
		})

		it("rejects destructive operations when server verification omits relative path and file name differs", async () => {
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
				appConfig: {
					permissions: {
						files: { scope: "project" },
					},
				},
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
				appConfig: {
					permissions: {
						files: { scope: "project" },
					},
				},
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
			appConfig: {
				permissions: {
					files: { scope: "project" },
				},
			},
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
