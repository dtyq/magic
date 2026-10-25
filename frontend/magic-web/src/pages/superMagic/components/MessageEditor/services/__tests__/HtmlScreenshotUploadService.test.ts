import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
	upload: vi.fn(),
	reportFileUploads: vi.fn(),
	batchSaveFiles: vi.fn(),
	getSnowflakeIds: vi.fn(),
	getUploadToken: vi.fn(),
	store: vi.fn(),
	getBlob: vi.fn(),
	delete: vi.fn(),
}))

vi.mock("@dtyq/upload-sdk", () => ({
	Upload: vi.fn().mockImplementation(() => ({ upload: mocks.upload })),
}))
vi.mock("@/apis", () => ({
	FileApi: { reportFileUploads: mocks.reportFileUploads },
	SuperMagicApi: {
		batchSaveFiles: mocks.batchSaveFiles,
		getSnowflakeIds: mocks.getSnowflakeIds,
	},
}))
vi.mock("@/models/user", () => ({
	userStore: { user: { organizationCode: "org-1", authorization: "Bearer token" } },
}))
vi.mock("@/infrastructure/logger", () => ({
	logger: { createLogger: () => ({ error: vi.fn() }) },
}))
vi.mock("../HtmlScreenshotStorage", () => ({
	htmlScreenshotStorage: {
		store: mocks.store,
		getBlob: mocks.getBlob,
		delete: mocks.delete,
	},
}))
vi.mock("../HtmlScreenshotTargetStore", () => ({
	forgetHtmlScreenshotByStorageId: vi.fn(),
}))
vi.mock("../UploadTokenService", () => ({
	superMagicUploadTokenService: {
		getUploadToken: mocks.getUploadToken,
		getUploadTokenUrl: "https://magic.test/upload-token",
	},
}))

import { htmlScreenshotUploadService } from "../HtmlScreenshotUploadService"

