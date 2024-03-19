import { makeAutoObservable, runInAction } from "mobx"
import i18n from "i18next"
import { logger as Logger } from "@/opensource/utils/log"
import { FolderUploadTask } from "./FolderUploadTask"
import { TaskQueue } from "./TaskQueue"
import { getCurrentProjectId } from "./helpers"
import type {
	FolderUploadTask as IFolderUploadTask,
	GlobalUploadState,
	TaskCreateOptions,
	FolderUploadState,
	UploadConfig,
	BatchUploadInfo,
	BatchSaveInfo,
	UploadFileWithKey,
	FailedFileInfo,
} from "./types"
import magicToast from "@/opensource/components/base/MagicToaster/utils"

const logger = Logger.createLogger("UploadTaskService", {
	enableConfig: { console: true },
})

class MultiFolderUploadStore {
	// 全局状态
	globalState: GlobalUploadState = {
		tasks: new Map(),
		activeTasks: [],
		completedTasks: [],
		pendingTasks: [],
		totalActiveTasks: 0,
		totalFiles: 0,
		totalProcessedFiles: 0,
		globalProgress: 0,
		maxConcurrentTasks: 3, // 最多3个项目同时上传
		maxConcurrentUploads: 10, // 每个项目最多10个并发上传
	}

	// 文件上传配置
	uploadConfig: UploadConfig = {
		maxFileSize: 500 * 1024 * 1024, // 100MB 单文件大小限制
		maxTotalFiles: 10000, // 单次上传最大文件数量
		allowedExtensions: [], // 允许的文件扩展名（空数组表示不限制）
		blockedExtensions: [".exe", ".bat", ".cmd", ".scr"], // 禁止的文件扩展名
	}

	// 用户回调函数存储
	private taskCallbacks = new Map<string, TaskCreateOptions>()

	// 核心管理器
	private taskQueue: TaskQueue

	constructor() {
		makeAutoObservable(this)

		this.taskQueue = new TaskQueue()

		// 页面刷新时清空所有任务（不恢复持久化的任务）
		this.clearAllTasksOnRefresh()

		// 监听页面关闭
		window.addEventListener("beforeunload", this.persistTasks)

		// 监听网络状态变化
		this.setupNetworkListeners()
	}

	// 获取翻译函数
	private t = (key: string, options?: Record<string, unknown>) => {
		return i18n.t(`super:${key}`, options)
	}

	// 设置网络状态监听器
	private setupNetworkListeners(): void {
		// 监听网络状态变化
		window.addEventListener("online", this.handleNetworkOnline)
		window.addEventListener("offline", this.handleNetworkOffline)

		// 初始检查网络状态
		if (!navigator.onLine) {
			this.handleNetworkOffline()
		}
	}

	// 网络连接恢复
	private handleNetworkOnline = (): void => {
		console.log("📶 Network is back online")

		// 检查是否有因为断网而暂停的任务
		const pausedTasks: typeof this.globalState.activeTasks = []

		// 恢复所有暂停的任务（如果是因为断网暂停的）
		runInAction(() => {
			this.globalState.activeTasks.forEach((task) => {
				if (task.state.isPaused && task.state.currentPhase === "paused") {
					// 只恢复因网络问题暂停的任务
					task.resume()
					pausedTasks.push(task)
					console.log(`📶 Resumed task ${task.id} after network recovery`)
				}
			})
		})

		// 继续处理队列
		this.processTaskQueue()

		// 只有当有任务被恢复时才显示提示
		if (pausedTasks.length > 0) {
			magicToast.info(String(this.t("folderUpload.messages.networkRecovered")))
		}
	}

	// 网络断开
	private handleNetworkOffline = (): void => {
		console.log("📵 Network is offline")

		// 检查是否有正在运行的任务
		const runningTasks: typeof this.globalState.activeTasks = []

		// 暂停所有正在上传的任务
		runInAction(() => {
			this.globalState.activeTasks.forEach((task) => {
				if (task.state.isUploading && !task.state.isPaused) {
					// 调用任务的暂停方法
					task.pause()
					runningTasks.push(task)

					// 强制更新全局统计以触发UI重新渲染
					this.updateGlobalStats()

					console.log(`📵 Paused task ${task.id} due to network offline`)
					console.log(
						`📵 Task ${task.id} isPaused: ${task.state.isPaused}, currentPhase: ${task.state.currentPhase}`,
					)
				}
			})
		})

		// 只有当有任务被暂停时才显示提示
		if (runningTasks.length > 0) {
			magicToast.warning(String(this.t("folderUpload.messages.networkOffline")))
		}
	}

	// 页面刷新时清空所有任务
	private clearAllTasksOnRefresh(): void {
		runInAction(() => {
			this.globalState.tasks.clear()
			this.globalState.activeTasks = []
			this.globalState.completedTasks = []
			this.globalState.pendingTasks = []
			this.globalState.totalActiveTasks = 0
			this.globalState.totalFiles = 0
			this.globalState.totalProcessedFiles = 0
			this.globalState.globalProgress = 0
		})

		// 清除localStorage中的任务数据
		localStorage.removeItem("multiFolderUploadTasks")

		console.log("📁 Cleared all tasks on page refresh")
	}

	// 手动清空所有任务（用于用户主动关闭弹层）
	async clearAllTasksManually(): Promise<void> {
		// 首先取消所有OSS上传
		try {
			const { ossUploadService } = await import("./uploadService")
			ossUploadService.cancelAllUploads()
			console.log("🛑 Cancelled all OSS uploads")
		} catch (error) {
			console.error("Failed to cancel OSS uploads:", error)
		}

		// 然后主动取消所有正在进行的任务
		const allTasks = Array.from(this.globalState.tasks.values())
		await Promise.all(
			allTasks.map(async (task) => {
				if (task.state.isUploading && !task.state.isCompleted) {
					// 调用任务的取消方法，停止正在进行的上传
					await task.cancel()
					console.log(`🛑 Cancelled active task: ${task.id}`)
				}
			}),
		)

		runInAction(() => {
			this.globalState.tasks.clear()
			this.globalState.activeTasks = []
			this.globalState.completedTasks = []
			this.globalState.pendingTasks = []
			this.globalState.totalActiveTasks = 0
			this.globalState.totalFiles = 0
			this.globalState.totalProcessedFiles = 0
			this.globalState.globalProgress = 0
		})

		// 清理任务队列
		this.taskQueue.clear()

		// 注意：不再需要清理并发控制器，因为我们使用简单的全局任务计数

		// 清理回调函数存储
		this.taskCallbacks.clear()

		// 清除localStorage中的任务数据
		localStorage.removeItem("multiFolderUploadTasks")

		console.log("📁 Manually cleared all tasks and cancelled active uploads")
	}

