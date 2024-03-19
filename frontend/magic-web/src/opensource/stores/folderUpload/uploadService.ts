import type { FolderUploadFile, UploadResult as FolderUploadResult } from "./types"
import { superMagicUploadTokenService } from "@/opensource/pages/superMagic/components/MessageEditor/services/UploadTokenService"
import { Upload, UploadConfig } from "@dtyq/upload-sdk"
import type { FileUploadData } from "@/opensource/hooks/useUploadFiles"

// 上传凭证接口（兼容现有系统）
type UploadCredentials = UploadConfig["customCredentials"]

/**
 * 从自定义fileKey中提取相对于dir的路径
 * @param customFileKey 自定义文件键（完整路径）
 * @param dir 凭证中的dir路径
 * @returns 相对路径，用于SDK上传
 */
function extractRelativePathFromCustomKey(customFileKey: string, dir?: string): string {
	if (!dir || !customFileKey) {
		return customFileKey
	}

	// 标准化dir路径（确保以/结尾）
	const normalizedDir = dir.endsWith("/") ? dir : dir + "/"

	// 如果customFileKey以dir开头，则提取相对路径
	if (customFileKey.startsWith(normalizedDir)) {
		const relativePath = customFileKey.substring(normalizedDir.length)
		return relativePath
	}

	// 如果customFileKey以dir（不带/）开头，也尝试提取
	if (customFileKey.startsWith(dir)) {
		const relativePath = customFileKey.substring(dir.length).replace(/^\/+/, "")
		return relativePath
	}

	// 如果不匹配，直接返回原始路径（让SDK处理）
	return customFileKey
}

/**
 * OSS上传服务类
 * 使用现有的 superMagicUploadTokenService 和 Upload SDK
 */
class OSSUploadService {
	private upload: Upload
	// 存储当前上传的控制方法
	private activeUploads: Map<
		string,
		{ pause: () => void; resume: () => void; cancel: () => void }
	> = new Map()
	// 存储暂停的上传任务控制方法
	private pausedUploads: Map<
		string,
		{ pause: () => void; resume: () => void; cancel: () => void }
	> = new Map()
	// 上传状态："idle" | "uploading" | "paused"
	private uploadState: "idle" | "uploading" | "paused" = "idle"

	constructor() {
		// 初始化上传器
		this.upload = new Upload()

		// 启动状态健康检查
		// this.startHealthCheck()
	}

	// /**
	//  * 状态健康检查 - 自动恢复异常状态
	//  */
	// private startHealthCheck(): void {
	// 	// 每5秒检查一次状态
	// 	setInterval(() => {
	// 		// 如果状态是 paused 但没有暂停的上传，自动重置
	// 		if (this.uploadState === "paused" && this.pausedUploads.size === 0) {
	// 			console.warn(
	// 				"⚠️ Detected orphaned 'paused' state with no paused uploads, auto-resetting to idle",
	// 			)
	// 			this.uploadState = this.activeUploads.size > 0 ? "uploading" : "idle"
	// 		}

	// 		// 如果状态是 uploading 但没有活跃的上传，自动重置
	// 		if (this.uploadState === "uploading" && this.activeUploads.size === 0) {
	// 			console.warn(
	// 				"⚠️ Detected orphaned 'uploading' state with no active uploads, auto-resetting",
	// 			)
	// 			this.uploadState = this.pausedUploads.size > 0 ? "paused" : "idle"
	// 		}
	// 	}, 5000)
	// }