describe("HtmlScreenshotUploadService", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		htmlScreenshotUploadService.resetStaging()
		const file = new File(["png"], "screenshot.png", { type: "image/png" })
		mocks.store.mockResolvedValue({
			storageId: "screenshot-storage-id",
			fileName: file.name,
			fileSize: file.size,
			file,
		})
		mocks.getBlob.mockResolvedValue(new Blob(["png"], { type: "image/png" }))
		mocks.getUploadToken.mockResolvedValue({ temporary_credential: { dir: "/root/" } })
		mocks.getSnowflakeIds.mockResolvedValue({ ids: ["snowflake-1"] })
		mocks.reportFileUploads.mockResolvedValue([{ file_id: "reported-id" }])
		mocks.batchSaveFiles.mockResolvedValue([
			{
				file_id: "saved-id",
				file_key: "temporary/screenshot.png",
				file_name: "screenshot.png",
				file_size: 3,
				relative_file_path: "screenshot.png",
			},
		])
		mocks.upload.mockImplementation(() => ({
			success: (callback: (response: { data: { path: string } }) => void) =>
				queueMicrotask(() => callback({ data: { path: "temporary/screenshot.png" } })),
			fail: vi.fn(),
			progress: vi.fn(),
		}))
	})

	it("stores a screenshot in IndexedDB without touching project APIs", async () => {
		const result = await htmlScreenshotUploadService.storeScreenshot({
			dataUrl: "data:image/png;base64,AA==",
			fileName: "screenshot.png",
			captureId: "element:#hero:1",
		})

		expect(mocks.store).toHaveBeenCalledWith(
			"data:image/png;base64,AA==",
			"screenshot.png",
			"element:#hero:1",
		)
		expect(result).toMatchObject({
			storageId: "screenshot-storage-id",
			fileName: "screenshot.png",
			fileSize: 3,
		})
		expect(mocks.batchSaveFiles).not.toHaveBeenCalled()
	})

	it("aligns the stored filename with a WebP data URL", async () => {
		await htmlScreenshotUploadService.storeScreenshot({
			dataUrl: "data:image/webp;base64,AA==",
			fileName: "screenshot.png",
			captureId: "element:#hero:1",
		})

		expect(mocks.store).toHaveBeenCalledWith(
			"data:image/webp;base64,AA==",
			"screenshot.webp",
			"element:#hero:1",
		)
	})

	it("saves a stored screenshot as a topic attachment without creating a folder", async () => {
		const result = await htmlScreenshotUploadService.uploadStoredScreenshot({
			storageId: "screenshot-storage-id",
			fileName: "screenshot.png",
			projectId: "project-1",
			topicId: "topic-1",
		})

		expect(mocks.getSnowflakeIds).toHaveBeenCalledWith({ count: 1 })
		expect(mocks.upload).toHaveBeenCalledWith(
			expect.objectContaining({ fileName: "snowflake-1" }),
		)
		expect(mocks.reportFileUploads).toHaveBeenCalledWith([
			expect.objectContaining({
				file_name: "screenshot.png",
				file_key: "temporary/screenshot.png",
			}),
		])
		expect(mocks.batchSaveFiles).toHaveBeenCalledWith({
			project_id: "project-1",
			files: [
				expect.objectContaining({
					topic_id: "topic-1",
					storage_type: "topic",
					file_name: "screenshot.png",
					relative_file_path: "screenshot.png",
					is_hidden: true,
				}),
			],
		})
		expect(mocks.delete).not.toHaveBeenCalled()
		expect(result).toMatchObject({ file_id: "saved-id", is_hidden: true })
	})

	it("does not upload when snowflake id generation fails", async () => {
		mocks.getSnowflakeIds.mockResolvedValueOnce({ ids: [] })

		await expect(
			htmlScreenshotUploadService.uploadStoredScreenshot({
				storageId: "screenshot-storage-id",
				fileName: "screenshot.png",
				projectId: "project-1",
				topicId: "topic-1",
			}),
		).rejects.toThrow("截图上传未获取到文件ID")

		expect(mocks.upload).not.toHaveBeenCalled()
		expect(mocks.batchSaveFiles).not.toHaveBeenCalled()
	})

	it("saves a stored screenshot without a topic id", async () => {
		const result = await htmlScreenshotUploadService.uploadStoredScreenshot({
			storageId: "screenshot-storage-id",
			fileName: "screenshot.png",
			projectId: "project-1",
		})

		expect(mocks.batchSaveFiles).toHaveBeenCalledWith({
			project_id: "project-1",
			files: [
				expect.objectContaining({
					topic_id: "",
					storage_type: "topic",
					file_name: "screenshot.png",
				}),
			],
		})
		expect(result).toMatchObject({ file_id: "saved-id", is_hidden: true })
	})

	it("deletes IndexedDB blobs only after the caller releases them", async () => {
		const { forgetHtmlScreenshotByStorageId } = await import("../HtmlScreenshotTargetStore")

		await htmlScreenshotUploadService.releaseStoredScreenshots([
			"screenshot-storage-id",
			"screenshot-storage-id-2",
		])

		expect(mocks.delete).toHaveBeenCalledWith("screenshot-storage-id")
		expect(mocks.delete).toHaveBeenCalledWith("screenshot-storage-id-2")
		expect(forgetHtmlScreenshotByStorageId).toHaveBeenCalledWith("screenshot-storage-id")
		expect(forgetHtmlScreenshotByStorageId).toHaveBeenCalledWith("screenshot-storage-id-2")
	})

	it("uploads multiple screenshots with one token, id batch, report, and save", async () => {
		mocks.getSnowflakeIds.mockResolvedValue({ ids: ["snowflake-1", "snowflake-2"] })
		mocks.upload.mockImplementation(({ fileName }: { fileName: string }) => ({
			success: (callback: (response: { data: { path: string } }) => void) =>
				queueMicrotask(() => callback({ data: { path: `temporary/${fileName}` } })),
			fail: vi.fn(),
			progress: vi.fn(),
		}))
		mocks.reportFileUploads.mockResolvedValue([
			{ file_id: "reported-1" },
			{ file_id: "reported-2" },
		])
		mocks.batchSaveFiles.mockResolvedValue([
			{
				file_id: "saved-1",
				file_key: "temporary/snowflake-1",
				file_name: "a.png",
				file_size: 3,
				relative_file_path: "a.png",
			},
			{
				file_id: "saved-2",
				file_key: "temporary/snowflake-2",
				file_name: "b.png",
				file_size: 3,
				relative_file_path: "b.png",
			},
		])

		const results = await htmlScreenshotUploadService.uploadStoredScreenshots(
			[
				{ storageId: "region-1", fileName: "a.png" },
				{ storageId: "region-2", fileName: "b.png" },
			],
			{ projectId: "project-1", topicId: "topic-1" },
		)

		expect(mocks.getUploadToken).toHaveBeenCalledTimes(1)
		expect(mocks.getSnowflakeIds).toHaveBeenCalledTimes(1)
		expect(mocks.getSnowflakeIds).toHaveBeenCalledWith({ count: 2 })
		expect(mocks.reportFileUploads).toHaveBeenCalledTimes(1)
		expect(mocks.reportFileUploads).toHaveBeenCalledWith([
			expect.objectContaining({
				file_name: "a.png",
				file_key: "temporary/snowflake-1",
			}),
			expect.objectContaining({
				file_name: "b.png",
				file_key: "temporary/snowflake-2",
			}),
		])
		expect(mocks.batchSaveFiles).toHaveBeenCalledTimes(1)
		expect(mocks.batchSaveFiles).toHaveBeenCalledWith({
			project_id: "project-1",
			files: [
				expect.objectContaining({
					file_name: "a.png",
					file_key: "temporary/snowflake-1",
					topic_id: "topic-1",
					is_hidden: true,
				}),
				expect.objectContaining({
					file_name: "b.png",
					file_key: "temporary/snowflake-2",
					topic_id: "topic-1",
					is_hidden: true,
				}),
			],
		})
		expect(results).toEqual([
			{
				storageId: "region-1",
				result: expect.objectContaining({ file_id: "saved-1", is_hidden: true }),
			},
			{
				storageId: "region-2",
				result: expect.objectContaining({ file_id: "saved-2", is_hidden: true }),
			},
		])
	})

	it("stages region screenshots to OSS without saving them to the topic", async () => {
		mocks.getSnowflakeIds.mockResolvedValue({ ids: ["snowflake-1", "snowflake-2"] })
		mocks.upload.mockImplementation(({ fileName }: { fileName: string }) => ({
			success: (callback: (response: { data: { path: string } }) => void) =>
				queueMicrotask(() => callback({ data: { path: `temporary/${fileName}` } })),
			fail: vi.fn(),
			progress: vi.fn(),
		}))
		mocks.reportFileUploads.mockResolvedValue([
			{ file_id: "reported-1" },
			{ file_id: "reported-2" },
		])

		const staged = await htmlScreenshotUploadService.stageStoredScreenshots(
			[
				{ storageId: "region-1", fileName: "a.png" },
				{ storageId: "region-2", fileName: "b.png" },
			],
			"project-1",
		)

		expect(mocks.getUploadToken).toHaveBeenCalledTimes(1)
		expect(mocks.getSnowflakeIds).toHaveBeenCalledWith({ count: 2 })
		expect(mocks.reportFileUploads).toHaveBeenCalledTimes(1)
		expect(mocks.batchSaveFiles).not.toHaveBeenCalled()
		expect(staged).toEqual([
			expect.objectContaining({ storageId: "region-1", fileKey: "temporary/snowflake-1" }),
			expect.objectContaining({ storageId: "region-2", fileKey: "temporary/snowflake-2" }),
		])
	})

	it("reuses a saved screenshot and does not batch-save again", async () => {
		await htmlScreenshotUploadService.uploadStoredScreenshots(
			[{ storageId: "region-1", fileName: "a.png" }],
			{ projectId: "project-1", topicId: "topic-1" },
		)
		vi.clearAllMocks()
		mocks.batchSaveFiles.mockResolvedValue([
			{
				file_id: "saved-again",
				file_key: "temporary/screenshot.png",
				file_name: "a.png",
				file_size: 3,
				relative_file_path: "a.png",
			},
		])

		const results = await htmlScreenshotUploadService.uploadStoredScreenshots(
			[{ storageId: "region-1", fileName: "a.png" }],
			{ projectId: "project-1", topicId: "topic-1" },
		)

		expect(mocks.getUploadToken).not.toHaveBeenCalled()
		expect(mocks.upload).not.toHaveBeenCalled()
		expect(mocks.batchSaveFiles).not.toHaveBeenCalled()
		expect(results).toEqual([
			{
				storageId: "region-1",
				result: expect.objectContaining({ file_id: "saved-id", is_hidden: true }),
			},
		])
	})

	it("reuses staged OSS objects and only batch-saves on send", async () => {
		mocks.getSnowflakeIds.mockResolvedValue({ ids: ["snowflake-1"] })
		await htmlScreenshotUploadService.stageStoredScreenshot(
			{ storageId: "region-1", fileName: "a.png" },
			"project-1",
		)
		vi.clearAllMocks()
		mocks.batchSaveFiles.mockResolvedValue([
			{
				file_id: "saved-1",
				file_key: "temporary/snowflake-1",
				file_name: "a.png",
				file_size: 3,
				relative_file_path: "a.png",
			},
		])

		const results = await htmlScreenshotUploadService.uploadStoredScreenshots(
			[{ storageId: "region-1", fileName: "a.png" }],
			{ projectId: "project-1", topicId: "topic-1" },
		)

		expect(mocks.getUploadToken).not.toHaveBeenCalled()
		expect(mocks.getSnowflakeIds).not.toHaveBeenCalled()
		expect(mocks.upload).not.toHaveBeenCalled()
		expect(mocks.reportFileUploads).not.toHaveBeenCalled()
		expect(mocks.batchSaveFiles).toHaveBeenCalledTimes(1)
		expect(results).toEqual([
			{
				storageId: "region-1",
				result: expect.objectContaining({ file_id: "saved-1", is_hidden: true }),
			},
		])
	})

	it("waits for an in-flight save instead of batch-saving twice", async () => {
		const saveResolvers: Array<(value: Array<{ file_id: string }>) => void> = []
		mocks.batchSaveFiles.mockImplementation(
			() =>
				new Promise((resolve) => {
					saveResolvers.push(resolve)
				}),
		)

		const first = htmlScreenshotUploadService.uploadStoredScreenshots(
			[{ storageId: "region-1", fileName: "a.png" }],
			{ projectId: "project-1", topicId: "topic-1" },
		)
		const second = htmlScreenshotUploadService.uploadStoredScreenshots(
			[{ storageId: "region-1", fileName: "a.png" }],
			{ projectId: "project-1", topicId: "topic-1" },
		)
		await vi.waitFor(() => expect(saveResolvers.length).toBeGreaterThan(0))
		expect(saveResolvers).toHaveLength(1)
		saveResolvers[0]([
			{
				file_id: "saved-1",
			},
		])

		await expect(Promise.all([first, second])).resolves.toEqual([
			[
				{
					storageId: "region-1",
					result: expect.objectContaining({ file_id: "saved-1", is_hidden: true }),
				},
			],
			[
				{
					storageId: "region-1",
					result: expect.objectContaining({ file_id: "saved-1", is_hidden: true }),
				},
			],
		])
		expect(mocks.batchSaveFiles).toHaveBeenCalledTimes(1)
	})

	it("waits for an in-flight stage instead of uploading twice", async () => {
		const tokenResolvers: Array<(value: { temporary_credential: { dir: string } }) => void> = []
		mocks.getUploadToken.mockImplementation(
			() =>
				new Promise((resolve) => {
					tokenResolvers.push(resolve)
				}),
		)

		const first = htmlScreenshotUploadService.stageStoredScreenshot(
			{ storageId: "region-1", fileName: "a.png" },
			"project-1",
		)
		const second = htmlScreenshotUploadService.stageStoredScreenshot(
			{ storageId: "region-1", fileName: "a.png" },
			"project-1",
		)
		await vi.waitFor(() => expect(tokenResolvers.length).toBeGreaterThan(0))
		expect(tokenResolvers).toHaveLength(1)
		tokenResolvers[0]({ temporary_credential: { dir: "/root/" } })

		await expect(Promise.all([first, second])).resolves.toEqual([
			expect.objectContaining({ storageId: "region-1" }),
			expect.objectContaining({ storageId: "region-1" }),
		])
		expect(mocks.getUploadToken).toHaveBeenCalledTimes(1)
		expect(mocks.getSnowflakeIds).toHaveBeenCalledTimes(1)
		expect(mocks.upload).toHaveBeenCalledTimes(1)
	})

	it("does not reuse a staged object from another project", async () => {
		mocks.getSnowflakeIds
			.mockResolvedValueOnce({ ids: ["snowflake-1"] })
			.mockResolvedValueOnce({ ids: ["snowflake-2"] })
		mocks.upload.mockImplementation(({ fileName }: { fileName: string }) => ({
			success: (callback: (response: { data: { path: string } }) => void) =>
				queueMicrotask(() => callback({ data: { path: `temporary/${fileName}` } })),
			fail: vi.fn(),
			progress: vi.fn(),
		}))

		await htmlScreenshotUploadService.stageStoredScreenshot(
			{ storageId: "region-1", fileName: "a.png" },
			"project-1",
		)
		await htmlScreenshotUploadService.stageStoredScreenshot(
			{ storageId: "region-1", fileName: "a.png" },
			"project-2",
		)

		expect(mocks.getUploadToken).toHaveBeenCalledTimes(2)
		expect(mocks.getUploadToken).toHaveBeenNthCalledWith(1, "project-1")
		expect(mocks.getUploadToken).toHaveBeenNthCalledWith(2, "project-2")
		expect(mocks.getSnowflakeIds).toHaveBeenCalledTimes(2)
	})

	it("collects region screenshot storage ids for later release", () => {
		expect(
			htmlScreenshotUploadService.collectStorageIds([
				{
					type: "mention",
					attrs: {
						data: {
							is_html_screenshot: true,
							storage_id: "region-1",
						},
					},
				},
				{
					type: "mention",
					attrs: {
						data: {
							file_name: "note.txt",
						},
					},
				},
			]),
		).toEqual(["region-1"])
	})
})
