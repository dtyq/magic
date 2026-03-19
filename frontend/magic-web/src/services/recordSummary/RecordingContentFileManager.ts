import { Upload, UploadConfig as SDKUploadConfig } from "@dtyq/upload-sdk"
import { UploadTokenManager } from "./UploadTokenManager"
import { VoiceResultUtterance } from "@/components/business/VoiceInput/services/VoiceClient/types"
import { logger as Logger } from "@/utils/log"
import recordSummaryStore from "@/stores/recordingSummary"

const logger = Logger.createLogger("RecordingContentFileManager", {
	enableConfig: { console: false },
})

/**
 * Content file type enum
 * 内容文件类型枚举
 */
enum ContentFileType {
	Note = "note",
	Transcript = "transcript",
}

/**
 * Content file info
 * 内容文件信息
 */
interface ContentFileInfo {
	fileName: string
	fileId: string // File ID from backend preset_files
	filePath: string // File path from backend preset_files
	lastContent?: string // Last uploaded content
	pendingContent?: string // Pending content to upload
	isUploading: boolean
}

/**
 * Recording content file manager events
 * 录音内容文件管理器事件
 */
interface ContentFileManagerEvents {
	onUploadSuccess?: (fileType: ContentFileType, fileId: string, filePath: string) => void
	onUploadError?: (fileType: ContentFileType, error: Error) => void
}

/**
 * Recording content file manager
 * Manages note and transcript files generation, upload and throttled updates
 * 录音内容文件管理器
 * 管理笔记和转文本文件的生成、上传和节流更新
 */
export class RecordingContentFileManager {
	private tokenManager: UploadTokenManager
	private uploadInstance: Upload
	private events: ContentFileManagerEvents

	private sessionId: string | null = null
	private topicId: string | null = null

	// File information (initialized from backend preset_files)
	private noteFile: ContentFileInfo | null = null
	private transcriptFile: ContentFileInfo | null = null

	// Throttle timers
	private noteThrottleTimer: NodeJS.Timeout | null = null
	private transcriptThrottleTimer: NodeJS.Timeout | null = null
	private readonly throttleDelay = 4000 // 4 seconds throttle

	// Dispose flag
	private isDisposed = false

	constructor(tokenManager: UploadTokenManager, events: ContentFileManagerEvents = {}) {
		this.tokenManager = tokenManager
		this.uploadInstance = new Upload()
		this.events = events
	}

	/**
	 * Initialize content file manager
	 * Backend pre-creates note and transcript files, so no initial upload needed
	 * 初始化内容文件管理器
	 * 后端会预创建笔记和转写文件，因此不需要初始上传
	 */
	async initialize(
		sessionId: string,
		topicId: string,
		_projectId: string,
		options?: {
			existingNote?: string // Existing note content for restoration
			existingTranscript?: string // Existing transcript content for restoration
		},
	): Promise<void> {
		this.sessionId = sessionId
		this.topicId = topicId

		logger.log(`Initializing content file manager for session ${sessionId}`)

		// Get preset files from token manager
		let presetFiles = this.tokenManager.getPresetFiles(sessionId)

		// If not in cache, trigger token fetch to populate preset files
		if (!presetFiles) {
			logger.warn(`Preset files not in cache for session ${sessionId}, fetching from backend`)
			try {
				await this.tokenManager.getToken(sessionId, topicId)
				presetFiles = this.tokenManager.getPresetFiles(sessionId)
			} catch (error) {
				logger.error("Failed to fetch preset files from backend", error)
			}
		}

		if (!presetFiles) {
			throw new Error("Preset files not available from backend")
		}

		// Initialize note file info from backend
		this.noteFile = {
			fileName: presetFiles.note_file.file_name,
			fileId: presetFiles.note_file.file_id,
			filePath: presetFiles.note_file.file_path,
			lastContent: options?.existingNote,
			isUploading: false,
		}

		// Initialize transcript file info from backend
		this.transcriptFile = {
			fileName: presetFiles.transcript_file.file_name,
			fileId: presetFiles.transcript_file.file_id,
			filePath: presetFiles.transcript_file.file_path,
			lastContent: options?.existingTranscript,
			isUploading: false,
		}

		this.flushNoteUpdate(options?.existingNote || "")
		this.flushTranscriptUpdate(options?.existingTranscript || "")

		logger.log(`Content file manager initialized with preset files:`, {
			noteFile: presetFiles.note_file.file_name,
			transcriptFile: presetFiles.transcript_file.file_name,
		})
	}

