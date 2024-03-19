import { makeAutoObservable } from "mobx"
import { logger as Logger } from "@/opensource/utils/log"
import { ossUploadService } from "./uploadService"
import { SuperMagicApi } from "@/opensource/apis"
import {
	generateTaskId,
	createFolderFiles,
	groupFilesByFolder,
	chunkArray,
	delay,
	calculateUploadSpeed,
	estimateTimeRemaining,
} from "./helpers"
import type {
	FolderUploadTask as IFolderUploadTask,
	FolderUploadState,
	FolderUploadOptions,
	SerializedTask,
	TaskCallbacks,
	UploadResult,
	FolderUploadFile,
	BatchUploadInfo,
	BatchSaveInfo,
	UploadFileWithKey,
	FailedFileInfo,
} from "./types"
import magicToast from "@/opensource/components/base/MagicToaster/utils"

const logger = Logger.createLogger("UploadTaskService", {
	enableConfig: { console: true },
})

export class FolderUploadTask implements IFolderUploadTask {
	id: string
	projectId: string
	projectName: string
	workspaceId?: string
	topicId?: string
	taskId?: string
	baseSuffixDir: string
	files: File[]
	fileKeysMap: Map<string, string> // 文件名到自定义fileKey的映射
	state: FolderUploadState
	options: FolderUploadOptions
	createdAt: number
	startedAt?: number
	completedAt?: number
	abortController?: AbortController

	private callbacks: TaskCallbacks = {}
	private t: (key: string, params?: Record<string, unknown>) => string | unknown
	// 文件上传进度跟踪：fileId -> uploadedBytes
	private fileUploadProgress: Map<string, number> = new Map()
	// 文件完成状态跟踪：fileId -> isCompleted
	private fileCompletionStatus: Map<string, boolean> = new Map()
	// 文件大小映射：fileId -> fileSize (用于判断文件是否完成)
	private fileSizeMap: Map<string, number> = new Map()
	// 实时保存相关
	private pendingSaveFiles: UploadResult[] = [] // 待保存的文件结果
	private saveDebounceTimer: NodeJS.Timeout | null = null // 防抖定时器
	private readonly SAVE_DEBOUNCE_DELAY = 5000 // 5秒防抖延迟
	// 文件ID到UploadResult的映射，用于实时保存
	private fileResultMap: Map<string, UploadResult> = new Map()
	// file_key 到 relativePath 的映射，用于 onlyUpload 模式
	private fileKeyToRelativePath: Map<string, string> = new Map()
	// 已保存的文件集合，避免重复保存
	private savedFileKeys: Set<string> = new Set()
	// 完成状态监控定时器
	private completionCheckTimer: NodeJS.Timeout | null = null
	// 失败文件追踪：fileId -> FailedFileInfo
	private failedFilesMap: Map<string, FailedFileInfo> = new Map()

	constructor(
		files: File[] | UploadFileWithKey[],
		baseSuffixDir: string,
		options: FolderUploadOptions & {
			projectName: string
			t: (key: string, params?: Record<string, unknown>) => string | unknown
		},
	) {
		this.id = generateTaskId()
		this.projectId = options.projectId
		this.projectName = options.projectName
		this.workspaceId = options.workspaceId
		this.topicId = options.topicId
		this.taskId = options.taskId
		this.baseSuffixDir = baseSuffixDir

		// 处理文件和自定义fileKey
		if (files.length > 0 && !(files[0] instanceof File)) {
			// UploadFileWithKey[] 格式
			const fileWithKeys = files as UploadFileWithKey[]
			this.files = fileWithKeys.map((item) => item.file)
			this.fileKeysMap = new Map()
			fileWithKeys.forEach((item) => {
				if (item.customFileKey) {
					this.fileKeysMap.set(item.file.name, item.customFileKey)
				}
			})
		} else {
			// File[] 格式
			this.files = files as File[]
			this.fileKeysMap = new Map()
		}

		this.options = options
		this.createdAt = Date.now()
		this.t = options.t

		// 计算总字节数
		const totalBytes = this.files.reduce((sum, file) => sum + file.size, 0)

		this.state = {
			isUploading: false,
			isPaused: false,
			isCompleted: false,
			isError: false,
			totalFiles: files.length,
			processedFiles: 0,
			successFiles: 0,
			errorFiles: 0,
			totalBytes, // 在创建时就计算总字节数
			uploadedBytes: 0,
			currentBatch: 0,
			totalBatches: 0,
			progress: 0,
			currentPhase: "preparing",
			taskId: this.id,
			projectId: this.projectId,
			startTime: 0,
		}

		// 使 FolderUploadTask 实例成为 MobX observable，确保状态变化能被追踪
		makeAutoObservable(this)
	}

