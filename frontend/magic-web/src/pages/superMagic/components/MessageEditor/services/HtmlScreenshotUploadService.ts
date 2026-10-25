import { Upload, type UploadConfig } from "@dtyq/upload-sdk"
import { RequestMethod } from "@/apis/constant"
import { FileApi, SuperMagicApi } from "@/apis"
import { userStore } from "@/models/user"
import { logger as Logger } from "@/infrastructure/logger"
import { UploadSource } from "../types"
import { superMagicUploadTokenService } from "./UploadTokenService"
import { htmlScreenshotStorage, type StoredHtmlScreenshot } from "./HtmlScreenshotStorage"
import { forgetHtmlScreenshotByStorageId } from "./HtmlScreenshotTargetStore"
import type { SaveUploadFileToProjectResponse } from "@/pages/superMagic/utils/api"

export interface StoreHtmlScreenshotParams {
	dataUrl: string
	fileName: string
	captureId?: string
}

export interface StagedHtmlScreenshot {
	storageId: string
	fileName: string
	fileSize: number
	fileKey: string
}

export interface UploadStoredScreenshotItem {
	storageId: string
	fileName: string
}

export interface SavedHtmlScreenshot {
	storageId: string
	result: SaveUploadFileToProjectResponse
}

const logger = Logger.createLogger("HtmlScreenshotUpload")

const SCREENSHOT_MIME_EXTENSIONS: Record<string, string> = {
	"image/webp": "webp",
	"image/png": "png",
	"image/jpeg": "jpg",
}

function resolveScreenshotFileName(fileName: string, dataUrl: string): string {
	const mimeType = dataUrl.match(/^data:(image\/(?:webp|png|jpeg));/i)?.[1]?.toLowerCase()
	const extension = mimeType ? SCREENSHOT_MIME_EXTENSIONS[mimeType] : undefined
	if (!extension) return fileName

	const baseName = fileName.replace(/\.[^./\\]+$/, "") || "html-screenshot"
	return `${baseName}.${extension}`
}

/**
 * Region shots upload and batch-save after confirm.
 * AI submit waits for in-flight saves. Element shots stay local.
 */
class HtmlScreenshotUploadService {
	private readonly uploader = new Upload()
	private readonly stagedByStorageId = new Map<string, StagedHtmlScreenshot>()
	private readonly stagingPromises = new Map<string, Promise<StagedHtmlScreenshot>>()
	private readonly savedByStorageId = new Map<string, SavedHtmlScreenshot>()
	private readonly savingPromises = new Map<string, Promise<SavedHtmlScreenshot>>()

	private async uploadToOss(
		file: File,
		fileName: string,
		projectId: string,
		credentials: UploadConfig["customCredentials"],
		onProgress?: (progress: number) => void,
	) {
		const { organizationCode, authorization } = userStore.user
		return new Promise<{ key: string; size: number }>((resolve, reject) => {
			const { success, fail, progress } = this.uploader.upload({
				url: superMagicUploadTokenService.getUploadTokenUrl,
				file,
				fileName,
				method: RequestMethod.POST,
				headers: {
					"Content-Type": "application/json",
					authorization: authorization ?? "",
					"Organization-Code": organizationCode ?? "",
				},
				option: { rewriteFileName: false },
				customCredentials: credentials,
				body: JSON.stringify({ project_id: projectId, expires: 3600 }),
			})

			progress?.((value) => {
				if (typeof value === "number") onProgress?.(Math.round(value))
			})
			success?.((response) => {
				const key = response?.data?.path
				if (!key) {
					reject(new Error("截图上传未返回文件路径"))
					return
				}
				resolve({ key, size: file.size })
			})
			fail?.((error) => reject(new Error(`截图上传失败：${String(error)}`)))
		})
	}

	async storeScreenshot({
		dataUrl,
		fileName,
		captureId,
	}: StoreHtmlScreenshotParams): Promise<StoredHtmlScreenshot> {
		try {
			return await htmlScreenshotStorage.store(
				dataUrl,
				resolveScreenshotFileName(fileName, dataUrl),
				captureId,
			)
		} catch (error) {
			logger.error({
				eventKey: "html_screenshot_store_failed",
				errorKind: "storage",
				error,
				message: "html screenshot storage failed",
			})
			throw error instanceof Error ? error : new Error("截图保存失败")
		}
	}

