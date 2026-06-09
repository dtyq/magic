import { SuperMagicApi } from "@/apis"
import { UploadSource } from "@/pages/superMagic/components/MessageEditor/hooks/useFileUpload"
import { recordingLogger } from "./utils/RecordingLogger"

const logger = recordingLogger.namespace("Upload:BatchSave")

interface RecordingBatchSaveFile {
	sessionId: string
	projectId: string
	topicId: string
	parentId?: string
	fileKey: string
	fileName: string
	fileSize: number
	isHidden?: boolean
	allowOverwrite?: boolean
}

export class RecordingBatchSaveReporter {
	private savedFilesBySession = new Map<string, Set<string>>()
	private inFlightReports = new Map<string, Promise<void>>()

	async reportUploadedFile(file: RecordingBatchSaveFile): Promise<void> {
		await this.reportUploadedFileInternal(file, false)
	}

	async reportUploadedFileStrict(file: RecordingBatchSaveFile): Promise<void> {
		await this.reportUploadedFileInternal(file, true)
	}

	private async reportUploadedFileInternal(
		file: RecordingBatchSaveFile,
		throwOnError: boolean,
	): Promise<void> {
		if (!file.projectId || !file.topicId || !file.fileKey || !file.fileName) {
			logger.warn("Skip batch save for incomplete file info", file)
			if (throwOnError) {
				throw new Error("Incomplete file info for batch save")
			}
			return
		}

		const reportKey = this.getReportKey(file.sessionId, file.fileKey)

		// Skip duplicate reports unless allowOverwrite is set (for note/transcript files)
		if (!file.allowOverwrite && this.hasSavedFile(file.sessionId, file.fileKey)) {
			logger.log("Skip duplicate batch save", {
				sessionId: file.sessionId,
				fileKey: file.fileKey,
			})
			return
		}

		// Wait for any in-flight report to complete before starting a new one
		const activeReport = this.inFlightReports.get(reportKey)
		if (activeReport) {
			await activeReport
		}

		const reportPromise = this.saveUploadedFile(file, throwOnError)
		this.inFlightReports.set(reportKey, reportPromise)

		try {
			await reportPromise
		} finally {
			this.inFlightReports.delete(reportKey)
		}
	}

	clearSession(sessionId: string): void {
		this.savedFilesBySession.delete(sessionId)

		for (const reportKey of Array.from(this.inFlightReports.keys())) {
			if (reportKey.startsWith(`${sessionId}::`)) {
				this.inFlightReports.delete(reportKey)
			}
		}
	}

	private async saveUploadedFile(
		file: RecordingBatchSaveFile,
		throwOnError: boolean,
	): Promise<void> {
		try {
			await SuperMagicApi.batchSaveFiles({
				project_id: file.projectId,
				parent_id: file.parentId,
				files: [
					{
						project_id: file.projectId,
						topic_id: file.topicId,
						task_id: file.sessionId,
						file_key: file.fileKey,
						file_name: file.fileName,
						file_size: file.fileSize,
						file_type: "user_upload",
						storage_type: "workspace",
						source: UploadSource.RecordSummary,
						...(file.isHidden ? { is_hidden: true } : {}),
					},
				],
			})

			logger.report("Batch save reported", {
				sessionId: file.sessionId,
				fileKey: file.fileKey,
				fileName: file.fileName,
				fileSize: file.fileSize,
				projectId: file.projectId,
				topicId: file.topicId,
				parentId: file.parentId,
			})
			this.markFileAsSaved(file.sessionId, file.fileKey)
		} catch (error) {
			logger.error("Batch save failed", {
				sessionId: file.sessionId,
				fileKey: file.fileKey,
				fileName: file.fileName,
				fileSize: file.fileSize,
				projectId: file.projectId,
				topicId: file.topicId,
				parentId: file.parentId,
				error: error instanceof Error ? error.message : String(error),
			})
			if (throwOnError) {
				throw error
			}
		}
	}

	private hasSavedFile(sessionId: string, fileKey: string): boolean {
		return this.savedFilesBySession.get(sessionId)?.has(fileKey) ?? false
	}

	private markFileAsSaved(sessionId: string, fileKey: string): void {
		const savedFiles = this.savedFilesBySession.get(sessionId) ?? new Set<string>()
		savedFiles.add(fileKey)
		this.savedFilesBySession.set(sessionId, savedFiles)
	}

	private getReportKey(sessionId: string, fileKey: string): string {
		return `${sessionId}::${fileKey}`
	}
}