	/**
	 * 上传文件到OSS
	 * @param files 要上传的文件列表
	 * @param projectId 项目ID
	 * @param folderPath 文件夹路径
	 * @param onProgress 进度回调函数
	 */
	async uploadFiles(
		files: FolderUploadFile[],
		projectId: string,
		folderPath: string,
		taskId?: string,
		onProgress?: (fileId: string, uploadedBytes: number) => void,
		onFileCompleted?: (fileId: string, result: FolderUploadResult) => void,
	): Promise<FolderUploadResult[]> {
		// // 如果当前处于暂停状态，不允许开始新的上传
		// if (this.uploadState === "paused") {
		// 	throw new Error("上传已暂停，请先恢复或取消当前上传")
		// }
		// 设置上传状态为正在上传
		this.uploadState = "uploading"
		try {
			// 检查是否有文件使用自定义fileKey
			const hasCustomFileKey = files.some((file) => file.customFileKey)

			// 获取上传凭证
			// 如果有自定义fileKey，使用专门的方法获取修改过dir的凭证
			const customCredentials = hasCustomFileKey
				? await superMagicUploadTokenService.getUploadTokenForCustomKey(projectId)
				: await superMagicUploadTokenService.getUploadToken(projectId, folderPath)

			// 准备文件数据（转换为 Upload SDK 期望的格式）
			interface FolderFileUploadData {
				name: string
				file: File
				status: "init" | "uploading" | "done" | "error"
				file_id: string
				customFileKey?: string
			}

			const fileDataList: FolderFileUploadData[] = files.map((folderFile) => ({
				name: folderFile.file.name,
				file: folderFile.file,
				status: "init" as const,
				file_id: taskId
					? `${taskId}_${folderFile.relativePath}_${folderFile.file.name}`
					: `${folderFile.relativePath}_${folderFile.file.name}`,
				customFileKey: folderFile.customFileKey, // 传递自定义fileKey
			}))

			// 上传到OSS - 使用 Upload 实例的上传方法
			const results: FolderUploadResult[] = []

			// 并行上传所有文件
			const uploadPromises = fileDataList.map((fileData) => {
				return new Promise<FolderUploadResult>((resolve, reject) => {
					if (!fileData.file) {
						reject(new Error(`File is null for ${fileData.name}`))
						return
					}

					// 处理fileName：如果有自定义fileKey，需要提取相对于dir的路径
					const fileName = fileData.customFileKey
						? extractRelativePathFromCustomKey(
								fileData.customFileKey,
								customCredentials?.temporary_credential?.dir,
							)
						: fileData.name

					const uploadParams = {
						file: fileData.file,
						fileName,
						customCredentials,
						body: JSON.stringify({
							storage: "private",
							sts: true,
							content_type: fileData.file.type || "application/octet-stream",
						}),
					}

					const { success, fail, progress, pause, resume, cancel } =
						this.upload.upload(uploadParams)

					// 存储控制方法（确保方法存在）
					if (pause && resume && cancel) {
						this.activeUploads.set(fileData.file_id, { pause, resume, cancel })
					}

					// 监听上传进度
					progress?.((percent) => {
						console.log("progress", percent)
						if (percent && onProgress) {
							const uploadedBytes = Math.round((percent / 100) * fileData.file.size)
							onProgress(fileData.file_id, uploadedBytes)
						}
					})

					success?.((res) => {
						// 清理控制方法
						this.activeUploads.delete(fileData.file_id)
						this.pausedUploads.delete(fileData.file_id)

						if (res?.data?.path) {
							// 上传完成时确保进度是100%
							if (onProgress) {
								onProgress(fileData.file_id, fileData.file.size)
							}

							const result = {
								file_key: res.data.path,
								file_name: fileData.name,
								file_size: fileData.file?.size || 0,
								file_extension: fileData.name.split(".").pop() || "",
							}

							// 调用文件完成回调
							if (onFileCompleted) {
								onFileCompleted(fileData.file_id, result)
							}

							resolve(result)
						} else {
							reject(new Error("Upload failed: no path returned"))
						}
					})

					fail?.((err) => {
						// 清理控制方法
						this.activeUploads.delete(fileData.file_id)

						// err 是一个字符串，格式如："[Uploader] {status: 1002, message: isPause}"
						const errorString = String(err?.message || err || "")
						const isPauseError = errorString.includes("isPause")

						// 如果是暂停导致的"失败"，不删除 pausedUploads 中的记录
						if (!isPauseError) {
							this.pausedUploads.delete(fileData.file_id)
						}

						reject(new Error(`Upload failed: ${errorString || "Unknown error"}`))
					})
				})
			})

			// 等待所有上传完成
			const uploadResults = await Promise.all(uploadPromises)
			results.push(...uploadResults)

			// 如果所有上传都完成，设置状态为空闲
			if (this.activeUploads.size === 0 && this.pausedUploads.size === 0) {
				this.uploadState = "idle"
			}

			return results
		} catch (error) {
			console.error("OSS upload failed:", error)
			// 上传失败时也要重置状态
			this.uploadState = "idle"
			throw error
		}
	}