	/**
	 * Cancel pending note update
	 * 取消待处理的笔记更新
	 */
	cancelNoteUpdate(): void {
		if (this.noteThrottleTimer) {
			clearTimeout(this.noteThrottleTimer)
			this.noteThrottleTimer = null
		}

		if (this.noteFile) {
			this.noteFile.pendingContent = undefined
		}

		logger.log("Note update cancelled")
	}

	/**
	 * Update note content (throttled)
	 * 更新笔记内容（节流）
	 */
	updateNote(content: string): void {
		if (this.isDisposed || !this.sessionId || !this.noteFile) {
			logger.warn("Cannot update note: manager not initialized or disposed")
			return
		}

		// Store pending content
		this.noteFile.pendingContent = content

		// Clear existing timer
		if (this.noteThrottleTimer) {
			// If timer exists, skip update
			logger.warn("Note update already in progress, skipping")
			return
		}

		// Set new throttle timer
		this.noteThrottleTimer = setTimeout(() => {
			this.flushNoteUpdate().then(() => {
				this.noteThrottleTimer = null
			})
		}, this.throttleDelay)
	}

	/**
	 * Update transcript content (throttled)
	 * 更新转文本内容（节流）
	 */
	updateTranscript(
		textContent: (VoiceResultUtterance & { add_time: number; id: string })[],
	): void {
		if (this.isDisposed || !this.sessionId || !this.transcriptFile) {
			logger.warn("Cannot update transcript: manager not initialized or disposed")
			return
		}

		// Convert text content to markdown format
		const content = this.formatTranscriptContent(textContent)

		// Store pending content
		this.transcriptFile.pendingContent = content

		// Clear existing timer
		if (this.transcriptThrottleTimer) {
			// If timer exists, skip update
			logger.warn("Transcript update already in progress, skipping")
			return
		}

		// Set new throttle timer
		this.transcriptThrottleTimer = setTimeout(() => {
			this.flushTranscriptUpdate().then(() => {
				this.transcriptThrottleTimer = null
			})
		}, this.throttleDelay)
	}

	/**
	 * Flush note update immediately
	 * 立即刷新笔记更新
	 */
	async flushNoteUpdate(currentContent?: string): Promise<void> {
		if (this.noteFile && currentContent !== undefined) {
			this.noteFile.pendingContent = currentContent
		}

		if (!this.noteFile || this.noteFile.pendingContent === undefined) return

		const content = this.noteFile.pendingContent
		this.noteFile.pendingContent = undefined

		// Skip if content hasn't changed
		if (content === this.noteFile.lastContent) {
			return
		}

		try {
			recordSummaryStore.setUpdateNoteStatus("saving")
			await this.uploadNoteFile(content)
			recordSummaryStore.setUpdateNoteStatus("success")

			setTimeout(() => {
				recordSummaryStore.setUpdateNoteStatus("idle")
			}, 2000)
		} catch (error) {
			logger.error("Failed to flush note update", error)
			this.noteFile.pendingContent = content
			recordSummaryStore.setUpdateNoteStatus("error")
		}
	}

	/**
	 * Flush transcript update immediately
	 * 立即刷新转文本更新
	 */
	async flushTranscriptUpdate(currentContent?: string): Promise<void> {
		if (this.transcriptFile && currentContent !== undefined) {
			this.transcriptFile.pendingContent = currentContent
		}

		if (!this.transcriptFile) return
		if (this.transcriptFile.pendingContent === undefined) return

		const content = this.transcriptFile.pendingContent
		this.transcriptFile.pendingContent = undefined

		// Skip if content hasn't changed
		if (content === this.transcriptFile.lastContent) {
			return
		}

		try {
			await this.uploadTranscriptFile(content)
		} catch (error) {
			logger.error("Failed to flush transcript update", error)
		}
	}

