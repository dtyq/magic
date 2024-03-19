import { UploadSource } from "@/opensource/pages/superMagic/components/MessageEditor/hooks/useFileUpload"

export interface FolderUploadFile {
	file: File
	relativePath: string
	folderPath: string
	targetPath: string
	customFileKey?: string // 自定义文件key，用于替换场景
}

export interface UploadFileWithKey {
	file: File
	customFileKey?: string
}

export interface UploadConfig {
	/** 单文件最大大小限制（字节） */
	maxFileSize: number
	/** 单次上传最大文件数量 */
	maxTotalFiles: number
	/** 允许的文件扩展名（空数组表示不限制） */
	allowedExtensions: string[]
	/** 禁止的文件扩展名 */
	blockedExtensions: string[]
}

/**
 * 失败文件详细信息
 */
export interface FailedFileInfo {
	fileName: string
	filePath: string
	fileSize: number
	error: string
	failedAt: number
	batchNumber?: number
}

export interface FolderUploadState {
	isUploading: boolean
	isPaused: boolean
	isCompleted: boolean
	isError: boolean

	totalFiles: number
	processedFiles: number
	successFiles: number
	errorFiles: number

	// 字节数统计（用于准确计算速度）
	totalBytes: number // 所有文件的总字节数
	uploadedBytes: number // 已上传的字节数

	currentBatch: number
	totalBatches: number
	progress: number

	currentPhase: "preparing" | "uploading" | "saving" | "paused" | "completed" | "error"

	// 详细信息
	uploadSpeed?: number // KB/s
	estimatedTimeRemaining?: number // seconds
	errorMessage?: string
	failedFilesList?: FailedFileInfo[] // 失败文件列表

	// 任务基本信息
	taskId: string
	projectId: string
	startTime: number
}

export interface FolderUploadOptions {
	projectId: string
	workspaceId?: string // 工作区ID，只有在超级麦吉环境下才有
	topicId?: string
	taskId?: string
	storageType?: "workspace" | "topic"
	source?: UploadSource
	batchSize?: number
	maxRetries?: number
	onlyUpload?: boolean // 是否只上传不保存到项目（true: 只上传到OSS，false: 上传后保存到项目）
}

export interface TaskCreateOptions extends FolderUploadOptions {
	projectName: string
	onProgress?: (taskId: string, state: FolderUploadState) => void
	onComplete?: (taskId: string) => void
	onError?: (taskId: string, error: Error) => void
	onBatchUploadComplete?: (batchInfo: BatchUploadInfo) => void
	onBatchSaveComplete?: (batchSaveInfo: BatchSaveInfo) => void
}

export interface FolderUploadTask {
	id: string
	projectId: string
	projectName: string
	workspaceId?: string // 工作区ID，只有在超级麦吉环境下才有
	topicId?: string
	taskId?: string
	baseSuffixDir: string
	files: File[]

	// 任务状态
	state: FolderUploadState

	// 任务配置
	options: FolderUploadOptions

	// 时间信息
	createdAt: number
	startedAt?: number
	completedAt?: number

	// 控制标志
	abortController?: AbortController

	// 序列化支持
	serialize: () => SerializedTask

	// 任务控制方法
	execute: (callbacks: TaskCallbacks) => Promise<void>
	cancel: () => void
	pause: () => void
	resume: () => void
	updateState: (updates: Partial<FolderUploadState>) => void
	getFailedFiles: () => FailedFileInfo[]
	retrySingleFile: (fileName: string, filePath: string) => Promise<boolean>
	clearFileTrackingState: () => void
}

export interface SerializedTask {
	id: string
	projectId: string
	projectName: string
	topicId?: string
	taskId?: string
	baseSuffixDir: string
	fileCount: number
	state: FolderUploadState
	options: FolderUploadOptions
	createdAt: number
	startedAt?: number
	failedFiles?: FailedFileInfo[]
}

export interface GlobalUploadState {
	// 所有任务
	tasks: Map<string, FolderUploadTask>

	// 活跃任务
	activeTasks: FolderUploadTask[]

	// 已完成任务
	completedTasks: FolderUploadTask[]

	// 等待任务
	pendingTasks: FolderUploadTask[]

	// 全局统计
	totalActiveTasks: number
	totalFiles: number
	totalProcessedFiles: number
	globalProgress: number

	// 系统设置
	maxConcurrentTasks: number
	maxConcurrentUploads: number
}

export interface TaskQueueItem {
	task: FolderUploadTask
	priority: number
	addedAt: number
}

export interface BatchUploadInfo {
	taskId: string
	currentBatch: number
	totalBatches: number
	batchSuccessCount: number
	batchFailedCount: number
	folderPath: string
	uploadedBytes: number
	totalBytes: number
}

export interface BatchSaveInfo {
	taskId: string
	savedFilesCount: number
	totalProcessedFiles: number
	savedFiles: Array<{
		file_key: string
		file_name: string
		file_size: number
		file_id?: string
		relative_file_path?: string
	}>
}

export interface TaskCallbacks {
	onProgress?: (taskId: string, state: FolderUploadState) => void
	onComplete?: (taskId: string) => void
	onError?: (taskId: string, error: Error) => void
	onBatchUploadComplete?: (batchInfo: BatchUploadInfo) => void
	onBatchSaveComplete?: (batchSaveInfo: BatchSaveInfo) => void
}

export interface UploadResult {
	file_key: string
	file_name: string
	file_size: number
	file_extension: string
}

export interface FolderUploadResult {
	totalFiles: number
	successFiles: number
	failedFiles: number
	uploadTime: number
}