	// 创建并开始新的上传任务
	async createUploadTask(
		files: File[] | UploadFileWithKey[],
		baseSuffixDir: string,
		options: TaskCreateOptions,
	): Promise<string> {
		try {
			// 标准化输入参数，统一处理File[]和UploadFileWithKey[]
			const normalizedFiles: UploadFileWithKey[] = files.map((item) => {
				if (item instanceof File) {
					return { file: item }
				}
				return item
			})

			// 检查文件大小限制 - 过滤大文件而不是抛错
			const maxFileSize = this.uploadConfig.maxFileSize
			// 配置使用二进制单位（1024），但显示时转换为十进制单位以与文件大小格式化保持一致
			const maxFileSizeMB = Math.round(maxFileSize / (1024 * 1024))
			const oversizedFiles = normalizedFiles.filter((item) => item.file.size > maxFileSize)
			const validFiles = normalizedFiles.filter((item) => item.file.size <= maxFileSize)

			// 如果有大文件，给出警告提示但继续上传有效文件
			if (oversizedFiles.length > 0) {
				const warningMsg = this.t("folderUpload.messages.fileSizeFiltered", {
					filteredCount: oversizedFiles.length,
					validCount: validFiles.length,
					maxSize: `${maxFileSizeMB}MB`,
				})
				magicToast.warning(String(warningMsg))
			}

			// 如果没有有效文件，则提示并返回
			if (validFiles.length === 0) {
				const errorMsg = this.t("folderUpload.messages.noValidFiles", {
					maxSize: `${maxFileSizeMB}MB`,
				})
				logger.error("[createUploadTask] No valid files to upload", {
					projectId: options.projectId,
					totalFiles: normalizedFiles.length,
					oversizedFiles: oversizedFiles.length,
					maxFileSizeMB,
				})
				magicToast.error(String(errorMsg))
				throw new Error(errorMsg)
			}

			// 使用过滤后的有效文件继续上传
			files = validFiles

			// 注意：不在此处检查项目并发限制，让任务总是能够创建并进入队列
			// 并发限制的检查会在 processTaskQueue 中的 canStartNewTask 方法中处理

			// 检查全局活跃任务限制（已完成的任务不计入）
			// const activeTotalTasks = this.globalState.tasks.size + this.taskQueue.length
			// if (activeTotalTasks >= 10) {
			// 	// message.warning(String(this.t("folderUpload.messages.maxTasksReached")))
			// 	throw new Error("Global task limit exceeded")
			// }

			// 创建任务
			const task = new FolderUploadTask(validFiles, baseSuffixDir, {
				...options,
				t: this.t.bind(this),
			})

			// 保存用户回调函数
			this.taskCallbacks.set(task.id, options)

			// 添加到全局状态
			runInAction(() => {
				this.globalState.tasks.set(task.id, task)
				this.updateGlobalStats()
			})

			// 添加到任务队列
			this.taskQueue.enqueue({
				task,
				priority: this.calculateTaskPriority(task),
				addedAt: Date.now(),
			})

			// 添加到等待任务列表
			runInAction(() => {
				this.globalState.pendingTasks.push(task)
			})

			// 尝试开始执行
			this.processTaskQueue()

			// 持久化状态
			this.persistTasks()

			// 检查任务是否会立即执行还是进入等待队列（基于全局并发限制）
			// const willQueueTask =
			// 	this.globalState.activeTasks.length >= this.globalState.maxConcurrentTasks

			// if (willQueueTask) {
			// 	message.info(
			// 		String(
			// 			this.t("folderUpload.messages.taskQueuedDueToGlobalLimit", {
			// 				projectName: options.projectName,
			// 				activeCount: this.globalState.activeTasks.length,
			// 				maxConcurrent: this.globalState.maxConcurrentTasks,
			// 			}),
			// 		),
			// 	)
			// } else {
			// 	message.success(
			// 		String(
			// 			this.t("folderUpload.messages.taskCreated", {
			// 				projectName: options.projectName,
			// 			}),
			// 		),
			// 	)
			// }
			return task.id
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			console.error("Failed to create upload task:", error)

			logger.error("[createUploadTask] Failed to create upload task", {
				error: errorMessage,
				projectId: options.projectId,
				projectName: options.projectName,
				fileCount: Array.isArray(files) ? files.length : 0,
			})

			magicToast.error(
				errorMessage || String(this.t("folderUpload.errors.createTaskFailedWithRetry")),
			)
			// throw error
			return ""
		}
	}

	// 处理任务队列
	private async processTaskQueue(): Promise<void> {
		while (this.taskQueue.hasNext() && this.canStartNewTask()) {
			const queueItem = this.taskQueue.dequeue()
			if (!queueItem) break

			// 从等待任务列表移除
			runInAction(() => {
				this.globalState.pendingTasks = this.globalState.pendingTasks.filter(
					(t) => t.id !== queueItem.task.id,
				)
			})

			await this.startTask(queueItem.task)
		}
	}

	// 开始执行任务
	private async startTask(task: IFolderUploadTask): Promise<void> {
		try {
			runInAction(() => {
				this.globalState.activeTasks.push(task)
				this.updateGlobalStats()
			})

			// 开始执行任务
			await task.execute({
				onProgress: this.handleTaskProgress,
				onComplete: this.handleTaskComplete,
				onError: this.handleTaskError,
				onBatchUploadComplete: this.handleBatchUploadComplete,
				onBatchSaveComplete: this.handleBatchSaveComplete,
			})
		} catch (error) {
			console.error(`Task ${task.id} execution failed:`, error)
			this.handleTaskError(task.id, error as Error)
		}
	}

	// 任务进度回调
	private handleTaskProgress = (taskId: string, taskState: FolderUploadState): void => {
		runInAction(() => {
			const task = this.globalState.tasks.get(taskId)
			if (task) {
				task.state = taskState
				this.updateGlobalStats()
			}
		})

		// 实时持久化
		this.persistTasks()
	}