	/**
	 * 暂停所有当前上传
	 */
	pauseAllUploads(): void {
		console.log(`⏸️ Pausing ${this.activeUploads.size} active uploads`)
		for (const [fileId, controls] of this.activeUploads.entries()) {
			controls.pause?.()
			// 将任务移动到暂停列表
			this.pausedUploads.set(fileId, controls)
			console.log(`⏸️ Paused upload for file: ${fileId}`)
		}
		// 清空活跃上传列表，设置状态为暂停
		this.activeUploads.clear()
		this.uploadState = "paused"
	}

	/**
	 * 恢复所有当前上传
	 */
	resumeAllUploads(): void {
		console.log(`▶️ Resuming ${this.pausedUploads.size} paused uploads`)
		for (const [fileId, controls] of this.pausedUploads.entries()) {
			controls.resume?.()
			// 将任务移动回活跃列表
			this.activeUploads.set(fileId, controls)
			console.log(`▶️ Resumed upload for file: ${fileId}`)
		}
		// 清空暂停上传列表，设置状态为上传中
		this.pausedUploads.clear()
		if (this.activeUploads.size > 0) {
			this.uploadState = "uploading"
		} else {
			this.uploadState = "idle"
		}
	}

	/**
	 * 暂停指定任务的所有上传
	 */
	pauseTaskUploads(taskId: string): void {
		let pausedCount = 0
		// 暂停活跃的上传，并移动到暂停列表
		for (const [fileId, controls] of this.activeUploads.entries()) {
			// fileId 格式：{taskId}_{relativePath}_{fileName}
			if (fileId.startsWith(`${taskId}_`)) {
				controls.pause?.()
				// 将任务移动到暂停列表
				this.pausedUploads.set(fileId, controls)
				this.activeUploads.delete(fileId)
				pausedCount++
				console.log(`⏸️ Paused upload for file: ${fileId} (task: ${taskId})`)
			}
		}
		// 更新状态
		if (this.activeUploads.size === 0 && this.pausedUploads.size > 0) {
			this.uploadState = "paused"
		} else if (this.activeUploads.size === 0 && this.pausedUploads.size === 0) {
			this.uploadState = "idle"
		}
		console.log(`⏸️ Paused ${pausedCount} uploads for task ${taskId}`)
	}

	/**
	 * 恢复指定任务的所有上传
	 */
	resumeTaskUploads(taskId: string): void {
		let resumedCount = 0
		// 恢复暂停的上传，并移动回活跃列表
		for (const [fileId, controls] of this.pausedUploads.entries()) {
			// fileId 格式：{taskId}_{relativePath}_{fileName}
			if (fileId.startsWith(`${taskId}_`)) {
				controls.resume?.()
				// 将任务移动回活跃列表
				this.activeUploads.set(fileId, controls)
				this.pausedUploads.delete(fileId)
				resumedCount++
				console.log(`▶️ Resumed upload for file: ${fileId} (task: ${taskId})`)
			}
		}
		// 更新状态
		if (this.activeUploads.size > 0) {
			this.uploadState = "uploading"
		} else if (this.pausedUploads.size > 0) {
			this.uploadState = "paused"
		} else {
			this.uploadState = "idle"
		}
		console.log(`▶️ Resumed ${resumedCount} uploads for task ${taskId}`)
	}

	/**
	 * 检查指定任务是否还有活跃的上传
	 */
	hasActiveUploadsForTask(taskId: string): boolean {
		for (const fileId of this.activeUploads.keys()) {
			if (fileId.startsWith(`${taskId}_`)) {
				return true
			}
		}
		return false
	}