	/**
	 * 执行任务
	 */
	async execute(callbacks: TaskCallbacks): Promise<void> {
		this.callbacks = callbacks
		this.abortController = new AbortController()

		try {
			this.updateState({
				isUploading: true,
				currentPhase: "preparing",
				startTime: Date.now(),
			})

			this.startedAt = Date.now()

			// 创建文件夹文件对象
			const folderFiles = createFolderFiles(this.files, this.baseSuffixDir, this.fileKeysMap)
			const folderGroups = groupFilesByFolder(folderFiles, this.baseSuffixDir)
			const batchSize = this.options.batchSize || 10
			const totalBatches = Array.from(folderGroups.values()).reduce(
				(sum, groupFiles) => sum + Math.ceil(groupFiles.length / batchSize),
				0,
			)

			this.updateState({
				totalBatches,
				uploadedBytes: 0,
				currentPhase: "uploading",
			})

			// 按文件夹分组处理
			let currentBatch = 0

			for (const [folderPath, groupFiles] of folderGroups.entries()) {
				if (this.abortController?.signal.aborted) {
					throw new Error("Task cancelled")
				}

				const batches = chunkArray(groupFiles, batchSize)

				for (const batch of batches) {
					if (this.abortController?.signal.aborted) {
						throw new Error("Task cancelled")
					}

					try {
						currentBatch++
						this.updateState({ currentBatch })

						// 上传批次（返回详细的成功/失败计数）
						const { successCount: batchSuccessCount, failedCount: batchFailedCount } =
							await this.uploadBatch(batch, folderPath, currentBatch)

						// 计算这个批次上传的字节数（用于批次回调信息）
						const batchBytes = batch.reduce(
							(sum, folderFile) => sum + folderFile.file.size,
							0,
						)

						// 更新错误文件计数（基于 failedFilesMap 的实际大小）
						if (batchFailedCount > 0 && !this.state.isPaused) {
							this.updateState({
								errorFiles: this.failedFilesMap.size,
							})

							console.log(
								`📁 Batch ${currentBatch}: ${batchSuccessCount} succeeded, ${batchFailedCount} failed, total errors: ${this.failedFilesMap.size}`,
							)
						}

						// 触发批次完成回调
						if (this.callbacks.onBatchUploadComplete) {
							const batchInfo: BatchUploadInfo = {
								taskId: this.id,
								currentBatch,
								totalBatches: this.state.totalBatches,
								batchSuccessCount,
								batchFailedCount,
								folderPath,
								uploadedBytes: this.state.uploadedBytes || 0,
								totalBytes: this.state.totalBytes || 0,
							}
							this.callbacks.onBatchUploadComplete(batchInfo)
						}

						// 移除未使用的变量以避免lint警告
						// batchBytes可以在将来用于更精确的进度计算
						void batchBytes
					} catch (error) {
						const errorMessage = error instanceof Error ? error.message : String(error)
						const isCancelled =
							errorMessage.includes("Task cancelled") ||
							errorMessage.includes("Upload cancelled")

						console.error(`Batch upload failed:`, error)

						// 显示用户友好的提示（取消操作不显示错误）
						if (!isCancelled) {
							logger.error("[uploadBatch] Batch upload failed", {
								error: errorMessage,
								taskId: this.id,
								projectId: this.projectId,
								folderPath,
								batchSize: batch.length,
							})
							magicToast.error(
								String(this.t("folderUpload.errors.batchUploadFailedWithRetry")),
							)
						}

						// 批次完全失败时，将所有未成功的文件标记为失败
						// 注意：暂停状态下或取消状态下不更新错误数
						if (!this.state.isPaused && !isCancelled) {
							// 遍历批次中的所有文件，将未成功上传的文件标记为失败
							batch.forEach((folderFile) => {
								const fileId = `${this.id}_${folderFile.relativePath}_${folderFile.file.name}`
								// 只标记那些既未完成也未记录失败的文件
								if (
									!this.failedFilesMap.has(fileId) &&
									!this.fileCompletionStatus.get(fileId)
								) {
									this.failedFilesMap.set(fileId, {
										fileName: folderFile.file.name,
										filePath: folderFile.relativePath,
										fileSize: folderFile.file.size,
										error: errorMessage,
										failedAt: Date.now(),
										batchNumber: currentBatch,
									})
								}
							})

							// 更新错误文件计数
							this.updateState({
								errorFiles: this.failedFilesMap.size,
							})

							console.log(
								`❌ Batch ${currentBatch} completely failed, total errors: ${this.failedFilesMap.size}`,
							)
						}

						// 如果是取消操作，重新抛出错误让外层处理
						if (isCancelled) {
							throw error
						}
					}
				}
			}

			// 完成 - 确保所有待保存的文件都被保存
			await this.finalizeRemainingFiles()

			// 最终校正文件计数，确保准确性
			this.correctFileCountsAfterBatch()

			// 检查任务是否被暂停，如果被暂停则不设置为完成状态
			if (this.state.isPaused) {
				console.log(`⏸️ Task ${this.id} is paused, not marking as completed`)
				this.updateState({
					isUploading: false,
					currentPhase: "paused",
				})
				// 暂停时不调用 onComplete 回调
				return
			}

			this.completedAt = Date.now()
			this.updateState({
				isUploading: false,
				isCompleted: true,
				currentPhase: "completed",
				progress: 100,
			})

			this.callbacks.onComplete?.(this.id)
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)

			// 检查是否是用户取消操作
			const isCancelled =
				errorMessage.includes("Task cancelled") || errorMessage.includes("Upload cancelled")

			// 其他错误的正常处理
			this.updateState({
				isUploading: false,
				isError: !isCancelled, // 用户取消不算错误
				currentPhase: isCancelled ? "paused" : "error",
				errorMessage,
			})

			// 只在真正的错误时显示提示，用户取消操作不显示任何提示
			if (!isCancelled) {
				logger.error("[execute] Task execution failed", {
					error: errorMessage,
					taskId: this.id,
					projectId: this.projectId,
					projectName: this.projectName,
					totalFiles: this.state.totalFiles,
					processedFiles: this.state.processedFiles,
					successFiles: this.state.successFiles,
					errorFiles: this.state.errorFiles,
				})
				magicToast.error(String(this.t("folderUpload.errors.taskExecutionFailedWithRetry")))
			}

			this.callbacks.onError?.(this.id, error as Error)
		}
	}

	/**
	 * 上传批次（无重试，返回详细的成功/失败计数）
	 */
	private async uploadBatch(
		batch: FolderUploadFile[],
		folderPath: string,
		currentBatch: number,
	): Promise<{ successCount: number; failedCount: number }> {
		if (this.abortController?.signal.aborted) {
			throw new Error("Task cancelled")
		}

		// 等待暂停状态
		await this.waitIfPaused()

		// OSS 上传（文件会在完成时自动实时保存，返回成功和失败的结果）
		const { results: ossResults, failedFiles } = await this.uploadFilesToOSS(batch, folderPath)

		// 记录失败的文件到 failedFilesMap
		if (failedFiles.length > 0) {
			failedFiles.forEach((failedFile) => {
				const fileId = `${this.id}_${failedFile.filePath}_${failedFile.fileName}`
				this.failedFilesMap.set(fileId, {
					...failedFile,
					batchNumber: currentBatch,
				})
			})
			console.log(
				`❌ Batch ${currentBatch}: ${failedFiles.length} files failed, total failed: ${this.failedFilesMap.size}`,
			)
		}

		// 兜底保存：确保所有文件都被保存到项目（过滤掉已保存的文件）
		// 如果 onlyUpload 为 true，跳过保存到项目的步骤
		if (!this.options.onlyUpload) {
			const unsavedFiles = ossResults.filter(
				(result) => !this.savedFileKeys.has(result.file_key),
			)

			if (unsavedFiles.length > 0) {
				console.log(
					`🔄 Batch fallback save: Found ${unsavedFiles.length} unsaved files, saving them now`,
				)
				const savedFilesWithIds = await this.saveBatchToProject(unsavedFiles)

				// 记录已保存的文件
				unsavedFiles.forEach((file) => {
					this.savedFileKeys.add(file.file_key)
				})

				// 触发批量保存完成回调（兜底保存），包含 file_id
				if (this.callbacks.onBatchSaveComplete && unsavedFiles.length > 0) {
					const batchSaveInfo: BatchSaveInfo = {
						taskId: this.id,
						savedFilesCount: unsavedFiles.length,
						totalProcessedFiles: this.state.processedFiles,
						savedFiles: savedFilesWithIds.map((file) => ({
							file_key: file.file_key,
							file_name: file.file_name,
							file_size: file.file_size,
							file_id: file.file_id,
							relative_file_path: file.relative_file_path,
						})),
					}
					this.callbacks.onBatchSaveComplete(batchSaveInfo)
					console.log(
						`📡 Triggered fallback onBatchSaveComplete callback for ${unsavedFiles.length} files`,
					)
				}
			} else {
				console.log(
					`✅ All ${ossResults.length} files already saved via real-time mechanism`,
				)
			}
		} else {
			// onlyUpload 模式：标记所有文件为已保存（实际未保存到项目）
			ossResults.forEach((file) => {
				this.savedFileKeys.add(file.file_key)
			})
			console.log(`📤 onlyUpload mode: Skipped saving ${ossResults.length} files to project`)

			// 触发批量上传完成回调，返回上传结果（包含 file_key）
			if (this.callbacks.onBatchSaveComplete) {
				const batchSaveInfo: BatchSaveInfo = {
					taskId: this.id,
					savedFilesCount: ossResults.length,
					totalProcessedFiles: this.state.processedFiles,
					savedFiles: ossResults.map((file) => ({
						file_key: file.file_key,
						file_name: file.file_name,
						file_size: file.file_size,
					})),
				}
				this.callbacks.onBatchSaveComplete(batchSaveInfo)
				console.log(
					`📡 Triggered onBatchSaveComplete callback for ${ossResults.length} uploaded files (onlyUpload fallback)`,
				)
			}
		}

		// 校正文件计数：基于实际保存的文件数量更新processedFiles
		this.correctFileCountsAfterBatch()

		// 返回详细的成功/失败计数
		return {
			successCount: ossResults.length,
			failedCount: failedFiles.length,
		}
	}

	/**
	 * 上传文件到OSS (支持实时进度更新，使用Promise.allSettled追踪每个文件)
	 */
	private async uploadFilesToOSS(
		folderFiles: FolderUploadFile[],
		folderPath: string,
	): Promise<{ results: UploadResult[]; failedFiles: FailedFileInfo[] }> {
		// 检查是否被取消
		if (this.abortController?.signal.aborted) {
			throw new Error("Upload cancelled")
		}

		// 等待暂停状态
		await this.waitIfPaused()

		// 为每个文件初始化进度跟踪（使用包含taskId的文件ID）
		folderFiles.forEach((folderFile) => {
			const fileId = `${this.id}_${folderFile.relativePath}_${folderFile.file.name}`
			this.fileUploadProgress.set(fileId, 0)
			this.fileCompletionStatus.set(fileId, false)
			this.fileSizeMap.set(fileId, folderFile.file.size)
		})

		// 为每个文件创建单独的上传Promise
		const uploadPromises = folderFiles.map((folderFile) => {
			return ossUploadService.uploadFiles(
				[folderFile], // 单个文件作为数组传入
				this.projectId,
				folderPath || this.baseSuffixDir,
				this.id, // 传递 taskId
				// 进度回调函数
				(fileId: string, uploadedBytes: number) => {
					// 更新单个文件的进度
					this.fileUploadProgress.set(fileId, uploadedBytes)

					// 计算并更新总体进度
					this.updateRealTimeProgress()
				},
				// 文件完成回调函数
				(fileId: string, result: UploadResult) => {
					// 处理单文件完成的实时保存
					this.handleFileCompleted(fileId, result)
				},
			)
		})

		// 使用 Promise.allSettled 等待所有上传完成
		const settledResults = await Promise.allSettled(uploadPromises)

		// 分离成功和失败的结果
		const successResults: UploadResult[] = []
		const failedFiles: FailedFileInfo[] = []

		settledResults.forEach((result, index) => {
			const folderFile = folderFiles[index]

			if (result.status === "fulfilled") {
				// 上传成功，添加到结果列表
				successResults.push(...result.value)
			} else {
				// 上传失败，记录失败信息
				const errorMessage =
					result.reason instanceof Error
						? result.reason.message
						: String(result.reason || "Unknown error")

				// 跳过暂停导致的"失败"
				const isPaused = errorMessage.includes("isPause")
				if (!isPaused) {
					failedFiles.push({
						fileName: folderFile.file.name,
						filePath: folderFile.relativePath,
						fileSize: folderFile.file.size,
						error: errorMessage,
						failedAt: Date.now(),
					})

					logger.error("[uploadFilesToOSS] File upload failed", {
						fileName: folderFile.file.name,
						filePath: folderFile.relativePath,
						error: errorMessage,
						taskId: this.id,
						projectId: this.projectId,
					})
				}
			}
		})

		console.log(
			`Upload completed: ${successResults.length} succeeded, ${failedFiles.length} failed (project ${this.projectId})`,
		)

		return { results: successResults, failedFiles }
	}

	/**
	 * 批量保存到项目
	 * @returns 保存后的文件信息（包含 file_id）
	 */
	private async saveBatchToProject(ossResults: UploadResult[]): Promise<
		Array<{
			file_id: string
			file_key: string
			file_name: string
			file_size: number
			relative_file_path: string
		}>
	> {
		this.updateState({ currentPhase: "saving" })

		try {
			// 获取父级ID
			const parentId = this.getParentIdFromPath()?.toString() || ""

			const payload = {
				project_id: this.projectId,
				parent_id: parentId,
				files: ossResults.map((result) => ({
					project_id: this.projectId,
					topic_id: this.topicId || "",
					task_id: this.taskId || "",
					file_key: result.file_key,
					file_name: result.file_name,
					file_size: result.file_size,
					file_type: "user_upload",
					storage_type: this.options.storageType || "workspace",
					source: (this.options.source as number) || 2,
				})),
			}

			const batchSaveResult = await SuperMagicApi.batchSaveFiles(payload)
			this.updateState({ currentPhase: "uploading" })

			// 返回 API 响应中的文件信息
			return (batchSaveResult as any[]).map((file: any) => ({
				file_id: file.file_id,
				file_key: file.file_key,
				file_name: file.file_name,
				file_size: file.file_size,
				relative_file_path: file.relative_file_path,
			}))
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			console.error("Failed to save batch to project:", error)

			logger.error("[saveBatchToProject] Failed to save batch to project", {
				error: errorMessage,
				taskId: this.id,
				projectId: this.projectId,
				fileCount: ossResults.length,
				fullErrorObject: JSON.stringify(error),
			})

			// 显示用户友好的错误提示
			magicToast.error(String(this.t("folderUpload.errors.saveToProjectFailedWithRetry")))
			throw error
		}
	}

	/**
	 * 获取父级ID
	 */
	private getParentIdFromPath(): string | number | undefined {
		// 这里需要根据实际项目的attachments来解析
		// 暂时返回空字符串，表示根目录
		return ""
	}

	/**
	 * 等待暂停状态
	 */
	private async waitIfPaused(): Promise<void> {
		while (this.state.isPaused && !this.abortController?.signal.aborted) {
			await delay(100)
		}
	}

	/**
	 * 处理单文件完成时的实时保存
	 */
	private handleFileCompleted(fileId: string, uploadResult: UploadResult): void {
		// 从 fileId 中提取 relativePath: fileId 格式为 `${taskId}_${relativePath}_${fileName}`
		const relativePathMatch = fileId.match(new RegExp(`^${this.id}_(.+?)_[^_]+$`))
		if (relativePathMatch) {
			const relativePath = relativePathMatch[1]
			this.fileKeyToRelativePath.set(uploadResult.file_key, relativePath)
		}

		// 添加到待保存队列（无论是否 onlyUpload，都需要收集上传结果）
		this.pendingSaveFiles.push(uploadResult)

		// 如果只上传不保存，直接标记为已保存（实际未保存，但跳过保存流程）
		if (this.options.onlyUpload) {
			this.savedFileKeys.add(uploadResult.file_key)
			console.log(
				`📁 File ${fileId} completed (onlyUpload mode, will trigger callback with results)`,
			)

			// 清除现有的防抖定时器
			if (this.saveDebounceTimer) {
				clearTimeout(this.saveDebounceTimer)
			}

			// 设置新的防抖定时器，用于触发回调返回上传结果
			this.saveDebounceTimer = setTimeout(() => {
				this.notifyUploadResults()
			}, this.SAVE_DEBOUNCE_DELAY)

			console.log(
				`📁 File ${fileId} added to pending results queue. Queue length: ${this.pendingSaveFiles.length}`,
			)
			return
		}

		// 清除现有的防抖定时器
		if (this.saveDebounceTimer) {
			clearTimeout(this.saveDebounceTimer)
		}

		// 设置新的防抖定时器
		this.saveDebounceTimer = setTimeout(() => {
			this.executePendingSave()
		}, this.SAVE_DEBOUNCE_DELAY)

		console.log(
			`📁 File ${fileId} completed, added to pending save queue. Queue length: ${this.pendingSaveFiles.length}`,
		)
	}

	/**
	 * 执行待保存文件的批量保存
	 */
	private async executePendingSave(): Promise<void> {
		if (this.pendingSaveFiles.length === 0) return

		const filesToSave = [...this.pendingSaveFiles] // 复制数组
		this.pendingSaveFiles = [] // 清空待保存队列

		try {
			console.log(`📁 Executing real-time batch save for ${filesToSave.length} files`)
			const savedFilesWithIds = await this.saveBatchToProject(filesToSave)
			console.log(`✅ Successfully saved ${filesToSave.length} files to project`)

			// 记录已保存的文件，避免重复保存
			filesToSave.forEach((file) => {
				this.savedFileKeys.add(file.file_key)
			})

			// 触发批量保存完成回调
			if (this.callbacks.onBatchSaveComplete) {
				const batchSaveInfo: BatchSaveInfo = {
					taskId: this.id,
					savedFilesCount: filesToSave.length,
					totalProcessedFiles: this.state.processedFiles,
					savedFiles: savedFilesWithIds.map((file) => ({
						file_key: file.file_key,
						file_name: file.file_name,
						file_size: file.file_size,
						file_id: file.file_id,
						relative_file_path: file.relative_file_path,
					})),
				}
				this.callbacks.onBatchSaveComplete(batchSaveInfo)
				console.log(
					`📡 Triggered onBatchSaveComplete callback for ${filesToSave.length} files`,
				)
			}
		} catch (error) {
			console.error("Failed to save batch to project:", error)
			// 如果保存失败，可以选择重新添加到队列或其他错误处理策略
			// 这里选择记录错误但不重试，避免无限循环
		}

		// 清除定时器引用
		this.saveDebounceTimer = null
	}

	/**
	 * 通知上传结果（onlyUpload 模式）
	 */
	private notifyUploadResults(): void {
		if (this.pendingSaveFiles.length === 0) return

		const uploadedFiles = [...this.pendingSaveFiles] // 复制数组
		this.pendingSaveFiles = [] // 清空队列

		console.log(
			`📤 Notifying upload results for ${uploadedFiles.length} files (onlyUpload mode)`,
		)

		// 触发回调，返回上传结果（包含 file_key）
		if (this.callbacks.onBatchSaveComplete) {
			const batchSaveInfo: BatchSaveInfo = {
				taskId: this.id,
				savedFilesCount: uploadedFiles.length,
				totalProcessedFiles: this.state.processedFiles,
				savedFiles: uploadedFiles.map((file) => ({
					file_key: file.file_key,
					file_name: file.file_name,
					file_size: file.file_size,
				})),
			}
			this.callbacks.onBatchSaveComplete(batchSaveInfo)
			console.log(
				`📡 Triggered onBatchSaveComplete callback for ${uploadedFiles.length} uploaded files (onlyUpload mode)`,
			)
		}

		// 清除定时器引用
		this.saveDebounceTimer = null
	}

	/**
	 * 校正文件计数：基于实际保存的文件数量
	 */
	private correctFileCountsAfterBatch(): void {
		const actualSuccessFiles = this.savedFileKeys.size
		const currentProcessedFiles = this.state.processedFiles
		const currentSuccessFiles = this.state.successFiles
		const actualErrorFiles = this.failedFilesMap.size

		// 🚨 检测异常：processedFiles 包含了失败的文件
		if (currentProcessedFiles > actualSuccessFiles) {
			const incorrectCount = currentProcessedFiles - actualSuccessFiles

			// 收集失败文件的详细信息
			const failedFilesDetails = Array.from(this.failedFilesMap.values()).map((file) => ({
				fileName: file.fileName,
				filePath: file.filePath,
				fileSize: file.fileSize,
				error: file.error,
				batchNumber: file.batchNumber,
			}))

			// 上报异常情况
			logger.error("[FolderUpload] File count anomaly detected", {
				taskId: this.id,
				projectId: this.projectId,
				projectName: this.projectName,
				anomaly: {
					type: "processedFiles_includes_failed_files",
					description: `processedFiles (${currentProcessedFiles}) includes ${incorrectCount} failed files`,
					incorrectDisplay: `${currentProcessedFiles}/${this.state.totalFiles}`,
					correctDisplay: `${actualSuccessFiles}/${this.state.totalFiles}`,
				},
				counts: {
					totalFiles: this.state.totalFiles,
					processedFiles_before: currentProcessedFiles,
					processedFiles_after: actualSuccessFiles,
					successFiles_before: currentSuccessFiles,
					successFiles_after: actualSuccessFiles,
					errorFiles_before: this.state.errorFiles,
					errorFiles_after: actualErrorFiles,
					savedFileKeysSize: this.savedFileKeys.size,
					failedFilesMapSize: this.failedFilesMap.size,
				},
				state: {
					isCompleted: this.state.isCompleted,
					isError: this.state.isError,
					isPaused: this.state.isPaused,
					currentPhase: this.state.currentPhase,
					progress: this.state.progress,
					currentBatch: this.state.currentBatch,
					totalBatches: this.state.totalBatches,
				},
				failedFiles: failedFilesDetails,
				timestamp: Date.now(),
			})

			console.warn(
				`⚠️ [ANOMALY DETECTED] Task ${this.id} (${this.projectName}): ` +
					`processedFiles=${currentProcessedFiles} but only ${actualSuccessFiles} files saved. ` +
					`${incorrectCount} failed files were incorrectly counted. Correcting now.`,
			)
		}

		// 🔧 修复：无论如何都强制校正为准确值
		// processedFiles 应该严格等于 savedFileKeys.size（只包含成功保存的）
		// errorFiles 应该严格等于 failedFilesMap.size
		if (
			actualSuccessFiles !== currentProcessedFiles ||
			actualSuccessFiles !== currentSuccessFiles ||
			actualErrorFiles !== this.state.errorFiles
		) {
			console.log(
				`🔧 Correcting file counts: processedFiles ${currentProcessedFiles} → ${actualSuccessFiles}, successFiles ${currentSuccessFiles} → ${actualSuccessFiles}, errorFiles ${this.state.errorFiles} → ${actualErrorFiles}`,
			)

			this.updateState({
				processedFiles: actualSuccessFiles,
				successFiles: actualSuccessFiles,
				errorFiles: actualErrorFiles,
			})
		}
	}

	/**
	 * 完成任务前保存所有剩余的待保存文件
	 */
	private async finalizeRemainingFiles(): Promise<void> {
		// 取消防抖定时器
		if (this.saveDebounceTimer) {
			clearTimeout(this.saveDebounceTimer)
			this.saveDebounceTimer = null
		}

		// 如果 onlyUpload 为 true，跳过保存到项目的步骤，但触发回调返回上传结果
		if (this.options.onlyUpload) {
			// 过滤掉已通知的文件
			const unnotifiedFiles = this.pendingSaveFiles.filter(
				(file) => !this.savedFileKeys.has(file.file_key),
			)

			if (unnotifiedFiles.length > 0) {
				console.log(
					`📤 onlyUpload mode: Finalizing ${unnotifiedFiles.length} uploaded files (filtered from ${this.pendingSaveFiles.length} pending)`,
				)

				// 标记这些文件
				unnotifiedFiles.forEach((file) => {
					this.savedFileKeys.add(file.file_key)
				})

				// 触发回调，返回上传结果
				if (this.callbacks.onBatchSaveComplete) {
					const batchSaveInfo: BatchSaveInfo = {
						taskId: this.id,
						savedFilesCount: unnotifiedFiles.length,
						totalProcessedFiles: this.state.processedFiles,
						savedFiles: unnotifiedFiles.map((file) => ({
							file_key: file.file_key,
							file_name: file.file_name,
							file_size: file.file_size,
						})),
					}
					this.callbacks.onBatchSaveComplete(batchSaveInfo)
					console.log(
						`📡 Triggered final onBatchSaveComplete callback for ${unnotifiedFiles.length} uploaded files (onlyUpload mode)`,
					)
				}
			} else if (this.pendingSaveFiles.length > 0) {
				console.log(
					`✅ All ${this.pendingSaveFiles.length} pending files already notified via callback`,
				)
			}

			// 清空待保存队列
			this.pendingSaveFiles = []
			console.log(`📤 onlyUpload mode: Completed finalizing uploaded files`)
			return
		}

		// 过滤掉已保存的文件，只保存真正未保存的文件
		const unsavedFiles = this.pendingSaveFiles.filter(
			(file) => !this.savedFileKeys.has(file.file_key),
		)

		if (unsavedFiles.length > 0) {
			console.log(
				`📁 Finalizing ${unsavedFiles.length} remaining unsaved files before task completion (filtered from ${this.pendingSaveFiles.length} pending)`,
			)

			// 直接保存未保存的文件，不走pendingSaveFiles队列
			try {
				const savedFilesWithIds = await this.saveBatchToProject(unsavedFiles)
				console.log(`✅ Successfully finalized ${unsavedFiles.length} files to project`)

				// 记录已保存的文件
				unsavedFiles.forEach((file) => {
					this.savedFileKeys.add(file.file_key)
				})

				// 触发批量保存完成回调（最终保存）
				if (this.callbacks.onBatchSaveComplete) {
					const batchSaveInfo: BatchSaveInfo = {
						taskId: this.id,
						savedFilesCount: unsavedFiles.length,
						totalProcessedFiles: this.state.processedFiles,
						savedFiles: savedFilesWithIds.map((file) => ({
							file_key: file.file_key,
							file_name: file.file_name,
							file_size: file.file_size,
							file_id: file.file_id,
							relative_file_path: file.relative_file_path,
						})),
					}
					this.callbacks.onBatchSaveComplete(batchSaveInfo)
					console.log(
						`📡 Triggered final onBatchSaveComplete callback for ${unsavedFiles.length} files`,
					)
				}
			} catch (error) {
				console.error("Failed to finalize batch save:", error)
			}
		} else if (this.pendingSaveFiles.length > 0) {
			console.log(
				`✅ All ${this.pendingSaveFiles.length} pending files already saved, no finalization needed`,
			)
		}

		// 清空待保存队列
		this.pendingSaveFiles = []
	}

	/**
	 * 实时更新进度（根据已上传字节数和文件完成状态）
	 */
	private updateRealTimeProgress(): void {
		// 如果任务已暂停，不更新进度
		if (this.state.isPaused) {
			console.log(`⏸️ Task ${this.id} is paused, skipping progress update`)
			return
		}

		// 计算当前所有文件的已上传字节数总和
		const currentUploadedBytes = Array.from(this.fileUploadProgress.values()).reduce(
			(sum, bytes) => sum + bytes,
			0,
		)

		// 检查并更新文件完成状态
		let newCompletedFiles = 0
		for (const [fileId, uploadedBytes] of this.fileUploadProgress.entries()) {
			const fileSize = this.fileSizeMap.get(fileId) || 0
			const isCompleted = this.fileCompletionStatus.get(fileId) || false

			// 如果文件已上传完整且之前未标记为完成
			if (!isCompleted && uploadedBytes >= fileSize && fileSize > 0) {
				this.fileCompletionStatus.set(fileId, true)
				newCompletedFiles++
				console.log(
					`📁 File completed: ${fileId}, size: ${fileSize}, uploaded: ${uploadedBytes}`,
				)
			}
		}

		// 计算当前已完成文件总数
		const totalCompletedFiles = Array.from(this.fileCompletionStatus.values()).filter(
			Boolean,
		).length

		const totalBytes = this.state.totalBytes || 0
		if (totalBytes === 0) return

		// 根据字节数计算进度
		const progress = Math.min(100, Math.round((currentUploadedBytes / totalBytes) * 100))

		// 构建要更新的状态
		const updates: Partial<FolderUploadState> = {
			uploadedBytes: currentUploadedBytes,
			progress,
		}

		// 如果有新完成的文件，更新文件计数（假设OSS上传成功的文件都是成功的）
		if (newCompletedFiles > 0 || totalCompletedFiles !== this.state.processedFiles) {
			updates.processedFiles = totalCompletedFiles
			updates.successFiles = totalCompletedFiles
			updates.errorFiles = Math.max(0, this.state.errorFiles) // 保持现有错误文件数

			console.log(
				`📁 Task ${this.id}: Updated processedFiles to ${totalCompletedFiles} (${newCompletedFiles} new completed)`,
			)
		}

		// 更新状态
		this.updateState(updates)

		// 更新上传统计信息（速度、剩余时间等）
		this.updateUploadStats()
	}

	/**
	 * 更新上传统计信息
	 */
	private updateUploadStats(): void {
		if (!this.state.startTime) return

		// 使用真实的已上传字节数
		const uploadedBytes = this.state.uploadedBytes || 0
		const totalBytes = this.state.totalBytes || 0
		const speed = calculateUploadSpeed(uploadedBytes, this.state.startTime)
		const remaining = estimateTimeRemaining(totalBytes, uploadedBytes, speed)

		this.updateState({
			uploadSpeed: speed,
			estimatedTimeRemaining: remaining,
		})
	}

	/**
	 * 更新状态
	 */
	updateState(updates: Partial<FolderUploadState>): void {
		this.state = { ...this.state, ...updates }
		this.callbacks.onProgress?.(this.id, this.state)
	}

	/**
	 * 清理文件跟踪状态 - 用于重试时重置
	 */
	clearFileTrackingState(): void {
		this.fileUploadProgress.clear()
		this.fileCompletionStatus.clear()
		this.fileSizeMap.clear()
		console.log(`🧹 Cleared file tracking state for task ${this.id}`)
	}

	/**
	 * 取消任务
	 */
	async cancel(): Promise<void> {
		// 停止完成状态监控
		this.stopCompletionMonitoring()

		// 首先取消所有OSS上传
		try {
			ossUploadService.cancelTaskUploads(this.id)
			console.log(`🛑 Cancelled all OSS uploads for task ${this.id}`)
		} catch (error) {
			console.error(`Failed to cancel OSS uploads for task ${this.id}:`, error)
			// 如果取消失败，尝试强制清理
			try {
				ossUploadService.forceCleanupTask(this.id)
				console.log(`🧹 Force cleaned OSS uploads for task ${this.id}`)
			} catch (forceError) {
				console.error(
					`Failed to force cleanup OSS uploads for task ${this.id}:`,
					forceError,
				)
			}
		}

		// 然后取消任务本身
		this.abortController?.abort()

		// 清理文件跟踪状态
		this.fileUploadProgress.clear()
		this.fileCompletionStatus.clear()
		this.fileSizeMap.clear()
		this.fileResultMap.clear()
		this.fileKeyToRelativePath.clear()

		// 清理实时保存状态
		this.pendingSaveFiles = []
		this.savedFileKeys.clear()
		if (this.saveDebounceTimer) {
			clearTimeout(this.saveDebounceTimer)
			this.saveDebounceTimer = null
		}

		this.updateState({
			isUploading: false,
			currentPhase: "error",
			errorMessage: "Task cancelled",
		})

		// 如果 callbacks 已设置，触发 onError 回调
		if (this.callbacks?.onError) {
			try {
				this.callbacks.onError(this.id, new Error("Task cancelled"))
			} catch (error) {
				console.error(`Failed to call onError callback for task ${this.id}:`, error)
			}
		}
	}

	/**
	 * 暂停任务
	 */
	pause(): void {
		this.updateState({
			isPaused: true,
			currentPhase: "paused",
		})

		// 停止完成状态监控
		this.stopCompletionMonitoring()

		// 暂停所有正在进行的OSS上传
		this.pauseActiveUploads()
	}

	/**
	 * 恢复任务
	 */
	resume(): void {
		this.updateState({
			isPaused: false,
			isUploading: true,
			currentPhase: "uploading",
		})

		// 恢复所有被暂停的OSS上传
		this.resumeActiveUploads()

		// 启动完成状态监控（持续检查直到任务完成）
		this.startCompletionMonitoring()
	}

	/**
	 * 启动完成状态监控（轮询方式）
	 */
	private startCompletionMonitoring(): void {
		// 清除之前的定时器（如果有）
		this.stopCompletionMonitoring()

		console.log(`🔍 Starting completion monitoring for task ${this.id}`)

		// 立即执行一次检查
		this.checkCompletionStatus()

		// 启动定时器，每2秒检查一次
		this.completionCheckTimer = setInterval(() => {
			this.checkCompletionStatus()
		}, 2000)
	}

	/**
	 * 停止完成状态监控
	 */
	private stopCompletionMonitoring(): void {
		if (this.completionCheckTimer) {
			clearInterval(this.completionCheckTimer)
			this.completionCheckTimer = null
			console.log(`🛑 Stopped completion monitoring for task ${this.id}`)
		}
	}

	/**
	 * 检查完成状态（单次检查）
	 */
	private async checkCompletionStatus(): Promise<void> {
		// 如果任务已经完成或被暂停，停止监控
		if (this.state.isCompleted || this.state.isPaused) {
			this.stopCompletionMonitoring()
			return
		}

		try {
			// 检查是否还有活跃的上传
			const hasActiveUploads = ossUploadService.hasActiveUploadsForTask(this.id)

			console.log(
				`🔍 Checking completion: hasActiveUploads=${hasActiveUploads}, processed=${this.state.processedFiles}/${this.files.length}`,
			)

			if (!hasActiveUploads) {
				// 没有活跃上传，检查是否所有文件都已完成
				const allFilesCompleted = this.checkIfAllFilesCompleted()

				if (allFilesCompleted) {
					// 停止监控
					this.stopCompletionMonitoring()

					// 确保所有待保存的文件都被保存
					await this.finalizeRemainingFiles()

					// 最终校正文件计数
					this.correctFileCountsAfterBatch()

					// 标记任务为完成
					this.completedAt = Date.now()
					this.updateState({
						isUploading: false,
						isCompleted: true,
						currentPhase: "completed",
						progress: 100,
					})

					console.log(`✅ Task ${this.id} marked as completed after monitoring`)
					this.callbacks.onComplete?.(this.id)
				}
			}
		} catch (error) {
			console.error(`Error checking completion status for task ${this.id}:`, error)
		}
	}

	/**
	 * 检查是否所有文件都已完成
	 */
	private checkIfAllFilesCompleted(): boolean {
		const totalFiles = this.files.length
		const processedFiles = this.state.processedFiles

		// 简单检查：已处理文件数是否等于总文件数
		const isComplete = processedFiles >= totalFiles

		console.log(
			`📊 Completion check: ${processedFiles}/${totalFiles} files processed, complete: ${isComplete}`,
		)

		return isComplete
	}

	/**
	 * 暂停活跃的上传
	 */
	private async pauseActiveUploads(): Promise<void> {
		try {
			ossUploadService.pauseTaskUploads(this.id)
			console.log(`⏸️ Paused active uploads for task ${this.id}`)
		} catch (error) {
			console.error(`Failed to pause uploads for task ${this.id}:`, error)
		}
	}

	/**
	 * 恢复活跃的上传
	 */
	private async resumeActiveUploads(): Promise<void> {
		try {
			ossUploadService.resumeTaskUploads(this.id)
			console.log(`▶️ Resumed active uploads for task ${this.id}`)
		} catch (error) {
			console.error(`Failed to resume uploads for task ${this.id}:`, error)
		}
	}

	/**
	 * 获取失败文件列表
	 */
	getFailedFiles(): FailedFileInfo[] {
		const result = Array.from(this.failedFilesMap.values())
		return result
	}

	/**
	 * 重试单个失败文件
	 */
	async retrySingleFile(fileName: string, filePath: string): Promise<boolean> {
		try {
			// 从原始文件列表中找到对应的 File 对象
			const fileToRetry = this.files.find((file) => {
				const relativePath = (file as any).webkitRelativePath || file.name
				return file.name === fileName && relativePath === filePath
			})

			if (!fileToRetry) {
				console.error(`File not found for retry: ${fileName} at ${filePath}`)
				return false
			}

			// 创建 FolderUploadFile 对象
			const folderFile: FolderUploadFile = {
				file: fileToRetry,
				relativePath: (fileToRetry as any).webkitRelativePath || fileToRetry.name,
				folderPath: filePath.substring(0, filePath.lastIndexOf("/")) || "",
				targetPath: this.baseSuffixDir ? `${this.baseSuffixDir}/${filePath}` : filePath,
				customFileKey: this.fileKeysMap.get(fileToRetry.name),
			}

			// 确定文件的文件夹路径
			const folderPath = folderFile.folderPath || this.baseSuffixDir

			// 初始化进度跟踪
			const fileId = `${this.id}_${filePath}_${fileName}`
			this.fileUploadProgress.set(fileId, 0)
			this.fileCompletionStatus.set(fileId, false)
			this.fileSizeMap.set(fileId, fileToRetry.size)

			console.log(`🔄 Retrying single file: ${fileName} (${filePath})`)

			// 调用上传方法
			const { results, failedFiles } = await this.uploadFilesToOSS([folderFile], folderPath)

			if (results.length > 0 && failedFiles.length === 0) {
				// 上传成功
				console.log(`✅ File retry succeeded: ${fileName}`)

				// 从失败文件映射中移除
				this.failedFilesMap.delete(fileId)

				// 更新计数
				this.updateState({
					successFiles: this.state.successFiles + 1,
					errorFiles: this.failedFilesMap.size,
				})

				// 如果不是 onlyUpload 模式，保存到项目
				if (!this.options.onlyUpload) {
					const unsavedFiles = results.filter(
						(result) => !this.savedFileKeys.has(result.file_key),
					)

					if (unsavedFiles.length > 0) {
						await this.saveBatchToProject(unsavedFiles)
						unsavedFiles.forEach((file) => {
							this.savedFileKeys.add(file.file_key)
						})
					}
				}

				return true
			} else {
				// 上传失败，更新失败信息
				console.error(`❌ File retry failed: ${fileName}`)

				if (failedFiles.length > 0) {
					const updatedFailureInfo: FailedFileInfo = {
						...failedFiles[0],
						failedAt: Date.now(),
					}
					this.failedFilesMap.set(fileId, updatedFailureInfo)
				}

				return false
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			console.error(`Failed to retry file ${fileName}:`, error)

			// 更新失败文件信息
			const fileId = `${this.id}_${filePath}_${fileName}`
			const existingFailure = this.failedFilesMap.get(fileId)
			if (existingFailure) {
				this.failedFilesMap.set(fileId, {
					...existingFailure,
					error: errorMessage,
					failedAt: Date.now(),
				})
			}

			return false
		}
	}

	/**
	 * 序列化任务
	 */
	serialize(): SerializedTask {
		return {
			id: this.id,
			projectId: this.projectId,
			projectName: this.projectName,
			topicId: this.topicId,
			taskId: this.taskId,
			baseSuffixDir: this.baseSuffixDir,
			fileCount: this.files.length,
			state: this.state,
			options: this.options,
			createdAt: this.createdAt,
			startedAt: this.startedAt,
			failedFiles: this.getFailedFiles(),
		}
	}

	/**
	 * 从序列化数据恢复任务
	 */
	static deserialize(
		data: SerializedTask,
		t: (key: string, params?: Record<string, unknown>) => string | unknown,
	): FolderUploadTask | null {
		try {
			// 注意：文件对象无法序列化，这里创建一个空的任务用于恢复状态显示
			const task = new FolderUploadTask(
				[], // 文件列表为空，无法恢复实际文件
				data.baseSuffixDir,
				{ ...data.options, projectName: data.projectName, t },
			)

			task.id = data.id
			task.state = data.state
			task.createdAt = data.createdAt
			task.startedAt = data.startedAt

			return task
		} catch (error) {
			console.error("反序列化任务失败:", error)
			return null
		}
	}
}