	// 任务完成回调
	private handleTaskComplete = (taskId: string): void => {
		const task = this.globalState.tasks.get(taskId)
		const userCallbacks = this.taskCallbacks.get(taskId)

		runInAction(() => {
			if (task) {
				// 从活跃任务移除
				this.globalState.activeTasks = this.globalState.activeTasks.filter(
					(t) => t.id !== taskId,
				)

				// 添加到已完成任务
				this.globalState.completedTasks.unshift(task)

				// 从全局任务Map中移除（已完成的任务只保留在completedTasks中）
				this.globalState.tasks.delete(taskId)

				// 注意：不再限制已完成任务数量，允许保留所有已完成的任务
				// 如果需要限制，可以取消下面的注释并设置合适的数量
				// if (this.globalState.completedTasks.length > 50) {
				// 	this.globalState.completedTasks = this.globalState.completedTasks.slice(0, 50)
				// }

				this.updateGlobalStats()
			}
		})

		// 注意：不再需要释放并发许可，因为我们直接通过activeTasks数组长度控制并发

		// 继续处理队列
		this.processTaskQueue()

		// 持久化状态
		this.persistTasks()

		// 调用用户的onComplete回调函数
		if (userCallbacks?.onComplete) {
			try {
				userCallbacks.onComplete(taskId)
				console.log(`📁 User onComplete callback executed for task ${taskId}`)
			} catch (error) {
				console.error(
					`Failed to execute user onComplete callback for task ${taskId}:`,
					error,
				)
			}
		}

		// 清理回调函数存储
		this.taskCallbacks.delete(taskId)

		// 根据任务实际结果显示不同消息
		// if (task) {
		// 	if (task.state.errorFiles === 0) {
		// 		// 没有失败文件，显示成功消息
		// 		message.success(
		// 			String(
		// 				this.t("folderUpload.messages.uploadSuccess", {
		// 					count: task.state.successFiles, // 使用成功文件数量
		// 				}),
		// 			),
		// 		)
		// 	} else if (task.state.successFiles > 0) {
		// 		// 部分成功，显示警告消息
		// 		message.warning(
		// 			String(
		// 				this.t("folderUpload.messages.uploadPartialSuccess", {
		// 					success: task.state.successFiles,
		// 					failed: task.state.errorFiles,
		// 					total: task.state.totalFiles,
		// 				}),
		// 			),
		// 		)
		// 	} else {
		// 		// 全部失败，显示错误消息
		// 		message.error(
		// 			String(
		// 				this.t("folderUpload.messages.uploadAllFailed", {
		// 					count: task.state.totalFiles,
		// 				}),
		// 			),
		// 		)
		// 	}
		// }
	}

	// 任务错误回调
	private handleTaskError = (taskId: string, error: Error): void => {
		const task = this.globalState.tasks.get(taskId)
		const userCallbacks = this.taskCallbacks.get(taskId)

		runInAction(() => {
			if (task) {
				task.state.isError = true
				task.state.errorMessage = error.message

				// 从活跃任务移除
				this.globalState.activeTasks = this.globalState.activeTasks.filter(
					(t) => t.id !== taskId,
				)

				// 添加到已完成任务（失败的任务也显示在已完成列表中）
				this.globalState.completedTasks.unshift(task)

				// 从全局任务Map中移除
				this.globalState.tasks.delete(taskId)

				this.updateGlobalStats()
			}
		})

		// 注意：不再需要释放并发许可，因为我们直接通过activeTasks数组长度控制并发

		// 继续处理队列
		this.processTaskQueue()

		// 调用用户的onError回调函数
		if (userCallbacks?.onError) {
			try {
				userCallbacks.onError(taskId, error)
				console.log(`📁 User onError callback executed for task ${taskId}`)
			} catch (callbackError) {
				console.error(
					`Failed to execute user onError callback for task ${taskId}:`,
					callbackError,
				)
			}
		}

		// 清理回调函数存储
		this.taskCallbacks.delete(taskId)

		console.error(`Task ${taskId} failed:`, error)
	}

	// 批次上传完成回调
	private handleBatchUploadComplete = (batchInfo: BatchUploadInfo): void => {
		const userCallbacks = this.taskCallbacks.get(batchInfo.taskId)

		// 调用用户的onBatchUploadComplete回调函数
		if (userCallbacks?.onBatchUploadComplete) {
			try {
				userCallbacks.onBatchUploadComplete(batchInfo)
				console.log(
					`📁 Batch ${batchInfo.currentBatch}/${batchInfo.totalBatches} completed for task ${batchInfo.taskId}, success: ${batchInfo.batchSuccessCount}, failed: ${batchInfo.batchFailedCount}`,
				)
			} catch (callbackError) {
				console.error(
					`Failed to execute user onBatchUploadComplete callback for task ${batchInfo.taskId}:`,
					callbackError,
				)
			}
		}
	}

	// 批次保存完成回调
	private handleBatchSaveComplete = (batchSaveInfo: BatchSaveInfo): void => {
		const userCallbacks = this.taskCallbacks.get(batchSaveInfo.taskId)

		// 调用用户的onBatchSaveComplete回调函数
		if (userCallbacks?.onBatchSaveComplete) {
			try {
				userCallbacks.onBatchSaveComplete(batchSaveInfo)
				console.log(
					`💾 Batch save completed for task ${batchSaveInfo.taskId}: ${batchSaveInfo.savedFilesCount} files saved (${batchSaveInfo.totalProcessedFiles} total processed)`,
				)
			} catch (callbackError) {
				console.error(
					`Failed to execute user onBatchSaveComplete callback for task ${batchSaveInfo.taskId}:`,
					callbackError,
				)
			}
		}
	}

	// 取消任务
	cancelTask = async (taskId: string): Promise<void> => {
		const task = this.globalState.tasks.get(taskId)
		if (task) {
			try {
				// 等待任务取消完成，确保 OSS 上传被正确清理
				await task.cancel()
			} catch (error) {
				console.error(`Failed to cancel task ${taskId}:`, error)
				// 即使取消失败，也要清理任务状态
			}

			runInAction(() => {
				// 从所有列表中移除
				this.globalState.activeTasks = this.globalState.activeTasks.filter(
					(t) => t.id !== taskId,
				)
				this.globalState.pendingTasks = this.globalState.pendingTasks.filter(
					(t) => t.id !== taskId,
				)
				this.globalState.tasks.delete(taskId)
				this.updateGlobalStats()
			})

			// 注意：不再需要释放并发许可，因为我们直接通过activeTasks数组长度控制并发

			// 从队列中移除
			this.taskQueue.remove(taskId)

			// 清理回调函数存储
			this.taskCallbacks.delete(taskId)

			// 继续处理队列
			this.processTaskQueue()

			// message.info(
			// 	String(
			// 		this.t("folderUpload.messages.taskCancelled", {
			// 			projectName: task.projectName,
			// 		}),
			// 	),
			// )
		}
	}

	// 暂停任务
	pauseTask = (taskId: string): void => {
		const task = this.globalState.tasks.get(taskId)
		if (task) {
			task.pause()
			runInAction(() => {
				this.updateGlobalStats()
			})
		}
	}

	// 恢复任务
	resumeTask = (taskId: string): void => {
		const task = this.globalState.tasks.get(taskId)
		if (task && task.state.isPaused) {
			console.log(`▶️ Resuming task ${taskId}`)

			// 更新任务状态 - 这会让任务的 waitIfPaused() 方法继续执行
			task.resume()

			runInAction(() => {
				this.updateGlobalStats()
			})
		}
	}