	async stageStoredScreenshots(
		items: UploadStoredScreenshotItem[],
		projectId: string,
	): Promise<StagedHtmlScreenshot[]> {
		if (!projectId) throw new Error("当前项目不可用，无法保存截图")
		if (items.length === 0) return []

		const resolved: Array<Promise<StagedHtmlScreenshot> | StagedHtmlScreenshot | undefined> =
			Array.from({
				length: items.length,
			})
		const missing: UploadStoredScreenshotItem[] = []
		const missingIndexes: number[] = []

		for (let index = 0; index < items.length; index += 1) {
			const item = items[index]
			const cacheKey = this.stagingKey(projectId, item.storageId)
			const cached = this.stagedByStorageId.get(cacheKey)
			if (cached) {
				resolved[index] = cached
				continue
			}
			const inflight = this.stagingPromises.get(cacheKey)
			if (inflight) {
				resolved[index] = inflight
				continue
			}
			missing.push(item)
			missingIndexes.push(index)
		}

		if (missing.length > 0) {
			const stagedPromise = this.stageUncachedScreenshots(missing, projectId)
			missingIndexes.forEach((itemIndex, stagedIndex) => {
				resolved[itemIndex] = stagedPromise.then((staged) => {
					const match = staged[stagedIndex]
					if (!match) throw new Error("截图上传失败")
					return match
				})
			})
		}

		return Promise.all(resolved as Array<Promise<StagedHtmlScreenshot> | StagedHtmlScreenshot>)
	}

	async stageStoredScreenshot(
		item: UploadStoredScreenshotItem,
		projectId: string,
	): Promise<StagedHtmlScreenshot> {
		const [staged] = await this.stageStoredScreenshots([item], projectId)
		if (!staged) throw new Error("截图上传失败")
		return staged
	}

	async saveStagedScreenshots(
		items: StagedHtmlScreenshot[],
		{ projectId, topicId }: { projectId: string; topicId?: string },
	): Promise<SavedHtmlScreenshot[]> {
		if (!projectId) throw new Error("当前项目不可用，无法保存截图")
		if (items.length === 0) return []

		const saveResults = (await SuperMagicApi.batchSaveFiles({
			project_id: projectId,
			files: items.map((item) => ({
				project_id: projectId,
				topic_id: topicId ?? "",
				task_id: "",
				file_key: item.fileKey,
				file_name: item.fileName,
				file_size: item.fileSize,
				file_type: "user_upload",
				storage_type: "topic",
				source: UploadSource.Home,
				relative_file_path: item.fileName,
				is_hidden: true,
			})),
		})) as SaveUploadFileToProjectResponse[]
		if (!saveResults?.every((item) => item?.file_id) || saveResults.length !== items.length) {
			throw new Error("截图保存到话题失败")
		}

		return items.map((item, index) => ({
			storageId: item.storageId,
			result: { ...saveResults[index], is_hidden: true },
		}))
	}

	async uploadStoredScreenshots(
		items: UploadStoredScreenshotItem[],
		{ projectId, topicId }: { projectId: string; topicId?: string },
	): Promise<SavedHtmlScreenshot[]> {
		if (!projectId) throw new Error("当前项目不可用，无法保存截图")
		if (items.length === 0) return []

		try {
			return await this.resolveSavedScreenshots(items, { projectId, topicId })
		} catch (error) {
			logger.error({
				eventKey: "html_screenshot_upload_failed",
				errorKind: "unknown",
				error,
				message: "html screenshot upload failed",
			})
			throw error instanceof Error ? error : new Error("截图上传失败")
		}
	}

	async uploadStoredScreenshot({
		storageId,
		fileName,
		projectId,
		topicId,
	}: {
		storageId: string
		fileName: string
		projectId: string
		topicId?: string
		onProgress?: (progress: number) => void
	}): Promise<SaveUploadFileToProjectResponse> {
		const [entry] = await this.uploadStoredScreenshots([{ storageId, fileName }], {
			projectId,
			topicId,
		})
		if (!entry) throw new Error("截图上传失败")
		return entry.result
	}

