import { t } from "i18next"
import { runInAction } from "mobx"
import { FileApi, SuperMagicApi } from "@/apis"
import type { ProjectFilesStore } from "@/stores/projectFiles"
import { logger as Logger } from "@/infrastructure/logger"
import { superMagicUploadTokenService } from "../../services/UploadTokenService"
import {
	AttachmentSource,
	type AttachmentItem,
} from "@/pages/superMagic/components/TopicFilesButton/hooks/types"
import { FileData, UploadSource } from "../../types"
import type { UploadAttemptId, UploadResponse } from "../../services/UploadService"
import { UploadProgressBatcher } from "./UploadProgressBatcher"

const logger = Logger.createLogger("SuperMagicUpload")

interface UploadHandlersContext {
	getProjectId: () => string
	getTopicId: () => string
	getStorageType: () => "workspace" | "topic"
	getSource: () => UploadSource | undefined
	getProjectFilesStore: () => ProjectFilesStore
	getFiles: () => FileData[]
	trackSavedProjectFileId: (fileId?: string) => void
	setFilesWithLimit: (updater: (prev: FileData[]) => FileData[]) => void
	onProgressFilesChanged: (files: FileData[]) => void
	onFileProgressUpdate?: (
		fileId: string,
		progress: number,
		status: FileData["status"],
		error?: string,
	) => void
	onFileCompleted?: (
		fileId: string,
		reportResult: FileData["reportResult"],
		saveResult: FileData["saveResult"],
	) => void
}

interface UploadHandlers {
	handleProgress: (file: FileData, progress: number, attemptId: UploadAttemptId) => void
	handleSuccess: (
		file: FileData,
		response: UploadResponse,
		attemptId: UploadAttemptId,
	) => Promise<void>
	handleFail: (file: FileData, error: unknown, attemptId: UploadAttemptId) => void
	handleInit: (file: FileData, tools: { cancel?: () => void }, attemptId: UploadAttemptId) => void
	removeProgress: (...fileIds: Array<string | undefined>) => void
	clearProgress: () => void
}

function mapUploadSourceToAttachmentSource(source?: UploadSource): AttachmentSource {
	if (source === UploadSource.Home) return AttachmentSource.HOME
	if (source === UploadSource.ProjectFile) return AttachmentSource.PROJECT_DIRECTORY
	if (source === UploadSource.AgentFile) return AttachmentSource.AGENT
	return AttachmentSource.DEFAULT
}