	/**
	 * 获取任务的失败文件列表
	 */
	getTaskFailedFiles = (taskId: string): FailedFileInfo[] => {
		// 先在活跃任务中查找
		let task = this.globalState.tasks.get(taskId)

		// 如果活跃任务中没有，再在已完成任务中查找
		if (!task) {
			task = this.globalState.completedTasks.find((t) => t.id === taskId)
		}

		if (task && typeof task.getFailedFiles === "function") {
			const result = task.getFailedFiles()
			return result
		}
		return []
	}

	/**
	 * 重试单个失败文件
	 */
	retrySingleFile = async (
		taskId: string,
		fileName: string,
		filePath: string,
	): Promise<boolean> => {
		// 先在活跃任务中查找
		let task = this.globalState.tasks.get(taskId)

		// 如果活跃任务中没有，再在已完成任务中查找
		if (!task) {
			task = this.globalState.completedTasks.find((t) => t.id === taskId)
		}

		if (!task) {
			console.warn(`Task ${taskId} not found for file retry`)
			return false
		}

		if (typeof task.retrySingleFile !== "function") {
			console.error(`Task ${taskId} does not support single file retry`)
			return false
		}

		try {
			console.log(`🔄 Retrying file: ${fileName} in task ${taskId}`)
			const success = await task.retrySingleFile(fileName, filePath)

			if (success) {
				console.log(`✅ File retry succeeded: ${fileName}`)
				// 更新全局统计
				runInAction(() => {
					this.updateGlobalStats()
				})
			}

			return success
		} catch (error) {
			console.error(`Failed to retry file ${fileName}:`, error)
			return false
		}
	}

	// 重试任务 - 针对失败的任务重新开始上传
	retryTask = async (taskId: string): Promise<void> => {
		// 先从已完成任务中查找
		let task = this.globalState.completedTasks.find((t) => t.id === taskId)

		// 如果不在已完成任务中，检查活跃任务
		if (!task) {
			task = this.globalState.tasks.get(taskId)
		}

		if (!task) {
			console.warn(`Task ${taskId} not found for retry`)
			return
		}

		// 只有失败的任务才能重试
		if (!task.state.isError && task.state.errorFiles === 0) {
			console.warn(`Task ${taskId} has no errors to retry`)
			return
		}

		try {
			// 从已完成任务中移除（如果存在）
			runInAction(() => {
				this.globalState.completedTasks = this.globalState.completedTasks.filter(
					(t) => t.id !== taskId,
				)

				// 重置任务状态
				task.state.isError = false
				task.state.isCompleted = false
				task.state.isPaused = false
				task.state.isUploading = false
				task.state.errorMessage = undefined
				task.state.progress = 0
				task.state.uploadedBytes = 0 // 重置已上传字节数
				task.state.currentPhase = "preparing"
				task.state.processedFiles = task.state.successFiles // 保持已成功的文件

				// 清理文件跟踪状态 - 这是防止进度跳动的关键
				task.clearFileTrackingState()

				// 添加回全局任务Map
				this.globalState.tasks.set(taskId, task)
			})

			// 重新添加到任务队列
			this.taskQueue.enqueue({
				task,
				priority: this.calculateTaskPriority(task),
				addedAt: Date.now(),
			})

			// 处理队列
			this.processTaskQueue()
		} catch (error) {
			console.error(`Failed to retry task ${taskId}:`, error)
			// message.error(String(this.t("folderUpload.errors.taskExecutionFailed")))
		}
	}

	// 批量取消项目的所有任务
	cancelProjectTasks = async (projectId: string): Promise<void> => {
		const projectTasks = this.getTasksByProject(projectId)
		// 并行取消所有任务
		await Promise.allSettled(projectTasks.map((task) => this.cancelTask(task.id)))

		// message.info(String(this.t("folderUpload.messages.allTasksCancelled")))
	}

	// 获取项目的所有任务
	getTasksByProject = (projectId: string): IFolderUploadTask[] => {
		return Array.from(this.globalState.tasks.values()).filter(
			(task) => task.projectId === projectId,
		)
	}

	// 获取项目的活跃任务（用于限制检查）
	getActiveTasksByProject = (projectId: string): IFolderUploadTask[] => {
		// 只检查活跃任务，队列中的任务创建时会自动包含在内
		return Array.from(this.globalState.tasks.values()).filter(
			(task) =>
				task.projectId === projectId && !task.state.isCompleted && !task.state.isError,
		)
	}

	// 检查是否可以开始新任务（只检查全局限制，项目级限制在processTaskQueue中处理）
	private canStartNewTask(): boolean {
		return this.globalState.activeTasks.length < this.globalState.maxConcurrentTasks
	}

	// 计算任务优先级
	private calculateTaskPriority(task: IFolderUploadTask): number {
		// 文件数量越少优先级越高
		let priority = 1000 - task.files.length

		// 当前项目的任务优先级更高
		const currentProjectId = getCurrentProjectId()
		if (task.projectId === currentProjectId) {
			priority += 500
		}

		return priority
	}