	/**
	 * Format transcript content to markdown
	 * 将转文本内容格式化为 Markdown
	 */
	private formatTranscriptContent(
		textContent: (VoiceResultUtterance & { add_time: number; id: string })[],
	): string {
		if (!textContent || textContent.length === 0) {
			return ""
		}

		// Format as markdown with timestamps
		return textContent
			.map((utterance) => {
				const timestamp = new Date(utterance.add_time).toLocaleTimeString("zh-CN", {
					hour: "2-digit",
					minute: "2-digit",
					second: "2-digit",
				})
				return `[${timestamp}] ${utterance.text}`
			})
			.join("\n\n")
	}

	/**
	 * Upload note file to OSS
	 * 上传笔记文件到 OSS
	 */
	private async uploadNoteFile(content: string, forceUpload: boolean = false): Promise<void> {
		if (!this.noteFile) {
			throw new Error("Note file not initialized")
		}

		if (!forceUpload && this.noteFile.isUploading) {
			logger.warn("Note file upload already in progress, skipping")
			return
		}

		this.noteFile.isUploading = true

		try {
			const filePath = await this.uploadContentFile(
				this.noteFile.fileName,
				content,
				ContentFileType.Note,
			)

			this.noteFile.lastContent = content
			this.events.onUploadSuccess?.(ContentFileType.Note, this.noteFile.fileId, filePath)

			logger.log(`Note file uploaded successfully: ${filePath}`)
		} catch (error) {
			logger.error("Failed to upload note file", error)
			this.events.onUploadError?.(ContentFileType.Note, error as Error)
			throw error
		} finally {
			this.noteFile.isUploading = false
		}
	}

	/**
	 * Upload transcript file to OSS
	 * 上传转文本文件到 OSS
	 */
	private async uploadTranscriptFile(
		content: string,
		forceUpload: boolean = false,
	): Promise<void> {
		if (!this.transcriptFile) {
			throw new Error("Transcript file not initialized")
		}

		if (!forceUpload && this.transcriptFile.isUploading) {
			logger.warn("Transcript file upload already in progress, skipping")
			return
		}

		this.transcriptFile.isUploading = true

		try {
			const filePath = await this.uploadContentFile(
				this.transcriptFile.fileName,
				content,
				ContentFileType.Transcript,
			)

			this.transcriptFile.lastContent = content
			this.events.onUploadSuccess?.(
				ContentFileType.Transcript,
				this.transcriptFile.fileId,
				filePath,
			)

			logger.log(`Transcript file uploaded successfully: ${filePath}`)
		} catch (error) {
			logger.error("Failed to upload transcript file", error)
			this.events.onUploadError?.(ContentFileType.Transcript, error as Error)
			throw error
		} finally {
			this.transcriptFile.isUploading = false
		}
	}