	async getStoredScreenshotBlob(storageId: string): Promise<Blob | null> {
		return htmlScreenshotStorage.getBlob(storageId)
	}

	async discardStoredScreenshot(storageId: string): Promise<void> {
		this.forgetStaged(storageId)
		try {
			await htmlScreenshotStorage.delete(storageId)
		} finally {
			forgetHtmlScreenshotByStorageId(storageId)
		}
	}

	collectUploadItems(
		mentionItems: Array<{ attrs?: { data?: unknown }; data?: unknown }>,
	): UploadStoredScreenshotItem[] {
		const items: UploadStoredScreenshotItem[] = []
		for (const item of mentionItems) {
			const data = item.attrs?.data ?? item.data
			if (!data || typeof data !== "object") continue
			const screenshot = data as {
				is_html_screenshot?: boolean
				storage_id?: unknown
				file_name?: unknown
			}
			if (
				!screenshot.is_html_screenshot ||
				typeof screenshot.storage_id !== "string" ||
				!screenshot.storage_id
			) {
				continue
			}
			items.push({
				storageId: screenshot.storage_id,
				fileName:
					typeof screenshot.file_name === "string" && screenshot.file_name
						? screenshot.file_name
						: `${screenshot.storage_id}.png`,
			})
		}
		return items
	}

	collectStorageIds(mentionItems: Array<{ attrs?: { data?: unknown } }>): string[] {
		return this.collectUploadItems(mentionItems).map((item) => item.storageId)
	}

	async releaseStoredScreenshots(storageIds: string[]): Promise<void> {
		await Promise.all(storageIds.map((storageId) => this.discardStoredScreenshot(storageId)))
	}

	resetStaging(): void {
		this.stagedByStorageId.clear()
		this.stagingPromises.clear()
		this.savedByStorageId.clear()
		this.savingPromises.clear()
	}

	private stagingKey(projectId: string, storageId: string): string {
		return `${projectId}:${storageId}`
	}

	private forgetStaged(storageId: string): void {
		const suffix = `:${storageId}`
		for (const key of [...this.stagedByStorageId.keys()]) {
			if (key.endsWith(suffix)) this.stagedByStorageId.delete(key)
		}
		for (const key of [...this.stagingPromises.keys()]) {
			if (key.endsWith(suffix)) this.stagingPromises.delete(key)
		}
		for (const key of [...this.savedByStorageId.keys()]) {
			if (key.endsWith(suffix)) this.savedByStorageId.delete(key)
		}
		for (const key of [...this.savingPromises.keys()]) {
			if (key.endsWith(suffix)) this.savingPromises.delete(key)
		}
	}

	private async resolveSavedScreenshots(
		items: UploadStoredScreenshotItem[],
		{ projectId, topicId }: { projectId: string; topicId?: string },
	): Promise<SavedHtmlScreenshot[]> {
		const resolved: Array<Promise<SavedHtmlScreenshot> | SavedHtmlScreenshot | undefined> =
			Array.from({
				length: items.length,
			})
		const missing: UploadStoredScreenshotItem[] = []
		const missingIndexes: number[] = []

		for (let index = 0; index < items.length; index += 1) {
			const item = items[index]
			const cacheKey = this.stagingKey(projectId, item.storageId)
			const cached = this.savedByStorageId.get(cacheKey)
			if (cached) {
				resolved[index] = cached
				continue
			}
			const inflight = this.savingPromises.get(cacheKey)
			if (inflight) {
				resolved[index] = inflight
				continue
			}
			missing.push(item)
			missingIndexes.push(index)
		}

		if (missing.length > 0) {
			const savedPromise = this.saveUncachedScreenshots(missing, { projectId, topicId })
			missingIndexes.forEach((itemIndex, savedIndex) => {
				resolved[itemIndex] = savedPromise.then((saved) => {
					const match = saved[savedIndex]
					if (!match) throw new Error("截图上传失败")
					return match
				})
			})
		}

		return Promise.all(resolved as Array<Promise<SavedHtmlScreenshot> | SavedHtmlScreenshot>)
	}