	// 更新全局统计
	private updateGlobalStats = (): void => {
		const activeTasks = this.globalState.activeTasks
		const completedTasks = this.globalState.completedTasks

		// 活跃任务统计
		this.globalState.totalActiveTasks = activeTasks.length

		// 计算所有任务的文件总数（活跃 + 已完成）
		const activeTasksTotalFiles = activeTasks.reduce(
			(sum, task) => sum + task.state.totalFiles,
			0,
		)
		const completedTasksTotalFiles = completedTasks.reduce(
			(sum, task) => sum + task.state.totalFiles,
			0,
		)
		this.globalState.totalFiles = activeTasksTotalFiles + completedTasksTotalFiles

		// 计算已完成的文件总数（活跃任务的已处理 + 已完成任务的成功文件）
		const activeProcessedFiles = activeTasks.reduce(
			(sum, task) => sum + task.state.processedFiles,
			0,
		)
		const completedSuccessFiles = completedTasks.reduce(
			(sum, task) => sum + task.state.successFiles,
			0,
		)
		this.globalState.totalProcessedFiles = activeProcessedFiles + completedSuccessFiles

		// 🚨 异常检测：检查已完成任务中是否存在计数异常
		completedTasks.forEach((task) => {
			// 如果 processedFiles 或 successFiles 大于 totalFiles - errorFiles，说明有异常
			const expectedMaxFiles = task.state.totalFiles - task.state.errorFiles
			if (
				task.state.processedFiles > expectedMaxFiles ||
				task.state.successFiles > expectedMaxFiles
			) {
				logger.error("[FolderUpload] Completed task has anomalous file counts", {
					taskId: task.id,
					projectId: task.projectId,
					projectName: task.projectName,
					anomaly: {
						type: "completed_task_count_mismatch",
						display: `${task.state.processedFiles}/${task.state.totalFiles} (${task.state.errorFiles} failed)`,
						expectedMax: expectedMaxFiles,
					},
					counts: {
						totalFiles: task.state.totalFiles,
						processedFiles: task.state.processedFiles,
						successFiles: task.state.successFiles,
						errorFiles: task.state.errorFiles,
					},
					state: {
						isCompleted: task.state.isCompleted,
						isError: task.state.isError,
						currentPhase: task.state.currentPhase,
					},
					timestamp: Date.now(),
				})
			}
		})

		// 计算全局进度（基于字节数，而不是文件数）
		// 这样可以准确反映大文件上传的进度
		const activeTotalBytes = activeTasks.reduce(
			(sum, task) => sum + (task.state.totalBytes || 0),
			0,
		)
		const activeUploadedBytes = activeTasks.reduce(
			(sum, task) => sum + (task.state.uploadedBytes || 0),
			0,
		)

		// 已完成任务的所有字节都已上传
		const completedTotalBytes = completedTasks.reduce(
			(sum, task) => sum + (task.state.totalBytes || 0),
			0,
		)

		const totalBytes = activeTotalBytes + completedTotalBytes
		const uploadedBytes = activeUploadedBytes + completedTotalBytes

		if (totalBytes > 0) {
			this.globalState.globalProgress = Math.round((uploadedBytes / totalBytes) * 100)
		} else {
			this.globalState.globalProgress = 0
		}
	}

	// 持久化任务状态
	private persistTasks = (): void => {
		try {
			const persistData = {
				tasks: Array.from(this.globalState.tasks.entries()).map(([id, task]) => [
					id,
					task.serialize(),
				]),
				completedTasks: this.globalState.completedTasks.map((task) => task.serialize()),
				timestamp: Date.now(),
			}

			localStorage.setItem("multiFolderUploadTasks", JSON.stringify(persistData))
		} catch (error) {
			console.error("Failed to persist tasks:", error)
		}
	}

	// Getters
	get hasActiveTasks(): boolean {
		// 包括正在执行的任务和队列中等待的任务
		return this.globalState.totalActiveTasks > 0 || this.taskQueue.length > 0
	}

	get activeTasks(): IFolderUploadTask[] {
		return this.globalState.activeTasks
	}

	get completedTasks(): IFolderUploadTask[] {
		return this.globalState.completedTasks
	}

	get globalProgress(): number {
		return this.globalState.globalProgress
	}

	get queueLength(): number {
		return this.taskQueue.length
	}

	get pendingTasks(): IFolderUploadTask[] {
		return this.globalState.pendingTasks
	}

	get totalTasksCount(): number {
		return this.globalState.tasks.size + this.taskQueue.length
	}

	get uploadInfo() {
		return {
			isUploading: this.hasActiveTasks,
			progress: this.globalProgress,
			activeTasks: this.activeTasks,
			completedTasks: this.completedTasks,
			totalActiveTasks: this.globalState.totalActiveTasks,
			totalFiles: this.globalState.totalFiles,
			totalProcessedFiles: this.globalState.totalProcessedFiles,
			queueLength: this.queueLength,
		}
	}

	// 配置管理方法
	/**
	 * 更新文件大小限制
	 * @param maxFileSize 最大文件大小（字节）
	 */
	updateMaxFileSize(maxFileSize: number): void {
		if (maxFileSize <= 0) {
			throw new Error("File size limit must be greater than 0")
		}

		runInAction(() => {
			this.uploadConfig.maxFileSize = maxFileSize
		})

		console.log(
			`📁 Updated max file size limit to ${Math.round(maxFileSize / (1000 * 1000))}MB`,
		)
	}

	/**
	 * 更新最大文件数量限制
	 * @param maxTotalFiles 最大文件数量
	 */
	updateMaxTotalFiles(maxTotalFiles: number): void {
		if (maxTotalFiles <= 0) {
			throw new Error("Max total files must be greater than 0")
		}

		runInAction(() => {
			this.uploadConfig.maxTotalFiles = maxTotalFiles
		})

		console.log(`📁 Updated max total files limit to ${maxTotalFiles}`)
	}

	/**
	 * 更新允许的文件扩展名
	 * @param extensions 允许的扩展名数组，如 ['.jpg', '.png', '.pdf']
	 */
	updateAllowedExtensions(extensions: string[]): void {
		runInAction(() => {
			this.uploadConfig.allowedExtensions = extensions.map((ext) => ext.toLowerCase())
		})

		console.log(`📁 Updated allowed extensions:`, this.uploadConfig.allowedExtensions)
	}

	/**
	 * 更新禁止的文件扩展名
	 * @param extensions 禁止的扩展名数组，如 ['.exe', '.bat']
	 */
	updateBlockedExtensions(extensions: string[]): void {
		runInAction(() => {
			this.uploadConfig.blockedExtensions = extensions.map((ext) => ext.toLowerCase())
		})

		console.log(`📁 Updated blocked extensions:`, this.uploadConfig.blockedExtensions)
	}

	/**
	 * 批量更新上传配置
	 * @param config 部分配置对象
	 */
	updateUploadConfig(config: Partial<typeof this.uploadConfig>): void {
		runInAction(() => {
			Object.assign(this.uploadConfig, config)
		})

		console.log(`📁 Updated upload config:`, this.uploadConfig)
	}

	/**
	 * 重置上传配置为默认值
	 */
	resetUploadConfig(): void {
		runInAction(() => {
			this.uploadConfig = {
				maxFileSize: 100 * 1024 * 1024, // 100MB
				maxTotalFiles: 10000,
				allowedExtensions: [],
				blockedExtensions: [".exe", ".bat", ".cmd", ".scr"],
			}
		})

		console.log(`📁 Reset upload config to defaults`)
	}

	/**
	 * 获取当前上传配置
	 */
	get currentUploadConfig() {
		return {
			...this.uploadConfig,
			// 配置内部使用二进制单位（1024），但显示时转换为十进制单位以与格式化函数保持一致
			maxFileSizeMB: Math.round(this.uploadConfig.maxFileSize / (1000 * 1000)),
		}
	}