export function createUploadHandlers(context: UploadHandlersContext): UploadHandlers {
	const currentAttempts = new Map<string, UploadAttemptId>()
	const progressBatcher = new UploadProgressBatcher((updates) => {
		const files = context.getFiles()
		let hasChanges = false

		runInAction(() => {
			updates.forEach((progress, fileId) => {
				const target = files.find((file) => file.id === fileId)
				if (!target || (target.status === "uploading" && target.progress === progress))
					return

				target.status = "uploading"
				target.progress = progress
				hasChanges = true
			})
		})

		if (hasChanges) context.onProgressFilesChanged([...files])
		updates.forEach((progress, fileId) => {
			context.onFileProgressUpdate?.(fileId, progress, "uploading")
		})
	})

	const isCurrentAttempt = (fileId: string, attemptId: UploadAttemptId) =>
		currentAttempts.get(fileId) === attemptId

	const handleProgress = (file: FileData, progress: number, attemptId: UploadAttemptId) => {
		if (!isCurrentAttempt(file.id, attemptId)) return
		progressBatcher.enqueue(file.id, progress)
	}

	const handleSuccess = async (
		file: FileData,
		response: UploadResponse,
		attemptId: UploadAttemptId,
	) => {
		if (!isCurrentAttempt(file.id, attemptId)) return
		// The upload body is complete even though report/save work may still be pending.
		progressBatcher.complete(file.id)
		try {
			const reportResult = await FileApi.reportFileUploads([
				{
					file_extension: file.name.split(".").pop() ?? "",
					file_key: response.key,
					file_size: response.size,
					file_name: response.name,
				},
			])
			if (!isCurrentAttempt(file.id, attemptId)) return

			const projectId = context.getProjectId()
			if (!projectId) {
				context.setFilesWithLimit((prev) => {
					const newFiles = [...prev]
					const target = newFiles.find((f) => f.id === file.id)
					if (target) {
						target.status = "done"
						target.result = response
						target.reportResult = reportResult[0]
						context.trackSavedProjectFileId(reportResult[0]?.file_id)
						context.onFileCompleted?.(file.id, reportResult[0], undefined)
					}
					return newFiles
				})
				currentAttempts.delete(file.id)
				return
			}

			let saveRes: FileData["saveResult"] | undefined
			try {
				if (file.isHidden) {
					const [batchSaveResult] = (await SuperMagicApi.batchSaveFiles({
						project_id: projectId,
						parent_id: file.parentId,
						files: [
							{
								project_id: projectId,
								topic_id: context.getTopicId(),
								task_id: "",
								file_key: response.key,
								file_name: response.name,
								file_size: response.size,
								file_type: "user_upload",
								storage_type: context.getStorageType(),
								source: context.getSource() ?? UploadSource.Home,
								relative_file_path: file.defaultRelativePath,
								is_hidden: true,
							},
						],
					})) as FileData["saveResult"][]

					saveRes = batchSaveResult
						? {
								...batchSaveResult,
								relative_file_path:
									batchSaveResult.relative_file_path || file.defaultRelativePath,
								is_hidden: true,
							}
						: undefined
				} else {
					saveRes = await superMagicUploadTokenService.saveFileToProject({
						project_id: projectId,
						topic_id: context.getTopicId(),
						parent_id: file.parentId,
						file_key: response.key,
						file_name: response.name,
						file_size: response.size,
						file_type: "user_upload",
						storage_type: context.getStorageType(),
						source: context.getSource() ?? UploadSource.Home,
						relative_file_path: file.defaultRelativePath,
					})
				}
			} catch (error) {
				logger.error({
					eventKey: "save_file_project_failed",
					errorKind: "unknown",
					error: error,
					message: "save file to project failed",
				})
			}
			if (!isCurrentAttempt(file.id, attemptId)) return

			const projectFilesStore = context.getProjectFilesStore()

			if (saveRes && projectFilesStore.currentSelectedProject?.id === projectId) {
				const isAlreadyInList = saveRes.file_id
					? projectFilesStore.hasProjectFile(saveRes.file_id)
					: false
				if (!isAlreadyInList) {
					const extension = saveRes.file_name?.split(".").pop() ?? ""
					const optimisticItem: AttachmentItem = {
						type: "file",
						file_id: saveRes.file_id,
						file_name: saveRes.file_name,
						file_extension: extension,
						file_key: saveRes.file_key,
						relative_file_path: saveRes.relative_file_path ?? saveRes.file_key,
						file_size: saveRes.file_size,
						is_hidden: Boolean(file.isHidden),
						children: [],
						source: mapUploadSourceToAttachmentSource(context.getSource()),
						task_id: saveRes.task_id,
						topic_id: saveRes.topic_id,
						project_id: saveRes.project_id,
						file_type: saveRes.file_type,
					}

					projectFilesStore.workspaceFilesList = projectFilesStore.excludeHiddenItems([
						...projectFilesStore.workspaceFilesList,
						optimisticItem,
					])
				}
			}

			context.setFilesWithLimit((prev) => {
				const newFiles = [...prev]
				const target = newFiles.find((f) => f.id === file.id)
				if (target) {
					target.status = "done"
					target.result = response
					target.reportResult = reportResult[0]
					target.saveResult = saveRes
					context.trackSavedProjectFileId(reportResult[0]?.file_id)
					context.trackSavedProjectFileId(saveRes?.file_id)
					context.onFileCompleted?.(file.id, reportResult[0], saveRes)
				}
				return newFiles
			})
			currentAttempts.delete(file.id)
		} catch (error) {
			if (!isCurrentAttempt(file.id, attemptId)) return
			currentAttempts.delete(file.id)
			progressBatcher.remove(file.id)
			logger.error({
				eventKey: "report_file_failed",
				errorKind: "unknown",
				error: error,
				message: "report file failed",
			})
			context.setFilesWithLimit((prev) => {
				const newFiles = [...prev]
				const target = newFiles.find((f) => f.id === file.id)
				if (target) {
					target.status = "error"
					target.error = t("fileUpload.fileReportFailed", { ns: "super" })
					context.onFileProgressUpdate?.(
						file.id,
						0,
						"error",
						t("fileUpload.fileReportFailed", { ns: "super" }),
					)
				}
				return newFiles
			})
		}
	}

	const handleFail = (file: FileData, error: unknown, attemptId: UploadAttemptId) => {
		if (!isCurrentAttempt(file.id, attemptId)) return
		currentAttempts.delete(file.id)
		progressBatcher.remove(file.id)
		const errorMessage =
			typeof error === "string"
				? error
				: (error as { message?: string })?.message ||
					t("fileUpload.uploadFailed", { ns: "super" })

		context.setFilesWithLimit((prev) => {
			const newFiles = [...prev]
			const target = newFiles.find((f) => f.id === file.id)
			if (target) {
				target.status = "error"
				target.error = errorMessage
				context.onFileProgressUpdate?.(file.id, 0, "error", errorMessage)
			}
			return newFiles
		})

		logger.error({
			eventKey: "upload_failed",
			errorKind: "unknown",
			message: "upload failed",
			context: { fileId: file.id, message: errorMessage },
		})
	}

	const handleInit = (
		file: FileData,
		{ cancel }: { cancel?: () => void },
		attemptId: UploadAttemptId,
	) => {
		currentAttempts.set(file.id, attemptId)
		progressBatcher.begin(file.id)
		context.setFilesWithLimit((prev) => {
			const newFiles = [...prev]
			const target = newFiles.find((f) => f.id === file.id)
			if (target) {
				target.cancel = cancel
				target.status = "uploading"
				target.progress = 0
				target.error = undefined
				context.onFileProgressUpdate?.(file.id, 0, "uploading")
			}
			return newFiles
		})
	}

	return {
		handleProgress,
		handleSuccess,
		handleFail,
		handleInit,
		removeProgress: (...fileIds) => {
			fileIds.forEach((fileId) => {
				if (!fileId) return
				currentAttempts.delete(fileId)
				progressBatcher.remove(fileId)
			})
		},
		clearProgress: () => {
			currentAttempts.clear()
			progressBatcher.dispose()
		},
	}
}