	private async saveUncachedScreenshots(
		items: UploadStoredScreenshotItem[],
		{ projectId, topicId }: { projectId: string; topicId?: string },
	): Promise<SavedHtmlScreenshot[]> {
		let resolveBatch!: (value: SavedHtmlScreenshot[]) => void
		let rejectBatch!: (reason: unknown) => void
		const batchPromise = new Promise<SavedHtmlScreenshot[]>((resolve, reject) => {
			resolveBatch = resolve
			rejectBatch = reject
		})
		const itemPromises = items.map((item) => {
			const itemPromise = batchPromise.then((saved) => {
				const match = saved.find((entry) => entry.storageId === item.storageId)
				if (!match) throw new Error("截图上传失败")
				return match
			})
			this.savingPromises.set(this.stagingKey(projectId, item.storageId), itemPromise)
			return itemPromise
		})

		try {
			const staged = await this.stageStoredScreenshots(items, projectId)
			const saved = await this.saveStagedScreenshots(staged, { projectId, topicId })
			resolveBatch(saved)
			await Promise.all(itemPromises)
			for (const item of saved) {
				this.savedByStorageId.set(this.stagingKey(projectId, item.storageId), item)
			}
			return saved
		} catch (error) {
			rejectBatch(error)
			await Promise.all(itemPromises).catch(() => undefined)
			throw error
		} finally {
			for (const item of items) {
				this.savingPromises.delete(this.stagingKey(projectId, item.storageId))
			}
		}
	}

	private async stageUncachedScreenshots(
		items: UploadStoredScreenshotItem[],
		projectId: string,
	): Promise<StagedHtmlScreenshot[]> {
		let resolveBatch!: (value: StagedHtmlScreenshot[]) => void
		let rejectBatch!: (reason: unknown) => void
		const batchPromise = new Promise<StagedHtmlScreenshot[]>((resolve, reject) => {
			resolveBatch = resolve
			rejectBatch = reject
		})
		const itemPromises = items.map((item) => {
			const itemPromise = batchPromise.then((staged) => {
				const match = staged.find((entry) => entry.storageId === item.storageId)
				if (!match) throw new Error("截图上传失败")
				return match
			})
			this.stagingPromises.set(this.stagingKey(projectId, item.storageId), itemPromise)
			return itemPromise
		})

		try {
			const staged = await this.stageBatch(items, projectId)
			resolveBatch(staged)
			await Promise.all(itemPromises)
			for (const item of staged) {
				this.stagedByStorageId.set(this.stagingKey(projectId, item.storageId), item)
			}
			return staged
		} catch (error) {
			rejectBatch(error)
			await Promise.all(itemPromises).catch(() => undefined)
			throw error
		} finally {
			for (const item of items) {
				this.stagingPromises.delete(this.stagingKey(projectId, item.storageId))
			}
		}
	}

	private async stageBatch(
		items: UploadStoredScreenshotItem[],
		projectId: string,
	): Promise<StagedHtmlScreenshot[]> {
		const files = await Promise.all(
			items.map(async (item) => {
				const blob = await htmlScreenshotStorage.getBlob(item.storageId)
				if (!blob) throw new Error("截图缓存已过期，请重新选择")
				return {
					...item,
					file: new File([blob], item.fileName, {
						type: blob.type || "image/png",
					}),
				}
			}),
		)

		const customCredentials = await superMagicUploadTokenService.getUploadToken(projectId)
		const { ids } = await SuperMagicApi.getSnowflakeIds({ count: files.length })
		if (!ids?.length || ids.length < files.length) {
			throw new Error("截图上传未获取到文件ID")
		}

		const uploadResults = await Promise.all(
			files.map((fileItem, index) =>
				this.uploadToOss(fileItem.file, ids[index], projectId, customCredentials).then(
					(upload) => ({
						storageId: fileItem.storageId,
						fileName: fileItem.fileName,
						fileSize: upload.size,
						fileKey: upload.key,
					}),
				),
			),
		)

		const reportResults = await FileApi.reportFileUploads(
			uploadResults.map((item) => ({
				file_extension: item.fileName.split(".").pop() ?? "",
				file_key: item.fileKey,
				file_size: item.fileSize,
				file_name: item.fileName,
			})),
		)
		if (!reportResults?.every((item) => item?.file_id)) {
			throw new Error("截图上报失败")
		}

		return uploadResults
	}
}

export const htmlScreenshotUploadService = new HtmlScreenshotUploadService()