	/**
	 * 🧪 Mock 数据 - 用于测试和演示各种上传状态
	 * 创建模拟的上传任务来展示UI的各种状态
	 */
	mockTasksForTesting(): void {
		console.log("🧪 Creating mock tasks for testing...")

		// 清空现有数据
		// this.clearAllTasksManually()

		// 创建模拟文件
		const createMockFile = (name: string, size: number = 1024 * 1024): File => {
			return new File([new ArrayBuffer(size)], name, { type: "text/plain" })
		}

		const createMockFiles = (count: number, prefix: string): File[] => {
			return Array.from({ length: count }, (_, i) =>
				createMockFile(`${prefix}_file_${i + 1}.txt`, Math.random() * 5 * 1024 * 1024),
			)
		}

		const now = Date.now()

		// Mock t function for test tasks
		const mockT = (key: string) => key

		// 1. 🔄 正在上传中的任务（用于测试网络断开检测）
		const uploadingTask = new FolderUploadTask(
			createMockFiles(25, "uploading"),
			"images/photos",
			{
				projectId: "proj_001",
				workspaceId: "ws_001", // Mock workspace ID
				projectName: "AI图像生成项目",
				topicId: "topic_001",
				taskId: "task_001",
				storageType: "workspace",
				source: 1,
				t: mockT,
			},
		)

		// 设置上传中状态（用于测试网络检测）
		uploadingTask.updateState({
			isUploading: true,
			isPaused: false, // 设置为非暂停状态
			isCompleted: false,
			isError: false,
			totalFiles: 25,
			processedFiles: 12,
			successFiles: 12,
			errorFiles: 0,
			totalBytes: 52428800, // 约50MB
			uploadedBytes: 25165824, // 约24MB (48% 进度)
			currentBatch: 2,
			totalBatches: 3,
			progress: 48,
			currentPhase: "uploading", // 设置为上传阶段
			uploadSpeed: 2500, // 正常上传速度
			estimatedTimeRemaining: 45, // 预计剩余时间
			taskId: "task_uploading_001",
			projectId: "proj_001",
			startTime: now - 30000, // 开始于30秒前
		})

		// 2. ✅ 完全上传成功的任务
		const completedTask = new FolderUploadTask(
			createMockFiles(18, "completed"),
			"documents/reports",
			{
				projectId: "proj_002",
				workspaceId: "ws_002", // Mock workspace ID
				projectName: "市场分析报告",
				topicId: "topic_002",
				taskId: "task_002",
				storageType: "workspace",
				source: 1,
				t: mockT,
			},
		)

		completedTask.updateState({
			isUploading: false,
			isPaused: false,
			isCompleted: true,
			isError: false,
			totalFiles: 18,
			processedFiles: 18,
			successFiles: 18,
			errorFiles: 0,
			totalBytes: 37748736, // 约36MB
			uploadedBytes: 37748736, // 全部上传完成
			currentBatch: 2,
			totalBatches: 2,
			progress: 100,
			currentPhase: "completed",
			uploadSpeed: 0,
			estimatedTimeRemaining: 0,
			taskId: "task_completed_002",
			projectId: "proj_002",
			startTime: now - 120000, // 开始于2分钟前
		})

		// 3. ⚠️ 上传完成但有失败文件的任务
		const partialErrorTask = new FolderUploadTask(
			createMockFiles(30, "partial_error"),
			"assets/videos",
			{
				projectId: "proj_003",
				workspaceId: "ws_003", // Mock workspace ID
				projectName: "产品宣传视频",
				topicId: "topic_003",
				taskId: "task_003",
				storageType: "workspace",
				source: 1,
				t: mockT,
			},
		)

		partialErrorTask.updateState({
			isUploading: false,
			isPaused: false,
			isCompleted: true,
			isError: true,
			totalFiles: 30,
			processedFiles: 30,
			successFiles: 27,
			errorFiles: 3,
			totalBytes: 157286400, // 约150MB
			uploadedBytes: 141557760, // 约135MB (27/30 * 150MB)
			currentBatch: 3,
			totalBatches: 3,
			progress: 100,
			currentPhase: "completed",
			uploadSpeed: 0,
			estimatedTimeRemaining: 0,
			errorMessage: String(this.t("folderUpload.errors.partialUploadFailed")),
			taskId: "task_partial_error_003",
			projectId: "proj_003",
			startTime: now - 180000, // 开始于3分钟前
		})

		// 4. ⏳ 等待上传的任务
		const pendingTask1 = new FolderUploadTask(
			createMockFiles(15, "pending"),
			"configs/settings",
			{
				projectId: "proj_004",
				workspaceId: "ws_004", // Mock workspace ID
				projectName: "系统配置文件",
				topicId: "topic_004",
				taskId: "task_004",
				storageType: "workspace",
				source: 1,
				t: mockT,
			},
		)

		pendingTask1.updateState({
			isUploading: false,
			isPaused: false,
			isCompleted: false,
			isError: false,
			totalFiles: 15,
			processedFiles: 0,
			successFiles: 0,
			errorFiles: 0,
			totalBytes: 31457280, // 约30MB
			uploadedBytes: 0, // 还未开始上传
			currentBatch: 0,
			totalBatches: 2,
			progress: 0,
			currentPhase: "preparing",
			uploadSpeed: 0,
			estimatedTimeRemaining: 0,
			taskId: "task_pending_004",
			projectId: "proj_004",
			startTime: now,
		})

		// 5. ⏳ 第二个等待上传的任务
		const pendingTask2 = new FolderUploadTask(createMockFiles(8, "waiting"), "assets/icons", {
			projectId: "proj_005",
			workspaceId: "ws_005",
			projectName: "UI图标库",
			topicId: "topic_005",
			taskId: "task_005",
			storageType: "workspace",
			source: 1,
			t: mockT,
		})

		pendingTask2.updateState({
			isUploading: false,
			isPaused: false,
			isCompleted: false,
			isError: false,
			totalFiles: 8,
			processedFiles: 0,
			successFiles: 0,
			errorFiles: 0,
			totalBytes: 16777216, // 约16MB
			uploadedBytes: 0,
			currentBatch: 0,
			totalBatches: 1,
			progress: 0,
			currentPhase: "preparing",
			uploadSpeed: 0,
			estimatedTimeRemaining: 0,
			taskId: "task_pending_005",
			projectId: "proj_005",
			startTime: now + 1000,
		})

		// 6. ⏳ 第三个等待上传的任务
		const pendingTask3 = new FolderUploadTask(
			createMockFiles(22, "resources"),
			"data/resources",
			{
				projectId: "proj_006",
				workspaceId: "ws_006",
				projectName: "数据资源包",
				topicId: "topic_006",
				taskId: "task_006",
				storageType: "workspace",
				source: 1,
				t: mockT,
			},
		)

		pendingTask3.updateState({
			isUploading: false,
			isPaused: false,
			isCompleted: false,
			isError: false,
			totalFiles: 22,
			processedFiles: 0,
			successFiles: 0,
			errorFiles: 0,
			totalBytes: 46137344, // 约44MB
			uploadedBytes: 0,
			currentBatch: 0,
			totalBatches: 3,
			progress: 0,
			currentPhase: "preparing",
			uploadSpeed: 0,
			estimatedTimeRemaining: 0,
			taskId: "task_pending_006",
			projectId: "proj_006",
			startTime: now + 2000,
		})

		runInAction(() => {
			// 🔧 Mock模式：临时设置并发限制为1，确保等待任务保持在队列中
			const originalMaxConcurrent = this.globalState.maxConcurrentTasks
			this.globalState.maxConcurrentTasks = 1

			// 添加到全局状态
			this.globalState.tasks.set(uploadingTask.id, uploadingTask)
			this.globalState.tasks.set(completedTask.id, completedTask)
			this.globalState.tasks.set(partialErrorTask.id, partialErrorTask)
			this.globalState.tasks.set(pendingTask1.id, pendingTask1)
			this.globalState.tasks.set(pendingTask2.id, pendingTask2)
			this.globalState.tasks.set(pendingTask3.id, pendingTask3)

			// 设置活跃任务
			this.globalState.activeTasks = [uploadingTask]

			// 设置已完成任务
			this.globalState.completedTasks = [completedTask, partialErrorTask]

			// 设置等待任务
			this.globalState.pendingTasks = [pendingTask1, pendingTask2, pendingTask3]

			// 将等待任务加入队列
			this.taskQueue.enqueue({
				task: pendingTask1,
				priority: this.calculateTaskPriority(pendingTask1),
				addedAt: Date.now(),
			})
			this.taskQueue.enqueue({
				task: pendingTask2,
				priority: this.calculateTaskPriority(pendingTask2),
				addedAt: Date.now() + 1000,
			})
			this.taskQueue.enqueue({
				task: pendingTask3,
				priority: this.calculateTaskPriority(pendingTask3),
				addedAt: Date.now() + 2000,
			})

			// 更新全局统计
			this.updateGlobalStats()

			// 🔧 恢复原来的并发限制（延迟恢复，确保队列任务已经添加）
			setTimeout(() => {
				this.globalState.maxConcurrentTasks = originalMaxConcurrent
				console.log("🔧 Mock: 恢复并发限制为", originalMaxConcurrent)
			}, 100)
		})

		// 🎬 启动动画效果 - 模拟上传进度（支持网络状态检测）
		this.startMockProgressAnimation(uploadingTask.id)

		console.log("🧪 Mock tasks created successfully!")
		console.log("📊 Current state:", {
			activeTasks: this.globalState.activeTasks.length,
			completedTasks: this.globalState.completedTasks.length,
			queuedTasks: this.taskQueue.length,
			globalProgress: this.globalProgress,
		})
		console.log("📋 Queue details:", {
			queueItems: this.taskQueue.getAllTasks().map((item) => ({
				taskId: item.task.id,
				projectName: item.task.projectName,
				priority: item.priority,
			})),
		})
		console.log("🗂️ Mock tasks breakdown:")
		console.log("  - 1个上传中任务 (AI图像生成项目) 🔄")
		console.log("  - 2个已完成任务 (1个成功 + 1个部分失败)")
		console.log("  - 3个等待中任务 (系统配置文件、UI图标库、数据资源包)")
		console.log("  - 总计45个文件，约140MB")
		console.log("  - 🧪 测试网络检测：断网时应自动暂停上传，恢复时自动继续")
	}