	/**
	 * 取消指定任务的所有上传
	 */
	cancelTaskUploads(taskId: string): void {
		let cancelledCount = 0
		// 取消活跃的上传
		for (const [fileId, controls] of this.activeUploads.entries()) {
			// fileId 格式：{taskId}_{relativePath}_{fileName}
			if (fileId.startsWith(`${taskId}_`)) {
				try {
					controls.cancel?.()
				} catch (error) {
					console.error(`Failed to cancel upload for ${fileId}:`, error)
				}
				this.activeUploads.delete(fileId)
				cancelledCount++
				console.log(`❌ Cancelled active upload for file: ${fileId} (task: ${taskId})`)
			}
		}
		// 取消暂停的上传
		for (const [fileId, controls] of this.pausedUploads.entries()) {
			// fileId 格式：{taskId}_{relativePath}_{fileName}
			if (fileId.startsWith(`${taskId}_`)) {
				try {
					controls.cancel?.()
				} catch (error) {
					console.error(`Failed to cancel paused upload for ${fileId}:`, error)
				}
				this.pausedUploads.delete(fileId)
				cancelledCount++
				console.log(`❌ Cancelled paused upload for file: ${fileId} (task: ${taskId})`)
			}
		}
		// 如果没有剩余的上传任务，重置状态
		if (this.activeUploads.size === 0 && this.pausedUploads.size === 0) {
			this.uploadState = "idle"
		}
		console.log(`❌ Cancelled ${cancelledCount} uploads for task ${taskId}`)
	}

	/**
	 * 强制清理指定任务的所有上传（用于异常情况）
	 * 即使 cancel() 失败也会删除记录
	 */
	forceCleanupTask(taskId: string): void {
		let cleanedCount = 0
		// 强制清理活跃上传
		for (const [fileId] of this.activeUploads.entries()) {
			if (fileId.startsWith(`${taskId}_`)) {
				this.activeUploads.delete(fileId)
				cleanedCount++
			}
		}
		// 强制清理暂停的上传
		for (const [fileId] of this.pausedUploads.entries()) {
			if (fileId.startsWith(`${taskId}_`)) {
				this.pausedUploads.delete(fileId)
				cleanedCount++
			}
		}
		// 重置状态
		if (this.activeUploads.size === 0 && this.pausedUploads.size === 0) {
			this.uploadState = "idle"
		}
		console.log(`🧹 Force cleaned ${cleanedCount} uploads for task ${taskId}`)
	}

	/**
	 * 取消所有当前上传
	 */
	cancelAllUploads(): void {
		const totalUploads = this.activeUploads.size + this.pausedUploads.size
		console.log(
			`❌ Cancelling ${totalUploads} uploads (${this.activeUploads.size} active, ${this.pausedUploads.size} paused)`,
		)
		// 取消活跃的上传
		for (const [fileId, controls] of this.activeUploads.entries()) {
			controls.cancel?.()
			console.log(`❌ Cancelled active upload for file: ${fileId}`)
		}
		// 取消暂停的上传
		for (const [fileId, controls] of this.pausedUploads.entries()) {
			controls.cancel?.()
			console.log(`❌ Cancelled paused upload for file: ${fileId}`)
		}
		// 清空所有上传队列并重置状态
		this.activeUploads.clear()
		this.pausedUploads.clear()
		this.uploadState = "idle"
	}

	/**
	 * 获取当前活跃上传数量
	 */
	get activeUploadCount(): number {
		return this.activeUploads.size
	}

	/**
	 * 获取暂停的上传数量
	 */
	get pausedUploadCount(): number {
		return this.pausedUploads.size
	}

	/**
	 * 获取总上传数量（活跃 + 暂停）
	 */
	get totalUploadCount(): number {
		return this.activeUploads.size + this.pausedUploads.size
	}

	/**
	 * 获取当前上传状态
	 */
	get currentUploadState(): "idle" | "uploading" | "paused" {
		return this.uploadState
	}

	/**
	 * 检查是否有上传任务在进行中
	 */
	get hasActiveUploads(): boolean {
		return this.activeUploads.size > 0 || this.pausedUploads.size > 0
	}
}

// 创建单例实例
export const ossUploadService = new OSSUploadService()

// 导出类型
export type { UploadCredentials, FileUploadData }