	/**
	 * Upload content file to OSS
	 * 上传内容文件到 OSS
	 */
	private async uploadContentFile(
		fileName: string,
		content: string,
		fileType: ContentFileType,
	): Promise<string> {
		if (!this.sessionId) {
			throw new Error("Session ID not set")
		}

		// Get upload credentials
		const customCredentials = await this.tokenManager.getToken(
			this.sessionId,
			this.topicId || "",
		)

		// Get preset file information based on file type
		const presetFile =
			fileType === ContentFileType.Note
				? this.tokenManager.getNoteFile(this.sessionId)
				: this.tokenManager.getTranscriptFile(this.sessionId)

		if (!presetFile) {
			throw new Error(`Preset file not available for ${fileType}`)
		}

		// Extract directory path from file_path
		// file_path format: "directory/filename.ext"
		const lastSlashIndex = presetFile.file_path.lastIndexOf("/")
		const displayDirPath =
			lastSlashIndex > 0 ? presetFile.file_path.substring(0, lastSlashIndex) : ""

		if (!displayDirPath) {
			throw new Error(`Invalid file path in preset file: ${presetFile.file_path}`)
		}

		// Create file blob
		const blob = new Blob([content], { type: "text/markdown;charset=utf-8" })
		const file = new File([blob], fileName, { type: "text/markdown;charset=utf-8" })

		// Modify credentials to use display directory
		const modifiedCredentials = this.modifyCredentialsDirectory(
			customCredentials,
			displayDirPath,
		)

		return new Promise((resolve, reject) => {
			const { success, fail } = this.uploadInstance.upload({
				file,
				fileName,
				customCredentials: modifiedCredentials,
			})

			success?.((res) => {
				if (res?.data?.path) {
					resolve(res.data.path)
				} else {
					reject(new Error(`Upload failed for ${fileType}: No path returned`))
				}
			})

			fail?.((error) => {
				reject(new Error(`Upload failed for ${fileType}: ${error || "Unknown error"}`))
			})
		})
	}

	/**
	 * Modify credentials directory to use display directory
	 * 修改凭证目录以使用显示目录
	 */
	private modifyCredentialsDirectory(
		credentials: SDKUploadConfig["customCredentials"],
		displayDirPath: string,
	): SDKUploadConfig["customCredentials"] {
		if (!credentials?.temporary_credential?.dir) {
			return credentials
		}

		// Concatenate base dir with display dir path
		const baseDir = credentials.temporary_credential.dir
		const normalizedBaseDir = baseDir.endsWith("/") ? baseDir.slice(0, -1) : baseDir
		const normalizedDisplayPath = displayDirPath.startsWith("/")
			? displayDirPath
			: "/" + displayDirPath
		const finalDir = normalizedBaseDir + normalizedDisplayPath
		const finalDirWithSlash = finalDir.endsWith("/") ? finalDir : finalDir + "/"

		// Create a copy of credentials
		const modified = {
			...credentials,
			temporary_credential: {
				...credentials.temporary_credential,
				dir: finalDirWithSlash,
			},
		}

		return modified
	}

	/**
	 * Dispose and upload all pending updates
	 * 销毁并上传所有待处理的更新
	 */
	async dispose(): Promise<void> {
		if (this.isDisposed) {
			return
		}

		this.isDisposed = true

		logger.log("Disposing content file manager, flushing pending updates")

		// Clear throttle timers
		if (this.noteThrottleTimer) {
			clearTimeout(this.noteThrottleTimer)
			this.noteThrottleTimer = null
		}

		if (this.transcriptThrottleTimer) {
			clearTimeout(this.transcriptThrottleTimer)
			this.transcriptThrottleTimer = null
		}

		// Flush any pending updates
		try {
			await Promise.all([this.flushNoteUpdate(), this.flushTranscriptUpdate()])
		} catch (error) {
			logger.error("Failed to flush pending updates during dispose", error)
		}

		// Reset state
		this.sessionId = null
		this.topicId = null

		logger.log("Content file manager disposed")
	}

	/**
	 * Get current file information (for debugging)
	 * 获取当前文件信息（用于调试）
	 */
	getFileInfo(): {
		note: ContentFileInfo | null
		transcript: ContentFileInfo | null
	} {
		return {
			note: this.noteFile ? { ...this.noteFile } : null,
			transcript: this.transcriptFile ? { ...this.transcriptFile } : null,
		}
	}

	/**
	 * Check if manager is disposed
	 * 检查管理器是否已销毁
	 */
	isManagerDisposed(): boolean {
		return this.isDisposed
	}

	/**
	 * Check if manager is initialized
	 * 检查管理器是否已初始化
	 */
	isInitialized(): boolean {
		return (
			this.sessionId !== null &&
			this.noteFile !== null &&
			this.transcriptFile !== null &&
			!this.isDisposed
		)
	}
}