	/**
	 * 🎬 启动模拟进度动画
	 * 让上传中的任务显示动态进度
	 */
	private startMockProgressAnimation(taskId: string): void {
		const task = this.globalState.tasks.get(taskId)
		if (!task || !task.state.isUploading) return

		const updateProgress = () => {
			const currentTask = this.globalState.tasks.get(taskId)
			if (!currentTask || !currentTask.state.isUploading) return

			// 🚨 检查网络状态 - 如果断网则暂停模拟动画
			if (!navigator.onLine) {
				console.log(`📵 Mock animation paused for task ${taskId} due to network offline`)
				runInAction(() => {
					currentTask.updateState({
						isPaused: true,
						currentPhase: "paused",
						uploadSpeed: 0,
					})
				})
				return // 停止动画，等待网络恢复
			}

			// 🚨 检查任务是否被暂停
			if (currentTask.state.isPaused) {
				console.log(`⏸️ Mock animation paused for task ${taskId}`)
				return // 任务暂停时不更新进度
			}

			runInAction(() => {
				const state = currentTask.state

				// 模拟进度增长
				if (state.progress < 100) {
					const increment = Math.random() * 3 + 0.5 // 0.5-3.5% 随机增长
					const newProgress = Math.min(100, state.progress + increment)
					const newProcessed = Math.floor((newProgress / 100) * state.totalFiles)
					const newUploadedBytes = Math.floor((newProgress / 100) * state.totalBytes)

					currentTask.updateState({
						...state,
						progress: newProgress,
						processedFiles: newProcessed,
						successFiles: newProcessed,
						uploadedBytes: newUploadedBytes,
						uploadSpeed: 1800 + Math.random() * 1400, // 1800-3200 KB/s (约1.8-3.1 MB/s)
						estimatedTimeRemaining: Math.max(0, Math.floor((100 - newProgress) * 2)), // 剩余时间
						currentPhase: "uploading", // 确保状态是上传中
					})

					this.updateGlobalStats()

					// 如果完成了，停止动画
					if (newProgress >= 100) {
						currentTask.updateState({
							...currentTask.state,
							isUploading: false,
							isCompleted: true,
							currentPhase: "completed",
							uploadedBytes: currentTask.state.totalBytes, // 完成时字节数等于总字节数
							uploadSpeed: 0,
							estimatedTimeRemaining: 0,
						})

						// 移动到完成列表
						this.globalState.activeTasks = this.globalState.activeTasks.filter(
							(t) => t.id !== taskId,
						)
						this.globalState.completedTasks.push(currentTask)
						this.updateGlobalStats()

						console.log(`🎬 Mock task ${taskId} completed!`)
						return
					}
				}
			})

			// 继续动画 - 但要再次检查网络状态和暂停状态
			setTimeout(updateProgress, 1000 + Math.random() * 2000) // 1-3秒间隔
		}

		// 开始动画
		setTimeout(updateProgress, 1000)
	}

	/**
	 * 🧹 清理Mock数据
	 */
	clearMockTasks(): void {
		console.log("🧹 Clearing mock tasks...")
		this.clearAllTasksManually()
	}

	/**
	 * 🧪 开发工具：模拟网络断开
	 * 仅用于开发测试，通过覆盖navigator.onLine并触发事件来完整模拟网络状态
	 */
	simulateNetworkOffline(): void {
		console.log("🧪 DEV: Simulating network offline...")

		// 覆盖navigator.onLine为false (仅在开发模式下)
		if (process.env.NODE_ENV === "development") {
			Object.defineProperty(navigator, "onLine", {
				writable: true,
				configurable: true,
				value: false,
			})
		}

		// 手动触发offline事件
		const offlineEvent = new Event("offline")
		window.dispatchEvent(offlineEvent)

		console.log("📵 DEV: Network simulated as offline, navigator.onLine =", navigator.onLine)
	}

	/**
	 * 🧪 开发工具：模拟网络恢复
	 * 仅用于开发测试，通过覆盖navigator.onLine并触发事件来完整模拟网络状态
	 */
	simulateNetworkOnline(): void {
		console.log("🧪 DEV: Simulating network online...")

		// 覆盖navigator.onLine为true (仅在开发模式下)
		if (process.env.NODE_ENV === "development") {
			Object.defineProperty(navigator, "onLine", {
				writable: true,
				configurable: true,
				value: true,
			})
		}

		// 手动触发online事件
		const onlineEvent = new Event("online")
		window.dispatchEvent(onlineEvent)

		console.log("📶 DEV: Network simulated as online, navigator.onLine =", navigator.onLine)
	}

	/**
	 * 🧪 开发工具：重置网络状态到真实状态
	 */
	resetNetworkToReal(): void {
		console.log("🧪 DEV: 要重置到真实网络状态，请刷新页面")
		magicToast.info("要重置到真实网络状态，请刷新页面")
	}

	/**
	 * 🧪 开发工具：测试实时文件计数功能
	 * 验证每个文件完成时是否立即更新 processedFiles
	 */
	testRealTimeFileProgress(): void {
		console.log("🧪 DEV: Testing real-time file progress updates...")

		const activeTasks = this.globalState.activeTasks
		if (activeTasks.length === 0) {
			console.log("❌ No active tasks found. Please start an upload first.")
			magicToast.warning("没有正在进行的上传任务，请先开始上传")
			return
		}

		const task = activeTasks[0]
		console.log("🧪 Current task state:", {
			taskId: task.id,
			totalFiles: task.state.totalFiles,
			processedFiles: task.state.processedFiles,
			successFiles: task.state.successFiles,
			errorFiles: task.state.errorFiles,
			progress: task.state.progress,
		})

		console.log("🧪 Global upload info:", {
			totalFiles: this.globalState.totalFiles,
			totalProcessedFiles: this.globalState.totalProcessedFiles,
			globalProgress: this.globalState.globalProgress,
		})

		console.log("🧪 Watch the console for real-time updates when files complete!")
		console.log(
			"📊 Expected behavior: processedFiles should increment immediately when each file finishes uploading",
		)
	}

	/**
	 * 🧪 开发工具：测试实时BatchSave功能
	 * 验证文件完成时的5秒防抖保存机制 + 兜底保存机制
	 */
	testRealTimeBatchSave(): void {
		console.log("🧪 DEV: Testing real-time batch save with 5s debounce + fallback...")

		const activeTasks = this.globalState.activeTasks
		if (activeTasks.length === 0) {
			console.log("❌ No active tasks found. Please start an upload first.")
			magicToast.warning("没有正在进行的上传任务，请先开始上传")
			return
		}

		const task = activeTasks[0] as any // 类型断言访问私有属性进行测试
		console.log("🧪 Current task batch save state:", {
			taskId: task.id,
			pendingSaveFiles: task.pendingSaveFiles?.length || 0,
			savedFileKeys: task.savedFileKeys?.size || 0,
			processedFiles: task.state.processedFiles,
			successFiles: task.state.successFiles,
			totalFiles: task.state.totalFiles,
			hasDebounceTimer: task.saveDebounceTimer !== null,
			saveDelay: task.SAVE_DEBOUNCE_DELAY || "N/A",
		})

		console.log(
			"🧪 Expected behavior (三重保障机制):",
			"\n  【实时保存】",
			"\n  1. 当文件完成上传时，会添加到 pendingSaveFiles 队列",
			"\n  2. 启动5秒防抖定时器",
			"\n  3. 5秒无新文件完成时，批量保存到项目",
			"\n  【兜底保存】",
			"\n  4. 每个批次完成后，检查是否有未保存文件",
			"\n  5. 如有未保存文件，立即保存（防止遗漏）",
			"\n  【计数校正】",
			"\n  6. 批次完成后，校正processedFiles（基于savedFileKeys.size）",
			"\n  7. 任务完成前，最终校正确保数据准确",
			"\n  8. 避免实时回调遗漏导致的计数错误",
		)

		console.log("📊 Watch the console for batch save logs like:")
		console.log('  - "📁 File xxx completed, added to pending save queue"')
		console.log('  - "📁 Executing real-time batch save for X files"')
		console.log('  - "✅ Successfully saved X files to project"')
		console.log('  - "🔄 Batch fallback save: Found X unsaved files"')
		console.log('  - "✅ All X files already saved via real-time mechanism"')
		console.log('  - "📁 Finalizing X remaining unsaved files (filtered from Y pending)"')
		console.log('  - "✅ All Y pending files already saved, no finalization needed"')
		console.log('  - "🔧 Correcting file counts: Found X files saved but not counted"')
		console.log('  - "📡 Triggered onBatchSaveComplete callback for X files"')
	}

	/**
	 * 🧪 开发工具：测试文件列表实时刷新功能
	 * 验证onBatchSaveComplete回调是否正确触发文件列表更新
	 */
	testFileListRefresh(): void {
		console.log("🧪 DEV: Testing real-time file list refresh...")

		console.log(
			"🧪 Expected behavior:",
			"\n  1. 每当batchSave完成时，触发onBatchSaveComplete回调",
			"\n  2. 回调函数发布 'update_attachments' 事件",
			"\n  3. 文件列表立即刷新，显示新保存的文件",
			"\n  4. 用户可以实时看到文件出现在列表中",
		)

		console.log("📊 Watch for these events in the console:")
		console.log('  - "💾 Batch save completed: X files saved to project"')
		console.log('  - "📡 Published update_attachments event"')
		console.log("  - 观察文件列表UI是否实时更新")

		console.log("📋 Test scenarios:")
		console.log("  1. 上传小文件夹（快速完成）- 应该看到文件逐个出现")
		console.log("  2. 上传大文件夹（慢速完成）- 应该看到5秒一批的文件出现")
		console.log("  3. 网络波动情况 - 文件保存后应该立即显示在列表中")
	}
}

export const multiFolderUploadStore = new MultiFolderUploadStore()
